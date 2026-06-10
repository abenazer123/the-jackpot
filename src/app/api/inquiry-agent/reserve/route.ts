/**
 * POST /api/inquiry-agent/reserve — soft "reserve with no payment".
 *
 * The anti-drop-off mechanic. Captures the guest's info, creates a
 * flagged inquiry row (source=chat_reserve), and notifies Abe so he can
 * reach out to lock the hold in. No Stripe, no calendar block in v1.
 *
 * The 5-minute-call scheduler (the "guarantee" step) is a follow-up;
 * for now the confirmation tells the guest Abe will reach out, and the
 * notify email flags it as a reserve.
 *
 * Idempotent-ish: if the session already links to an inquiry, we update
 * that row to reserved rather than create a duplicate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { sendAbeNotification } from "@/lib/email/abeNotification";
import { computeQuote } from "@/lib/pricing/computeQuote";
import { siteOrigin } from "@/lib/siteOrigin";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ReserveSchema = z.object({
  session_id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(""),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ReserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { session_id, name, email, phone } = parsed.data;

  const supabase = supabaseServer();
  const { data: sessionRow, error: sErr } = await supabase
    .from("inquiry_session")
    .select("*")
    .eq("id", session_id)
    .single();
  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const slots = (sessionRow.slots ?? {}) as Record<string, unknown>;
  const arrival = typeof slots.arrival === "string" ? slots.arrival : null;
  const departure = typeof slots.departure === "string" ? slots.departure : null;
  const guests = typeof slots.guest_count === "number" ? slots.guest_count : null;
  const occasion = typeof slots.occasion === "string" ? slots.occasion : "Other";

  if (!arrival || !departure || !guests) {
    return NextResponse.json(
      { error: "missing_trip_basics" },
      { status: 400 },
    );
  }

  // Best-effort quote snapshot (cache-only; never block the reserve).
  const q = await computeQuote({ arrival, departure, guests, occasion });
  const quote = q.ok ? q.quote : null;

  const now = new Date().toISOString();

  // Reuse the linked inquiry if one exists; otherwise create.
  let inquiryId = sessionRow.inquiry_id;
  if (inquiryId) {
    await supabase
      .from("inquiries")
      .update({
        name,
        email,
        phone: phone || "",
        source: "chat_reserve",
      })
      .eq("id", inquiryId);
  } else {
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        arrival,
        departure,
        email,
        name,
        phone: phone || "",
        guests,
        reason: occasion,
        source: "chat_reserve",
        quote_snapshot: quote,
        quote_total_cents: quote?.totalCents ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "reserve_failed", details: error?.message },
        { status: 500 },
      );
    }
    inquiryId = data.id;
    await supabase
      .from("inquiry_session")
      .update({ inquiry_id: inquiryId, last_activity_at: now })
      .eq("id", session_id);
  }

  // Notify Abe — this is a hot lead holding dates with no payment.
  type TMsg = { role: string; body: string; ts: string };
  const recentTranscript = ((sessionRow.transcript ?? []) as TMsg[])
    .filter((m) => m.role === "user" || m.role === "olivia")
    .slice(-6)
    .map((m) => ({ role: m.role, body: m.body, ts: m.ts }));

  await sendAbeNotification({
    sessionId: session_id,
    reason: `Reserved with no payment, holding ${arrival} to ${departure} for ${guests}. Reach out to lock it in.`,
    urgency: "high",
    transcriptUrl: `${siteOrigin()}/admin/sessions/${session_id}`,
    slots: { ...slots, name, email, phone },
    signals: (sessionRow.signals ?? {}) as Record<string, unknown>,
    recentTranscript,
  });

  return NextResponse.json({ ok: true, inquiry_id: inquiryId });
}
