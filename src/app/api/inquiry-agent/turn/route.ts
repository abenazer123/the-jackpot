/**
 * POST /api/inquiry-agent/turn — the chat-agent turn endpoint.
 *
 * Phase 1: real LLM turns via runInquiryAgent(). Widget-confirm tokens
 * stay deterministic (no Claude call); free-text messages flow through
 * the harness.
 *
 * Contract:
 *   request  → TurnRequestSchema  (src/lib/inquiry-agent/validation.ts)
 *   response → TurnResponseSchema (same)
 */

import { NextResponse, type NextRequest } from "next/server";

import { runInquiryAgent } from "@/lib/inquiry-agent/harness";
import { PhaseSchema, TurnRequestSchema } from "@/lib/inquiry-agent/validation";
import type {
  ExtractedSlots,
  InquirySessionRow,
  Phase,
  Signals,
  TurnMessage,
  TurnResponse,
} from "@/lib/inquiry-agent/types";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// Tokens the frontend sends for deterministic widget commits — these
// don't go through the LLM. They're committed by the route directly.
const WIDGET_CONFIRM_PREFIXES = ["[CONFIRM:", "[COMMIT:", "[ACCEPT:"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse + validate request
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = TurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const turn = parsed.data;

  const supabase = supabaseServer();
  const now = new Date().toISOString();

  // 2. Resolve or create session
  let session: InquirySessionRow;

  if (turn.session_id === null) {
    const userAgent = req.headers.get("user-agent");
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? null;

    const { data, error } = await supabase
      .from("inquiry_session")
      .insert({
        phase: "state1",
        utm: turn.client_context.utm ?? null,
        user_agent: userAgent,
        ip,
        slots: turn.client_context.slots ?? {},
        signals: turn.client_context.signals ?? {},
        transcript: [],
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "session_create_failed", details: error?.message },
        { status: 500 },
      );
    }
    session = data as InquirySessionRow;
  } else {
    const { data, error } = await supabase
      .from("inquiry_session")
      .select("*")
      .eq("id", turn.session_id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "session_not_found", session_id: turn.session_id },
        { status: 404 },
      );
    }
    session = data as InquirySessionRow;
  }

  // 3. Append the guest message to the transcript
  const userMessage: TurnMessage = {
    role: turn.message.role,
    body: turn.message.body,
    ts: turn.message.ts,
    ...(turn.message.widget ? { widget: turn.message.widget } : {}),
    ...(turn.message.widget_payload ? { widget_payload: turn.message.widget_payload } : {}),
  };

  // 4. Branch: widget-confirm tokens stay deterministic. Free-text,
  //    direct messages, and synthetic system events go through the
  //    harness.
  const isWidgetConfirm =
    turn.commit === true ||
    WIDGET_CONFIRM_PREFIXES.some((p) => turn.message.body.startsWith(p));

  let oliviaReply: TurnMessage;
  let slotsUpdate: Partial<ExtractedSlots> = {};
  let signalsUpdate: Partial<Signals> = {};
  const nextPhase: Phase | null = null;
  let mirrorFired: { event: string; at: string } | null = null;
  let harnessWidgets: Array<{ type: string; payload: Record<string, unknown> }> = [];
  let inquiryIdLinked: string | null = null;
  let advanceToPricing = false;

  if (isWidgetConfirm) {
    // Acknowledge the commit without calling Claude. Persist whatever
    // the scripted widget has captured so far (contact, trip basics,
    // qualify signals) by merging the client_context into the session.
    // This is how the no-intent "Check dates & price" flow records its
    // lead and lets a later reserve attach to a real session.
    slotsUpdate = (turn.client_context.slots ?? {}) as Partial<ExtractedSlots>;
    signalsUpdate = (turn.client_context.signals ?? {}) as Partial<Signals>;
    // Store the scripted Olivia line opposite the guest's choice so the
    // transcript reads as a real conversation, not commit markers.
    oliviaReply = {
      role: "olivia",
      body:
        turn.agent_line && turn.agent_line.trim()
          ? turn.agent_line
          : "(widget commit recorded)",
      ts: new Date().toISOString(),
    };
  } else {
    // Free-text guest message OR a synthetic system event (e.g. price
    // card just rendered) → harness owns the turn.
    const trigger = userMessage.role === "system"
      ? "system_event"
      : session.transcript.length === 0
        ? "free_text_first"
        : "guest_message";
    const result = await runInquiryAgent({
      session,
      guestMessage: userMessage,
      trigger,
    });
    oliviaReply = result.reply;
    slotsUpdate = result.slotsUpdate;
    signalsUpdate = result.signalsUpdate;
    mirrorFired = result.mirrorFired;
    harnessWidgets = result.widgets;
    inquiryIdLinked = result.inquiryIdLinked;
    advanceToPricing = result.advanceToPricing;
    // Phase 1: don't auto-transition phase. Phase 2 will.
  }

  // 5. Persist transcript + slot/signal updates + activity bump
  const updatedTranscript = [...session.transcript, userMessage, oliviaReply];
  const updatedSlots = { ...session.slots, ...slotsUpdate };
  const updatedSignals = { ...session.signals, ...signalsUpdate };

  const updatePayload: Record<string, unknown> = {
    transcript: updatedTranscript,
    slots: updatedSlots,
    signals: updatedSignals,
    last_activity_at: now,
  };
  // Phase write-back: the client reports the real UI phase
  // (stepToPhase(step) on the frontend, or an explicit phase on
  // system-event triggers). Persist it so the stored phase tracks the
  // conversation instead of being frozen at state1. Validated against
  // the enum; terminal phases set by the harness/cron are never
  // downgraded by a client report.
  const TERMINAL = new Set(["awaiting_abe", "booked", "abandoned", "disqualified", "handoff_complete"]);
  const reportedPhase = PhaseSchema.safeParse(turn.client_context.phase);
  if (
    reportedPhase.success &&
    reportedPhase.data !== session.phase &&
    !TERMINAL.has(session.phase)
  ) {
    updatePayload.phase = reportedPhase.data;
  }
  if (nextPhase) updatePayload.phase = nextPhase;
  if (mirrorFired) {
    updatePayload.last_mirror_event = mirrorFired.event;
    updatePayload.last_mirror_at = mirrorFired.at;
  }
  if (inquiryIdLinked) {
    updatePayload.inquiry_id = inquiryIdLinked;
  }

  const { error: updateError } = await supabase
    .from("inquiry_session")
    .update(updatePayload)
    .eq("id", session.id);

  if (updateError) {
    return NextResponse.json(
      { error: "session_update_failed", details: updateError.message },
      { status: 500 },
    );
  }

  // 6. Return turn response. extracted_slots lets the frontend pre-fill
  //    scripted widgets so the guest doesn't re-enter info Olivia
  //    already parsed from their message. widgets carries any
  //    show_widget renders (share_link, etc).
  const response: TurnResponse = {
    session_id: session.id,
    phase: (updatePayload.phase ?? session.phase) as Phase,
    messages: [oliviaReply],
    widgets: harnessWidgets,
    extracted_slots: slotsUpdate as Record<string, unknown>,
    advance_to_pricing: advanceToPricing,
  };

  return NextResponse.json(response);
}
