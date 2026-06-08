/**
 * Chat-session mirror to VenueMBA.
 *
 * The inquiry-agent harness fires this at milestones (qualified_complete,
 * handoff, booked) so VenueMBA's SMS agent can pick up the context and
 * keep the conversation going by text. Abandonment mirrors are
 * different (no LLM call, cron-driven) and share the same shape.
 *
 * One-way write. Idempotent on `session_id` — VenueMBA's inbound
 * endpoint upserts on sourceId, so firing the same milestone twice
 * just updates the existing record.
 *
 * Builds on the booking-funnel mirror pattern in venuembaSync.ts
 * (same endpoint, same header secret, same workspace slug) but with a
 * chat-specific payload packed into customFields.
 */

import type { InquirySessionRow, MirrorReason, TurnMessage } from "./types";

const WORKSPACE_SLUG = "the-jackpot";

/** Subset of inquiry_session.slots the VMBA payload needs. Everything
 *  else gets passed through in customFields.chat_slots as-is. */
interface KnownSlots {
  name?: string;
  email?: string;
  phone?: string;
  arrival?: string;
  departure?: string;
  guest_count?: number;
  occasion?: string;
}

function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("+")) {
    return /^\+[1-9]\d{1,14}$/.test(digits) ? digits : undefined;
  }
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return undefined;
}

function pickKnown(slots: Record<string, unknown>): KnownSlots {
  return {
    name: typeof slots.name === "string" ? slots.name : undefined,
    email: typeof slots.email === "string" ? slots.email : undefined,
    phone: typeof slots.phone === "string" ? slots.phone : undefined,
    arrival: typeof slots.arrival === "string" ? slots.arrival : undefined,
    departure: typeof slots.departure === "string" ? slots.departure : undefined,
    guest_count:
      typeof slots.guest_count === "number" ? slots.guest_count : undefined,
    occasion: typeof slots.occasion === "string" ? slots.occasion : undefined,
  };
}

export interface MirrorResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** True when the mirror was deliberately not sent because we didn't
   *  have enough data yet (e.g. no email). */
  skipped?: boolean;
  skip_reason?: string;
}

/**
 * Fire the mirror. Returns a MirrorResult that gets recorded into
 * agent_activity.actions_executed. Never throws — fail-quiet pattern.
 */
export async function mirrorSessionToVenueMBA(
  session: InquirySessionRow,
  event: MirrorReason,
  routingReason: string,
  routingExtras?: {
    handoff_reason?: string | null;
    handoff_priority?: string | null;
  },
): Promise<MirrorResult> {
  const baseUrl = process.env.VENUEMBA_WEBHOOK_URL;
  const secret = process.env.VENUEMBA_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    return { ok: false, skipped: true, skip_reason: "webhook_not_configured" };
  }

  const known = pickKnown(session.slots as Record<string, unknown>);

  // VMBA validates email server-side. Skip the fire if we don't have
  // one yet — there's nothing useful for the SMS agent to follow up on.
  if (!known.email) {
    return { ok: false, skipped: true, skip_reason: "no_email_captured" };
  }
  if (!known.name) {
    return { ok: false, skipped: true, skip_reason: "no_name_captured" };
  }

  const transcript: TurnMessage[] = session.transcript ?? [];
  const turnCount = transcript.filter(
    (m) => m.role === "user" || m.role === "olivia",
  ).length;

  const body = {
    sourceId: session.id,
    name: known.name,
    email: known.email,
    phone: normalizePhone(known.phone),
    inquiry: {
      eventDate: known.arrival,
      eventType: known.occasion,
      guestCount: known.guest_count,
    },
    customFields: {
      source: "jackpot_chat",
      event,
      session_id: session.id,
      session_phase: session.phase,
      routing_reason: routingReason,
      handoff_reason: routingExtras?.handoff_reason ?? null,
      handoff_priority: routingExtras?.handoff_priority ?? null,
      chat_slots: session.slots,
      chat_signals: session.signals,
      chat_transcript: transcript,
      turn_count: turnCount,
      created_at: session.created_at,
      last_activity_at: session.last_activity_at,
    },
  };

  const url = `${baseUrl.replace(/\/$/, "")}/api/inbound/${WORKSPACE_SLUG}/inquiry`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 500),
      };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
