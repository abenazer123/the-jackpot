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
import { sendHostPathSignal } from "@/lib/email/hostPathSignal";
import type { InquiryPayload } from "@/lib/email/types";
import { serverCapture } from "@/lib/posthog-server";
import { computeQuoteLive } from "@/lib/pricing/computeQuoteLive";
import type { Quote } from "@/lib/pricing/types";
import { generateShareToken } from "@/lib/share/generateShareToken";
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
  /** Set by the success-screen CTAs — patches reveal fields on the
   *  existing row instead of going through finalize/legacy (which would
   *  duplicate the row + re-fire host/guest emails). */
  flag_update?: unknown;
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
  // Reveal-screen interactions (Quote Reveal redesign)
  appeal_text?: unknown;
  appeal_stretch_level?: unknown;
  alt_dates_requested?: unknown;
  share_requested?: unknown;
  split_pay_requested?: unknown;
  primary_cta_path?: unknown;
  // Legacy Step 4 fields (no longer written by the client; preserved
  // here so a stale browser session doesn't error on submit).
  budget_bucket?: unknown;
  budget_other_text?: unknown;
  split_intent?: unknown;
  split_count?: unknown;
  deposit_link_requested?: unknown;
}

const STRETCH_LEVELS = new Set(["close", "far"]);
const PRIMARY_CTA_PATHS = new Set(["interested", "share", "appeal"]);

interface RevealFields {
  appeal_text: string | null;
  appeal_stretch_level: string | null;
  alt_dates_requested: boolean;
  share_requested: boolean;
  split_pay_requested: boolean;
  primary_cta_path: string | null;
}

/** Parse the success-screen interaction fields. All nullable /
 *  default-false; the partial PATCH paths only update fields that are
 *  set, so callers can send subset of these. */
function parseRevealFields(body: IncomingBody): RevealFields {
  const appeal =
    typeof body.appeal_text === "string"
      ? body.appeal_text.trim().slice(0, 2000) || null
      : null;
  const stretch =
    typeof body.appeal_stretch_level === "string" &&
    STRETCH_LEVELS.has(body.appeal_stretch_level)
      ? body.appeal_stretch_level
      : null;
  const path =
    typeof body.primary_cta_path === "string" &&
    PRIMARY_CTA_PATHS.has(body.primary_cta_path)
      ? body.primary_cta_path
      : null;
  return {
    appeal_text: appeal,
    appeal_stretch_level: stretch,
    alt_dates_requested: body.alt_dates_requested === true,
    share_requested: body.share_requested === true,
    split_pay_requested: body.split_pay_requested === true,
    primary_cta_path: path,
  };
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
    const r = await computeQuoteLive(params);
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

    return NextResponse.json({
      ok: true,
      inquiry_id: data.id,
      quote,
    });
  }

  // -------- FLAG-UPDATE branch (success-screen CTA fired) --------------
  // Client sends `flag_update: true` + inquiry_id + the reveal/path
  // fields it wants to patch. We do not re-run finalize, do not re-send
  // the first-touch host/guest emails, and do not insert a new row.
  // For "interested" and "appeal" paths we fire a lightweight signal
  // email so Abe knows to follow up.
  if (body.flag_update === true) {
    const flagInquiryId =
      typeof body.inquiry_id === "string" && UUID_RE.test(body.inquiry_id)
        ? body.inquiry_id
        : null;
    if (!flagInquiryId) {
      return NextResponse.json(
        { error: "flag_update requires inquiry_id" },
        { status: 400 },
      );
    }

    const reveal = parseRevealFields(body);

    // Build a sparse patch — only set the fields that this CTA event
    // actually carries. Skipping nulls/false avoids overwriting prior
    // CTA flags when a later CTA fires on the same row.
    const patch: Record<string, unknown> = {};
    if (reveal.primary_cta_path !== null)
      patch.primary_cta_path = reveal.primary_cta_path;
    if (reveal.share_requested) patch.share_requested = true;
    if (reveal.split_pay_requested) patch.split_pay_requested = true;
    if (reveal.alt_dates_requested) patch.alt_dates_requested = true;
    if (reveal.appeal_text !== null) patch.appeal_text = reveal.appeal_text;
    if (reveal.appeal_stretch_level !== null)
      patch.appeal_stretch_level = reveal.appeal_stretch_level;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, inquiry_id: flagInquiryId });
    }

    // Pull the row so the path-signal email has full context (name,
    // phone, dates, total). Single round-trip.
    const { data: row, error: readError } = await supabaseServer()
      .from("inquiries")
      .select(
        "id, status, arrival, departure, email, name, phone, guests, reason, source, venue, quote_total_cents",
      )
      .eq("id", flagInquiryId)
      .single();

    if (readError || !row) {
      console.error("[inquiries/flag] row not found", flagInquiryId, readError);
      return NextResponse.json(
        { error: "inquiry not found" },
        { status: 404 },
      );
    }

    const { error: updateError } = await supabaseServer()
      .from("inquiries")
      .update(patch)
      .eq("id", flagInquiryId);

    if (updateError) {
      console.error("[inquiries/flag] update failed", updateError);
      return NextResponse.json(
        { error: "could not save flag" },
        { status: 500 },
      );
    }

    // PostHog server event for the path tap.
    if (reveal.primary_cta_path) {
      await serverCapture({
        distinctId: (row.email as string) || flagInquiryId,
        event: "quote_reveal_path_tapped",
        properties: {
          path: reveal.primary_cta_path,
          stretch_level: reveal.appeal_stretch_level,
          share_requested: reveal.share_requested,
          inquiry_id: flagInquiryId,
        },
      });
    }

    // Path-specific host signal email — fire-and-forget. Only for
    // "interested" and "appeal"; "share" gets the trip-portal flow
    // (Phase 2) instead.
    const path = reveal.primary_cta_path;
    if (
      (path === "interested" || path === "appeal") &&
      typeof row.name === "string" &&
      row.name &&
      typeof row.phone === "string" &&
      row.phone
    ) {
      const a = new Date((row.arrival as string) + "T00:00:00");
      const d = new Date((row.departure as string) + "T00:00:00");
      const nights = Math.max(
        1,
        Math.round((d.getTime() - a.getTime()) / 86_400_000),
      );
      sendHostPathSignal({
        path,
        arrival: row.arrival as string,
        departure: row.departure as string,
        nights,
        email: row.email as string,
        name: row.name as string,
        phone: row.phone as string,
        guests: (row.guests as number) ?? 0,
        reason: (row.reason as string) ?? "",
        source: (row.source as string | null) ?? undefined,
        venue: (row.venue as string | null) ?? undefined,
        totalCents: (row.quote_total_cents as number | null) ?? null,
        stretchLevel: reveal.appeal_stretch_level as "close" | "far" | null,
        appealText: reveal.appeal_text,
      }).catch((err) => {
        console.error("[inquiries/flag] path signal email failed", err);
      });
    }

    return NextResponse.json({ ok: true, inquiry_id: flagInquiryId });
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
  const reveal = parseRevealFields(body);

  const quote = await computeQuoteSafely({
    arrival: p.arrival,
    departure: p.departure,
    guests: p.guests,
    occasion: p.reason,
  });

  // Public-facing token used in /book/quote/[token] and /trip/[token].
  // Generated fresh per finalize — if the finalize update misses (row
  // already in submitted state, or doesn't exist), the legacy INSERT
  // path will use this same value, so the client always gets a token
  // back regardless of which branch resolved the request.
  const shareToken = generateShareToken();
  let finalizedId: string | null = null;
  let finalizedShareToken: string | null = null;

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
        share_token: shareToken,
        // Reveal-screen interactions
        appeal_text: reveal.appeal_text,
        appeal_stretch_level: reveal.appeal_stretch_level,
        alt_dates_requested: reveal.alt_dates_requested,
        share_requested: reveal.share_requested,
        split_pay_requested: reveal.split_pay_requested,
        primary_cta_path: reveal.primary_cta_path,
      })
      .eq("id", inquiryId)
      .eq("status", "partial")
      .select("id, share_token")
      .single();
    if (!error && data) {
      finalizedId = data.id as string;
      finalizedShareToken = (data.share_token as string | null) ?? null;
    } else if (error) {
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
        share_token: shareToken,
        // Reveal-screen interactions
        appeal_text: reveal.appeal_text,
        appeal_stretch_level: reveal.appeal_stretch_level,
        alt_dates_requested: reveal.alt_dates_requested,
        share_requested: reveal.share_requested,
        split_pay_requested: reveal.split_pay_requested,
        primary_cta_path: reveal.primary_cta_path,
      })
      .select("id, share_token")
      .single();
    if (error || !data) {
      console.error("[inquiries/legacy] insert failed", error);
      return NextResponse.json(
        { error: "could not save inquiry" },
        { status: 500 },
      );
    }
    finalizedId = data.id as string;
    finalizedShareToken = (data.share_token as string | null) ?? null;
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

  // Build the trip portal URL so the guest confirmation email can
  // link to it. NEXT_PUBLIC_SITE_URL is the canonical origin in
  // prod; localhost fallback for dev.
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const tripUrl = finalizedShareToken
    ? `${origin}/trip/${finalizedShareToken}`
    : undefined;
  const emailPayload = { ...p, tripUrl };

  // Emails — fire and log, don't block the response.
  Promise.allSettled([
    sendHostNotification(emailPayload),
    sendGuestConfirmation(emailPayload),
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

  return NextResponse.json({
    ok: true,
    inquiry_id: finalizedId,
    share_token: finalizedShareToken,
    quote,
  });
}
