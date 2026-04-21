/**
 * POST /api/inquiries — booking funnel endpoint. Three modes, all handled
 * here to keep the funnel's network surface to a single URL.
 *
 *   1. DRAFT  — body contains `draft: true` + dates + email. Fires from
 *               BookingFunnelSteps the moment the funnel lands on the
 *               "checking" beat (Step 2), in parallel with the animation.
 *               Creates a partial inquiry row, computes a quote with
 *               guests=max placeholder, returns {inquiry_id, quote}.
 *               Rate-limited to 1 partial per IP per 10 minutes.
 *
 *   2. FINAL  — body contains `inquiry_id` (uuid) + the full Step 3
 *               payload. Updates the same row to status=submitted,
 *               recomputes the quote with real guest count, fires
 *               host+guest emails. If the id doesn't match a partial
 *               row, falls through to LEGACY for safety.
 *
 *   3. LEGACY — no `draft`, no `inquiry_id`. Matches the pre-partial
 *               behavior: one-shot INSERT + inline quote + emails. This
 *               is the fallback when the draft POST never happened (e.g.
 *               draft request was blocked, rate-limited, or failed).
 *
 * Supabase is authoritative. Emails fire unawaited — their failures are
 * logged but don't surface to the guest.
 */

import { NextResponse, type NextRequest } from "next/server";

import { sendGuestConfirmation } from "@/lib/email/guestConfirmation";
import { sendHostNotification } from "@/lib/email/hostNotification";
import type { InquiryPayload } from "@/lib/email/types";
import { serverCapture } from "@/lib/posthog-server";
import { computeQuote } from "@/lib/pricing/computeQuote";
import type { Quote } from "@/lib/pricing/types";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs"; // posthog-node + supabase-js need Node

const REASON_OPTIONS = new Set([
  "Birthday",
  "Anniversary",
  "Wedding",
  "Bachelor/ette",
  "Family trip",
  "Work retreat",
  "Getaway",
  "Other",
]);

interface IncomingBody {
  draft?: unknown;
  inquiry_id?: unknown;
  arrival?: unknown;
  departure?: unknown;
  email?: unknown;
  name?: unknown;
  phone?: unknown;
  guests?: unknown;
  reason?: unknown;
  source?: unknown;
  venue?: unknown;
  attribution?: unknown;
}

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "referrer",
  "landing_path",
  "current_path",
] as const;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
type ParsedAttribution = Partial<Record<AttributionKey, string>>;

function parseAttribution(raw: unknown): ParsedAttribution {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: ParsedAttribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const v = input[key];
    if (typeof v === "string") {
      const trimmed = v.trim().slice(0, 255);
      if (trimmed) out[key] = trimmed;
    }
  }
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Placeholder guest count used when the draft POST fires and we don't
 * yet know the real value. Finalize recomputes with the true count.
 */
const DRAFT_GUESTS_PLACEHOLDER = 14;

/** 10-minute window; 1 draft per IP allowed inside it. */
const DRAFT_RATE_WINDOW_MS = 10 * 60_000;

// -----------------------------------------------------------------------
// DRAFT parse — dates + email only.

interface DraftParsed {
  arrival: string;
  departure: string;
  email: string;
  source?: string;
  attribution: ParsedAttribution;
}

function parseDraft(
  body: IncomingBody,
): { ok: true; value: DraftParsed } | { ok: false; error: string } {
  const arrival = typeof body.arrival === "string" ? body.arrival : "";
  const departure = typeof body.departure === "string" ? body.departure : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const source = typeof body.source === "string" ? body.source : undefined;

  if (!ISO_DATE.test(arrival)) return { ok: false, error: "invalid arrival" };
  if (!ISO_DATE.test(departure))
    return { ok: false, error: "invalid departure" };
  if (departure <= arrival)
    return { ok: false, error: "departure must be after arrival" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid email" };

  return {
    ok: true,
    value: {
      arrival,
      departure,
      email: email.toLowerCase(),
      source,
      attribution: parseAttribution(body.attribution),
    },
  };
}

// -----------------------------------------------------------------------
// FULL parse — Step 3 payload.

interface ParseResult {
  ok: true;
  value: InquiryPayload & { source?: string; attribution: ParsedAttribution };
}
interface ParseError {
  ok: false;
  error: string;
}

function parseFull(body: IncomingBody): ParseResult | ParseError {
  const arrival = typeof body.arrival === "string" ? body.arrival : "";
  const departure = typeof body.departure === "string" ? body.departure : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const guests = typeof body.guests === "number" ? body.guests : NaN;
  const reason = typeof body.reason === "string" ? body.reason : "";
  const source = typeof body.source === "string" ? body.source : undefined;
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";

  if (!ISO_DATE.test(arrival)) return { ok: false, error: "invalid arrival" };
  if (!ISO_DATE.test(departure))
    return { ok: false, error: "invalid departure" };
  if (departure <= arrival)
    return { ok: false, error: "departure must be after arrival" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid email" };
  if (!name) return { ok: false, error: "name required" };
  if (!phone) return { ok: false, error: "phone required" };
  if (!Number.isFinite(guests) || guests < 1 || guests > 14)
    return { ok: false, error: "guests must be 1..14" };
  if (!REASON_OPTIONS.has(reason))
    return { ok: false, error: "invalid reason" };

  const a = new Date(arrival + "T00:00:00");
  const d = new Date(departure + "T00:00:00");
  const nights = Math.max(
    1,
    Math.round((d.getTime() - a.getTime()) / 86_400_000),
  );

  return {
    ok: true,
    value: {
      arrival,
      departure,
      email: email.toLowerCase(),
      name,
      phone,
      guests,
      reason,
      nights,
      source,
      venue: venue || undefined,
      attribution: parseAttribution(body.attribution),
    },
  };
}

// -----------------------------------------------------------------------
// Helpers

async function computeQuoteSafely(params: {
  arrival: string;
  departure: string;
  guests: number;
  occasion?: string;
}): Promise<Quote | null> {
  try {
    const r = await computeQuote(params);
    if (r.ok) return r.quote;
    console.warn(
      "[inquiries] quote compute skipped",
      r.error.code,
      r.error.message,
    );
    return null;
  } catch (err) {
    console.error("[inquiries] quote compute threw", err);
    return null;
  }
}

function requestIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || null;
}

async function overDraftRateLimit(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const cutoff = new Date(Date.now() - DRAFT_RATE_WINDOW_MS).toISOString();
  const { count, error } = await supabaseServer()
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("status", "partial")
    .gt("created_at", cutoff);
  if (error) {
    console.warn("[inquiries] rate-limit check failed, allowing", error);
    return false;
  }
  return (count ?? 0) >= 1;
}

// -----------------------------------------------------------------------
// Route

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: IncomingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ip = requestIp(req);
  const userAgent = req.headers.get("user-agent") ?? null;

  // -------- DRAFT branch ------------------------------------------------
  if (body.draft === true) {
    const parsed = parseDraft(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const p = parsed.value;

    if (await overDraftRateLimit(ip)) {
      return NextResponse.json(
        { error: "too many drafts from this IP" },
        { status: 429 },
      );
    }

    const quote = await computeQuoteSafely({
      arrival: p.arrival,
      departure: p.departure,
      guests: DRAFT_GUESTS_PLACEHOLDER,
    });

    const { data, error } = await supabaseServer()
      .from("inquiries")
      .insert({
        status: "partial",
        arrival: p.arrival,
        departure: p.departure,
        email: p.email,
        source: p.source ?? null,
        utm_source: p.attribution.utm_source ?? null,
        utm_medium: p.attribution.utm_medium ?? null,
        utm_campaign: p.attribution.utm_campaign ?? null,
        utm_term: p.attribution.utm_term ?? null,
        utm_content: p.attribution.utm_content ?? null,
        gclid: p.attribution.gclid ?? null,
        fbclid: p.attribution.fbclid ?? null,
        msclkid: p.attribution.msclkid ?? null,
        referrer: p.attribution.referrer ?? null,
        landing_path: p.attribution.landing_path ?? null,
        current_path: p.attribution.current_path ?? null,
        user_agent: userAgent,
        ip,
        quote_snapshot: quote,
        quote_total_cents: quote?.totalCents ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[inquiries/draft] insert failed", error);
      return NextResponse.json(
        { error: "could not save draft" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, inquiry_id: data.id, quote });
  }

  // -------- FINALIZE branch (has inquiry_id) ---------------------------
  const inquiryId =
    typeof body.inquiry_id === "string" && UUID_RE.test(body.inquiry_id)
      ? body.inquiry_id
      : null;

  const parsed = parseFull(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const p = parsed.value;

  const quote = await computeQuoteSafely({
    arrival: p.arrival,
    departure: p.departure,
    guests: p.guests,
    occasion: p.reason,
  });

  let finalizedId: string | null = null;

  if (inquiryId) {
    // Update the existing partial row in place.
    const { data, error } = await supabaseServer()
      .from("inquiries")
      .update({
        status: "submitted",
        // Dates/email may have been edited between Step 1 and Step 3.
        arrival: p.arrival,
        departure: p.departure,
        email: p.email,
        name: p.name,
        phone: p.phone,
        guests: p.guests,
        reason: p.reason,
        venue: p.venue ?? null,
        // Re-apply attribution in case the draft missed any keys.
        utm_source: p.attribution.utm_source ?? null,
        utm_medium: p.attribution.utm_medium ?? null,
        utm_campaign: p.attribution.utm_campaign ?? null,
        utm_term: p.attribution.utm_term ?? null,
        utm_content: p.attribution.utm_content ?? null,
        gclid: p.attribution.gclid ?? null,
        fbclid: p.attribution.fbclid ?? null,
        msclkid: p.attribution.msclkid ?? null,
        referrer: p.attribution.referrer ?? null,
        landing_path: p.attribution.landing_path ?? null,
        current_path: p.attribution.current_path ?? null,
        quote_snapshot: quote,
        quote_total_cents: quote?.totalCents ?? null,
      })
      .eq("id", inquiryId)
      .eq("status", "partial")
      .select("id")
      .single();
    if (!error && data) finalizedId = data.id as string;
    else if (error) {
      console.warn(
        "[inquiries/finalize] update miss, falling through to legacy",
        { inquiryId, error: error.message },
      );
    }
  }

  // -------- LEGACY branch (no id, or finalize missed) ------------------
  if (!finalizedId) {
    const { data, error } = await supabaseServer()
      .from("inquiries")
      .insert({
        status: "submitted",
        arrival: p.arrival,
        departure: p.departure,
        email: p.email,
        name: p.name,
        phone: p.phone,
        guests: p.guests,
        reason: p.reason,
        source: p.source ?? null,
        venue: p.venue ?? null,
        utm_source: p.attribution.utm_source ?? null,
        utm_medium: p.attribution.utm_medium ?? null,
        utm_campaign: p.attribution.utm_campaign ?? null,
        utm_term: p.attribution.utm_term ?? null,
        utm_content: p.attribution.utm_content ?? null,
        gclid: p.attribution.gclid ?? null,
        fbclid: p.attribution.fbclid ?? null,
        msclkid: p.attribution.msclkid ?? null,
        referrer: p.attribution.referrer ?? null,
        landing_path: p.attribution.landing_path ?? null,
        current_path: p.attribution.current_path ?? null,
        user_agent: userAgent,
        ip,
        quote_snapshot: quote,
        quote_total_cents: quote?.totalCents ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[inquiries/legacy] insert failed", error);
      return NextResponse.json(
        { error: "could not save inquiry" },
        { status: 500 },
      );
    }
    finalizedId = data.id as string;
  }

  // Analytics (server-side, authoritative). Awaited so we flush before
  // the serverless function exits.
  await serverCapture({
    distinctId: p.email,
    event: "booking_inquiry_submitted",
    properties: {
      nights: p.nights,
      guests: p.guests,
      reason: p.reason,
      source: p.source,
      ...p.attribution,
    },
    set: {
      email: p.email,
      name: p.name,
      phone: p.phone,
    },
  });

  // Emails — fire and log, don't block the response.
  Promise.allSettled([
    sendHostNotification(p),
    sendGuestConfirmation(p),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[inquiries] email ${i === 0 ? "host" : "guest"} failed`,
          r.reason,
        );
      }
    });
  });

  return NextResponse.json({ ok: true, inquiry_id: finalizedId, quote });
}
