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
 * endpoint is read-only and stateless (no DB writes).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { findAlternateRanges } from "@/lib/inquiry-agent/alternates";
import { computeQuoteLive } from "@/lib/pricing/computeQuoteLive";

export const runtime = "nodejs";

const QuoteRequestSchema = z.object({
  arrival: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departure: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(14),
  occasion: z.string().optional(),
});

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

  return NextResponse.json({ ok: true, quote: result.quote });
}
