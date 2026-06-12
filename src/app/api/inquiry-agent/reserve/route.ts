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
  // Phone is required everywhere we capture a lead, not optional.
  phone: z.string().min(7),
  // Optional second-step: the guest's chosen window for the lock-in
  // call with Abe. When present, this is the "schedule" call that
  // updates the existing reserve row.
  call_window: z.string().optional(),
  // Qualify-beat answers captured at the price reveal. Folded into the
  // session signals so Abe sees the guest's stage + deciding power.
  decision_timeline: z.string().optional(),
  decision_makers: z.string().optional(),
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
  const {
    session_id,
    name,
    email,
    phone,
    call_window,
    decision_timeline,
    decision_makers,
  } = parsed.data;
  const isScheduleStep = typeof call_window === "string" && call_window.length > 0;

  const supabase = supabaseServer();
  const { data: sessionRow, error: sErr } = await supabase
    .from("inquiry_session")
    .select("*")
    .eq("id", session_id)
    .single();
  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // Merge the qualify-beat signals into the session's existing signals.
  const existingSignals = (sessionRow.signals ?? {}) as Record<string, unknown>;
  const mergedSignals: Record<string, unknown> = { ...existingSignals };
  if (decision_timeline) mergedSignals.decision_timeline = decision_timeline;
  if (decision_makers) mergedSignals.decision_makers = decision_makers;
  const signalsChanged =
    JSON.stringify(mergedSignals) !== JSON.stringify(existingSignals);

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
  const reserveFields = {
    name,
    email,
    phone: phone || "",
    source: "chat_reserve",
    reserved_at: now,
    ...(isScheduleStep ? { reserve_call_window: call_window } : {}),
  };
  if (inquiryId) {
    await supabase.from("inquiries").update(reserveFields).eq("id", inquiryId);
  } else {
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        arrival,
        departure,
        guests,
        reason: occasion,
        quote_snapshot: quote,
        quote_total_cents: quote?.totalCents ?? null,
        ...reserveFields,
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
      .update({
        inquiry_id: inquiryId,
        last_activity_at: now,
        ...(signalsChanged ? { signals: mergedSignals } : {}),
      })
      .eq("id", session_id);
  }

  // Persist the qualify signals on the reuse path too (the create path
  // already folded them into the update above).
  if (inquiryId && signalsChanged && sessionRow.inquiry_id) {
    await supabase
      .from("inquiry_session")
      .update({ signals: mergedSignals, last_activity_at: now })
      .eq("id", session_id);
  }

  // Notify Abe — this is a hot lead holding dates with no payment.
  type TMsg = { role: string; body: string; ts: string };
  const recentTranscript = ((sessionRow.transcript ?? []) as TMsg[])
    .filter((m) => m.role === "user" || m.role === "olivia")
    .slice(-6)
    .map((m) => ({ role: m.role, body: m.body, ts: m.ts }));

  const reason = isScheduleStep
    ? `Call booked: ${name} is free "${call_window}" to lock in ${arrival} to ${departure} for ${guests}. Reach out then.`
    : `Reserved with no payment, holding ${arrival} to ${departure} for ${guests}. Picking a call time next.`;

  await sendAbeNotification({
    sessionId: session_id,
    reason,
    urgency: "high",
    transcriptUrl: `${siteOrigin()}/admin/sessions/${session_id}`,
    slots: { ...slots, name, email, phone, reserve_call_window: call_window },
    signals: mergedSignals,
    recentTranscript,
  });

  return NextResponse.json({ ok: true, inquiry_id: inquiryId });
}
