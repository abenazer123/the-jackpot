/**
 * POST /api/inquiry-agent/share — mint the trip link directly.
 *
 * The fast path for "Send to my group" at the price reveal: the guest
 * already has every slot, so there's nothing for Olivia to compose.
 * Routing the share through a full LLM turn just added seconds before
 * the widget showed. This endpoint reuses the harness's ensureShareLink
 * (same token, same inquiry row, idempotent) without the model, then
 * links the session to the minted inquiry.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ensureShareLink } from "@/lib/inquiry-agent/harness";
import type { InquirySessionRow } from "@/lib/inquiry-agent/types";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ShareSchema = z.object({ session_id: z.string() });

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: session, error } = await supabase
    .from("inquiry_session")
    .select("*")
    .eq("id", parsed.data.session_id)
    .maybeSingle();
  if (error || !session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const result = await ensureShareLink(session as InquirySessionRow, {});
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  // Link the session to the freshly minted inquiry (idempotent reuse
  // returns inquiryIdLinked: null and is already linked).
  if (result.inquiryIdLinked) {
    await supabase
      .from("inquiry_session")
      .update({
        inquiry_id: result.inquiryIdLinked,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.session_id);
  }

  return NextResponse.json({
    ok: true,
    url: result.url,
    total_cents: result.totalCents,
  });
}
