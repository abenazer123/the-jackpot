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
import { TurnRequestSchema } from "@/lib/inquiry-agent/validation";
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
        signals: {},
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
  const isWidgetConfirm = WIDGET_CONFIRM_PREFIXES.some((p) =>
    turn.message.body.startsWith(p),
  );

  let oliviaReply: TurnMessage;
  let slotsUpdate: Partial<ExtractedSlots> = {};
  let signalsUpdate: Partial<Signals> = {};
  const nextPhase: Phase | null = null;
  let mirrorFired: { event: string; at: string } | null = null;

  if (isWidgetConfirm) {
    // Phase 1: acknowledge the commit without calling Claude. Widget
    // commit semantics (advancing phase, writing the typed slot) are a
    // Phase 2 concern — for now we just record the token.
    oliviaReply = {
      role: "olivia",
      body: "(widget commit recorded. Phase 2 will handle widget semantics)",
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
  if (nextPhase) updatePayload.phase = nextPhase;
  if (mirrorFired) {
    updatePayload.last_mirror_event = mirrorFired.event;
    updatePayload.last_mirror_at = mirrorFired.at;
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
  //    already parsed from their message.
  const response: TurnResponse = {
    session_id: session.id,
    phase: (nextPhase ?? session.phase) as Phase,
    messages: [oliviaReply],
    widgets: [],
    extracted_slots: slotsUpdate as Record<string, unknown>,
  };

  return NextResponse.json(response);
}
