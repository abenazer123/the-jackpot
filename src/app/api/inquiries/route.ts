/**
 * POST /api/inquiries — booking funnel submission endpoint.
 *
 * Flow:
 *   1. Validate payload (email format, required fields, guests 1..14, dates).
 *   2. Persist to Supabase `inquiries` (authoritative store — the one
 *      we care most about not dropping).
 *   3. Fire `booking_inquiry_submitted` PostHog event with distinct_id =
 *      email + $set traits so the person profile is tied to the lead.
 *   4. Fire host-notification + guest-confirmation emails in parallel,
 *      unawaited — email flakiness doesn't block the API response.
 *   5. Return 200. On validation error 400, on DB error 500.
 */

import { NextResponse, type NextRequest } from "next/server";

import { sendGuestConfirmation } from "@/lib/email/guestConfirmation";
import { sendHostNotification } from "@/lib/email/hostNotification";
import type { InquiryPayload } from "@/lib/email/types";
import { serverCapture } from "@/lib/posthog-server";
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

interface ParseResult {
  ok: true;
  value: InquiryPayload & {
    source?: string;
    attribution: ParsedAttribution;
  };
}
interface ParseError {
  ok: false;
  error: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBody(body: IncomingBody): ParseResult | ParseError {
  const arrival = typeof body.arrival === "string" ? body.arrival : "";
  const departure = typeof body.departure === "string" ? body.departure : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const guests = typeof body.guests === "number" ? body.guests : NaN;
  const reason = typeof body.reason === "string" ? body.reason : "";
  const source = typeof body.source === "string" ? body.source : undefined;
  const venue =
    typeof body.venue === "string" ? body.venue.trim() : "";

  if (!ISO_DATE.test(arrival)) return { ok: false, error: "invalid arrival" };
  if (!ISO_DATE.test(departure)) return { ok: false, error: "invalid departure" };
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: IncomingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const p = parsed.value;

  const userAgent = req.headers.get("user-agent") ?? null;
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || null;

  // 1. Persist — if this fails, we fail the request. The UI can show
  //    an error and the user can retry.
  try {
    const { error } = await supabaseServer()
      .from("inquiries")
      .insert({
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
      });
    if (error) throw error;
  } catch (err) {
    console.error("[inquiries] supabase insert failed", err);
    return NextResponse.json(
      { error: "could not save inquiry" },
      { status: 500 },
    );
  }

  // 2. Analytics (server-side, authoritative). Awaited so we flush before
  //    the serverless function exits. Attribution fields are explicit event
  //    properties (not just person-profile traits) so PostHog insights can
  //    group by utm_* without relying on $initial_utm_* autocapture.
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

  // 3. Emails — fire and log, don't block the response or surface a
  //    partial-failure to the user. The Supabase row is authoritative.
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

  return NextResponse.json({ ok: true });
}
