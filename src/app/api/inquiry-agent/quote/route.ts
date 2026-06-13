/**
 * POST /api/inquiry-agent/quote — fetch a live PriceLabs quote for the
 * /chat surface. Thin wrapper around computeQuoteLive so the chat
 * thread can render a real price card before handing the conversation
 * to the post-price LLM moment.
 *
 * The booking funnel's /api/inquiries endpoint also calls
 * computeQuoteLive (see src/lib/pricing/computeQuoteLive.ts) — same
 * shape, same numbers. We deliberately don't dedupe the two routes:
 * /api/inquiries owns lead capture + email + CRM sync, while this
 * endpoint computes the chat-surface number.
 *
 * One side effect: when the caller passes a `session_id`, we persist the
 * computed total into that session's slots (quote_total_cents). This is
 * what makes a later notify_abe carry the price the guest saw, on BOTH
 * the scripted widget path and the agent-driven path, with no client
 * round-trip and no race. Best-effort: a persist failure never affects
 * the quote response.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { findAlternateRanges } from "@/lib/inquiry-agent/alternates";
import { computeQuoteLive } from "@/lib/pricing/computeQuoteLive";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const QuoteRequestSchema = z.object({
  arrival: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departure: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(14),
  occasion: z.string().optional(),
  /** When present, persist the computed total into this session's slots
   *  so notify_abe carries the price. Pass it only from the real
   *  price-reveal fetch, never the placeholder-count availability check. */
  session_id: z.string().optional(),
});

/** Merge the computed total into the session's slots. Read-modify-write
 *  so we don't clobber other slots; swallow all errors (never block the
 *  quote on a bookkeeping write). */
async function persistTotalToSession(
  sessionId: string,
  totalCents: number,
): Promise<void> {
  try {
    const supabase = supabaseServer();
    const { data: row } = await supabase
      .from("inquiry_session")
      .select("slots")
      .eq("id", sessionId)
      .maybeSingle();
    if (!row) return; // session not minted yet — nothing to update
    const slots = (row.slots ?? {}) as Record<string, unknown>;
    if (slots.quote_total_cents === totalCents) return; // already current
    await supabase
      .from("inquiry_session")
      .update({ slots: { ...slots, quote_total_cents: totalCents } })
      .eq("id", sessionId);
  } catch (err) {
    console.warn("[quote] session total persist skipped", err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = QuoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await computeQuoteLive(parsed.data);
  if (!result.ok) {
    // On `unavailable`, find nearby open ranges so the chat can offer
    // real alternates instead of an empty "those are taken" dead end.
    let alternates;
    if (result.error.code === "unavailable") {
      alternates = await findAlternateRanges(
        parsed.data.arrival,
        parsed.data.departure,
        parsed.data.guests,
      );
    }
    return NextResponse.json(
      { ok: false, error: result.error, alternates: alternates ?? [] },
      { status: 200 },
    );
  }

  // Persist the real total into the session (best-effort) so notify_abe
  // carries the number regardless of which chat path the guest is on.
  if (parsed.data.session_id) {
    await persistTotalToSession(parsed.data.session_id, result.quote.totalCents);
  }

  return NextResponse.json({ ok: true, quote: result.quote });
}
