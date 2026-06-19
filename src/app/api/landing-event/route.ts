/**
 * POST /api/landing-event — records a /batch occasion-screen event.
 *
 * Fired by the occasion screen on mount (`occasion_screen_viewed`) and on
 * tap (`occasion_selected`). Writes one row to `public.landing_event` via
 * the service role. Best-effort: a write failure never blocks the UI, so
 * on any error we still return 200 with `ok:false` and the screen carries
 * on. Bad input is the only 400.
 *
 * Dedup + bounce are computed downstream (group by anon_id, filter
 * internal=false). See docs/batch-funnel-brief-2026-06-18.md.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const Schema = z.object({
  anon_id: z.string().min(1).max(100),
  event: z.enum(["occasion_screen_viewed", "occasion_selected"]),
  occasion: z.string().max(60).optional(),
  occasion_freetext: z.string().max(280).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
  landing_path: z.string().max(200).optional(),
  internal: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const d = parsed.data;
  try {
    const supabase = supabaseServer();
    const { error } = await supabase.from("landing_event").insert({
      anon_id: d.anon_id,
      event: d.event,
      occasion: d.occasion ?? null,
      occasion_freetext: d.occasion_freetext ?? null,
      utm_source: d.utm_source ?? null,
      utm_medium: d.utm_medium ?? null,
      utm_campaign: d.utm_campaign ?? null,
      utm_term: d.utm_term ?? null,
      utm_content: d.utm_content ?? null,
      referrer: d.referrer ?? null,
      landing_path: d.landing_path ?? null,
      internal: d.internal ?? false,
    });
    if (error) {
      // Best-effort analytics: log, but never surface to the UI.
      console.warn("[landing-event] insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[landing-event] error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
