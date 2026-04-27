/**
 * POST /api/trip-view/[token] — increments the trip page's view
 * counter, deduplicated per browser within a 30-minute window via
 * a short-TTL cookie. Called from a tiny client component on the
 * trip page so SSR-only fetches (link unfurl bots, search crawlers)
 * don't inflate the count.
 *
 * Sets `shared_at` on the row the first time anyone hits the
 * route. That timestamp anchors the 60-day expiry the page itself
 * already enforces.
 *
 * Cookie name: `jp_trip_seen_<token>` (per-token so a viewer who
 * sees multiple inquiries gets counted on each).
 */

import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;
const COOKIE_TTL_SECONDS = 30 * 60; // 30 min

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const cookieName = `jp_trip_seen_${token}`;
  const seen = req.cookies.get(cookieName)?.value === "1";
  if (seen) {
    // Recent visit by this browser — no-op so the counter reads
    // closer to "unique-ish viewers" than "raw page loads".
    return NextResponse.json({ ok: true, deduped: true });
  }

  const sb = supabaseServer();
  // Read current row to get share_views + shared_at. Use single
  // round-trip: we update if found and inspect the rowcount.
  const { data: row, error: readError } = await sb
    .from("inquiries")
    .select("share_views, shared_at")
    .eq("share_token", token)
    .maybeSingle();
  if (readError) {
    console.error("[trip-view] read failed", readError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!row) {
    // Token doesn't match a row — silently 200 so we don't leak
    // existence/non-existence to a guesser.
    return NextResponse.json({ ok: true, deduped: false });
  }

  const next = (row.share_views as number | null) ?? 0;
  const update: Record<string, unknown> = {
    share_views: next + 1,
  };
  if (!row.shared_at) {
    update.shared_at = new Date().toISOString();
  }

  const { error: updateError } = await sb
    .from("inquiries")
    .update(update)
    .eq("share_token", token);
  if (updateError) {
    console.error("[trip-view] update failed", updateError);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, deduped: false });
  res.cookies.set(cookieName, "1", {
    maxAge: COOKIE_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
