/**
 * POST /api/trip-vote/[token] — register or update a vote (yes /
 * maybe / no) on a trip from a friend in the group chat.
 *
 * Idempotent per viewer: the (inquiry_id, viewer_id) primary key
 * means a friend who taps a different button just updates their
 * existing row. No name / email — just the vote.
 */

import { NextResponse, type NextRequest } from "next/server";

import { ensureViewerId } from "@/lib/share/viewerId";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;
const VOTE_RE = /^(yes|maybe|no)$/;

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface VoteBody {
  vote?: unknown;
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  let body: VoteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const vote =
    typeof body.vote === "string" && VOTE_RE.test(body.vote)
      ? (body.vote as "yes" | "maybe" | "no")
      : null;
  if (!vote) {
    return NextResponse.json({ error: "invalid vote" }, { status: 400 });
  }

  const sb = supabaseServer();
  // Resolve the inquiry from the token. We don't expose the row id
  // in the response — the viewer's vote row uses inquiry_id under
  // the hood, but the friend stays unaware of the internal id.
  const { data: row, error: readError } = await sb
    .from("inquiries")
    .select("id, share_token, shared_at")
    .eq("share_token", token)
    .maybeSingle();
  if (readError) {
    console.error("[trip-vote] read failed", readError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }

  // Fresh response we'll return — `ensureViewerId` may set the
  // viewer cookie on this same response, so we have to allocate
  // it before the cookie call.
  const tally = { yes: 0, maybe: 0, no: 0, total: 0 };
  const res = NextResponse.json({ ok: true, tally });
  const viewerId = ensureViewerId(req, res);

  const { error: upsertError } = await sb.from("trip_votes").upsert(
    {
      inquiry_id: row.id as string,
      viewer_id: viewerId,
      vote,
      voted_at: new Date().toISOString(),
    },
    { onConflict: "inquiry_id,viewer_id" },
  );
  if (upsertError) {
    console.error("[trip-vote] upsert failed", upsertError);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }

  // Pull the fresh tally + return it so the client can flip to
  // the post-vote "reveal" state without a second round trip.
  const { data: voteRows } = await sb
    .from("trip_votes")
    .select("vote")
    .eq("inquiry_id", row.id as string);
  for (const r of (voteRows ?? []) as Array<{ vote: string }>) {
    if (r.vote === "yes") tally.yes++;
    else if (r.vote === "maybe") tally.maybe++;
    else if (r.vote === "no") tally.no++;
  }
  tally.total = tally.yes + tally.maybe + tally.no;

  // Re-build the response body now that we have real numbers,
  // preserving the cookie headers that ensureViewerId set.
  const final = NextResponse.json({ ok: true, tally });
  res.cookies.getAll().forEach((c) => final.cookies.set(c));
  return final;
}
