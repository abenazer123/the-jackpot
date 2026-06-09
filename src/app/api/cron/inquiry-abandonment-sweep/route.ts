/**
 * GET /api/cron/inquiry-abandonment-sweep
 *
 * Sweeps inquiry_session rows that have gone idle past the threshold
 * without reaching a terminal state, mirrors them to VenueMBA with
 * event = "abandonment" so the SMS agent can follow up by text, then
 * marks the session as abandoned so it doesn't get swept again.
 *
 * Vercel Cron schedule lives in vercel.json (every 10 minutes). Auth
 * uses the same `Authorization: Bearer ${CRON_SECRET}` pattern as
 * pricelabs-sync.
 *
 * Threshold: 15 minutes since last_activity_at. Configurable via the
 * INQUIRY_ABANDONMENT_THRESHOLD_MIN env var (integer minutes).
 *
 * Gating to avoid noise:
 *   - terminal phases skipped (awaiting_abe, booked, abandoned,
 *     disqualified, handoff_complete)
 *   - last_mirror_event = "abandonment" skipped (already fired)
 *   - missing name or email skipped (the mirror itself would refuse
 *     these anyway; cheaper to filter upfront)
 */

import { NextResponse, type NextRequest } from "next/server";

import { mirrorSessionToVenueMBA } from "@/lib/inquiry-agent/mirror";
import type { InquirySessionRow } from "@/lib/inquiry-agent/types";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_THRESHOLD_MIN = 15;
const SCAN_LIMIT = 100;

const TERMINAL_PHASES = new Set([
  "awaiting_abe",
  "booked",
  "abandoned",
  "disqualified",
  "handoff_complete",
]);

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function thresholdMinutes(): number {
  const raw = process.env.INQUIRY_ABANDONMENT_THRESHOLD_MIN;
  if (!raw) return DEFAULT_THRESHOLD_MIN;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_MIN;
}

interface SweepResult {
  ok: true;
  scanned: number;
  mirrored: number;
  skipped_missing_contact: number;
  skipped_mirror_failed: number;
  threshold_min: number;
  details: Array<{ session_id: string; outcome: string }>;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const minutes = thresholdMinutes();
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const supabase = supabaseServer();

  // Find candidates. Index on (phase, last_activity_at) supports this
  // filter (see supabase/migrations/20260606120000_inquiry_agent_tables.sql).
  const { data: sessions, error } = await supabase
    .from("inquiry_session")
    .select("*")
    .lt("last_activity_at", cutoff)
    .not("last_mirror_event", "eq", "abandonment")
    .limit(SCAN_LIMIT);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const result: SweepResult = {
    ok: true,
    scanned: 0,
    mirrored: 0,
    skipped_missing_contact: 0,
    skipped_mirror_failed: 0,
    threshold_min: minutes,
    details: [],
  };

  for (const raw of sessions ?? []) {
    const session = raw as InquirySessionRow;
    result.scanned += 1;

    if (TERMINAL_PHASES.has(session.phase)) {
      result.details.push({ session_id: session.id, outcome: "skipped_terminal" });
      continue;
    }

    const slots = session.slots as Record<string, unknown>;
    if (typeof slots.email !== "string" || typeof slots.name !== "string") {
      result.skipped_missing_contact += 1;
      result.details.push({
        session_id: session.id,
        outcome: "skipped_missing_contact",
      });
      continue;
    }

    const mirror = await mirrorSessionToVenueMBA(
      session,
      "abandonment",
      `Idle ${minutes}+ minutes since last activity at ${session.last_activity_at}`,
      { handoff_reason: null, handoff_priority: null },
    );

    if (!mirror.ok) {
      result.skipped_mirror_failed += 1;
      result.details.push({
        session_id: session.id,
        outcome: mirror.skipped
          ? `skipped_${mirror.skip_reason ?? "unknown"}`
          : `mirror_failed_${mirror.status ?? "no_status"}`,
      });
      continue;
    }

    // Mirror landed. Mark the session abandoned + record the fire so
    // we don't re-sweep it on the next tick.
    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("inquiry_session")
      .update({
        phase: "abandoned",
        last_mirror_event: "abandonment",
        last_mirror_at: now,
        terminal_reason: "idle_timeout",
        terminal_at: now,
      })
      .eq("id", session.id);

    if (upErr) {
      result.details.push({
        session_id: session.id,
        outcome: `mirrored_but_update_failed: ${upErr.message}`,
      });
      continue;
    }

    result.mirrored += 1;
    result.details.push({ session_id: session.id, outcome: "mirrored" });
  }

  return NextResponse.json(result);
}
