/**
 * POST /api/trip-reserve/[token] — friend leaves name+email after
 * tapping "Reserve my stay" on the trip portal. Saves a row in
 * `trip_reservations` (idempotent per viewer) and fires Abe a
 * notification email so he can manually loop them in.
 *
 * Validation kept lean: trim + length cap on name, email regex
 * check. Anything beyond that is Abe's judgment when he reaches
 * out.
 */

import { NextResponse, type NextRequest } from "next/server";

import { sendHostReservationNotice } from "@/lib/email/hostReservationNotice";
import { ensureViewerId } from "@/lib/share/viewerId";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LEN = 80;

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface ReserveBody {
  name?: unknown;
  email?: unknown;
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  let body: ReserveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LEN) : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data: row, error: readError } = await sb
    .from("inquiries")
    .select("id, name, email, arrival, departure")
    .eq("share_token", token)
    .maybeSingle();
  if (readError) {
    console.error("[trip-reserve] read failed", readError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  const viewerId = ensureViewerId(req, res);

  const { error: upsertError } = await sb.from("trip_reservations").upsert(
    {
      inquiry_id: row.id as string,
      viewer_id: viewerId,
      name,
      email,
      reserved_at: new Date().toISOString(),
    },
    { onConflict: "inquiry_id,viewer_id" },
  );
  if (upsertError) {
    console.error("[trip-reserve] upsert failed", upsertError);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }

  // Host notification — fire and log. Don't block the response on
  // email delivery; the row write is the source of truth.
  const arrival = row.arrival as string;
  const departure = row.departure as string;
  const a = new Date(arrival + "T00:00:00");
  const d = new Date(departure + "T00:00:00");
  const nights = Math.max(
    1,
    Math.round((d.getTime() - a.getTime()) / 86_400_000),
  );
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  void sendHostReservationNotice({
    bookerName: (row.name as string) ?? "",
    bookerEmail: (row.email as string) ?? "",
    arrival,
    departure,
    nights,
    friendName: name,
    friendEmail: email,
    tripUrl: `${origin}/trip/${token}`,
  }).catch((err) => {
    console.error("[trip-reserve] email failed", err);
  });

  return res;
}
