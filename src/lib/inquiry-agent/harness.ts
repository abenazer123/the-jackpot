/**
 * Inquiry-agent harness — Phase 1.
 *
 * One Claude call per guest message. Forced `tool_choice` produces a
 * structured `qualify_result` output. The harness validates with Zod,
 * gates actions by confidence, and persists the turn.
 *
 * Phase-1 scope intentionally narrow:
 *   - Only the post-price LLM moment is wired (route handler decides
 *     when to call us; harness doesn't gate by phase).
 *   - Only `send_message` and `commit_facts` actions execute. Others
 *     get recorded but logged as `not_implemented_yet`.
 *   - One provider, inlined: ConversationProvider (transcript +
 *     current slots). PropertyProvider / PricingProvider /
 *     AvailabilityProvider land in Phase 2.
 *   - No streaming. Single non-streaming call with adaptive thinking.
 *
 * Companion docs:
 *   docs/inquiry-agent-intel-brief-2026-06-05.md       (slot spec)
 *   docs/inquiry-agent-simulation-2026-06-05.md        (walkthrough)
 *   docs/venuemba-harness-analysis-2026-05-20.md       (architecture)
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { supabaseServer } from "@/lib/supabase-server";

import { QualifyResultSchema } from "./validation";
import {
  type Action,
  type ActivityStatus,
  type AgentActivityRow,
  DEFAULT_THRESHOLDS,
  type DraftedAction,
  type ExecutedAction,
  type ExtractedSlots,
  type InquirySessionRow,
  type QualifyResult,
  type Signals,
  type SkippedAction,
  type ToolName,
  type TurnMessage,
} from "./types";

// ──────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────

const MODEL = "claude-opus-4-7";
const PROMPT_VERSION = "v1";
const SKILL = "inquiry";
const MAX_TOKENS = 16_000;

/** Tools the harness actually executes in Phase 1. Anything else gets
 *  logged as a skipped action with reason `not_implemented_yet`. */
const PHASE_1_EXECUTABLE_TOOLS = new Set<ToolName>([
  "send_message",
  "commit_facts",
]);

/** Hard-trigger patterns — bypass Claude entirely when matched. */
const HARD_TRIGGERS: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /\b(talk to|speak to|call) (abe|a human|someone|the owner)\b/i, intent: "human_request" },
  { pattern: /\b(can i talk to|need to speak with) abe\b/i, intent: "human_request" },
  { pattern: /^(stop|unsubscribe|cancel)$/i, intent: "stop_requested" },
];

// ──────────────────────────────────────────────────────────────────
// System prompt loading (cached)
// ──────────────────────────────────────────────────────────────────

let cachedSystemPrompt: string | null = null;

function loadSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const dir = path.join(process.cwd(), "src/lib/inquiry-agent/prompts", PROMPT_VERSION);
  const files = ["system.md", "role.md", "objections.md", "fact-sheet.md"];
  const parts = files.map((f) => readFileSync(path.join(dir, f), "utf8").trim());
  cachedSystemPrompt = parts.join("\n\n---\n\n");
  return cachedSystemPrompt;
}

// ──────────────────────────────────────────────────────────────────
// Tool input_schema — hand-written JSON Schema for the qualify_result
// tool. Mirrors validation.ts shape but only includes the Action
// variants Phase 1 ships (send_message, commit_facts). Adding tools
// in Phase 2 is an additive change here.
// ──────────────────────────────────────────────────────────────────

const QUALIFY_RESULT_TOOL: Anthropic.Tool = {
  name: "qualify_result",
  description:
    "Return your structured response for this turn. EVERY reply must use this tool. It is your only way to communicate. Include the next message to the guest, any slots you extracted, signals you inferred, routing decision, and proposed actions.",
  input_schema: {
    type: "object",
    required: [
      "summary_for_human",
      "extracted_slots",
      "signals",
      "routing",
      "next_message",
      "actions",
      "overall_confidence",
    ],
    properties: {
      summary_for_human: {
        type: "string",
        description: "1 to 3 sentence summary for Abe. What the guest said, what you decided this turn.",
      },
      extracted_slots: {
        type: "object",
        description: "Facts you parsed from the guest's latest message. Omit slots you can't confidently extract. Never invent.",
        required: ["confidence"],
        properties: {
          price_response: { type: "string", enum: ["happy", "stretched", "too_high", "open", "unknown"] },
          date_flexibility: { type: "string", enum: ["none", "mid_week", "off_peak", "any_window", "unknown"] },
          alternatives_considered: { type: "array", items: { type: "string" } },
          must_haves_canonical: {
            type: "array",
            items: { type: "string", enum: ["cinema", "hot_tub", "bar", "courtyard", "kitchen", "sleeping_setup", "walkable", "parking"] },
          },
          must_haves_freeform: { type: "array", items: { type: "string" } },
          decision_makers: { type: "string", enum: ["solo", "partner", "crew", "unknown"] },
          decision_timeline: { type: "string", enum: ["immediate", "this_week", "this_month", "flexible", "unknown"] },
          send_to_group_intent: { type: ["boolean", "null"] },
          returning_visitor: { type: ["boolean", "null"] },
          objections: { type: "array", items: { type: "string" } },
          sleeping_setup_needs: { type: "array", items: { type: "string" } },
          dietary_plan: { type: "string", enum: ["cook_in", "order_in", "restaurants", "mixed", "unknown"] },
          arrival_logistics: { type: "string", enum: ["driving", "flying", "mixed", "unknown"] },
          add_on_interest: { type: "array", items: { type: "string" } },
          photo_intent: { type: ["boolean", "null"] },
          neighborhood_comfort: { type: "string", enum: ["known", "new", "unknown"] },
          concession_accepted: { type: ["string", "null"] },
          confidence: {
            type: "object",
            description: "Per-slot confidence 0 to 1. `overall` required; per-slot keys optional.",
            required: ["overall"],
            properties: { overall: { type: "number", minimum: 0, maximum: 1 } },
          },
        },
      },
      signals: {
        type: "object",
        description: "Your running read of the conversation, updated every turn.",
        required: ["stage", "urgency", "fit", "complexity", "sentiment", "intent"],
        properties: {
          stage: { type: "string", enum: ["early", "mid", "late", "unknown"] },
          urgency: { type: "string", enum: ["low", "medium", "high", "unknown"] },
          fit: { type: "string", enum: ["good", "maybe", "poor", "unknown"] },
          complexity: { type: "string", enum: ["low", "medium", "high"] },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          intent: {
            type: "string",
            enum: [
              "pricing_negotiation",
              "date_flex_probe",
              "alternates_compare",
              "send_to_group",
              "book",
              "human_request",
              "info_request",
              "objection",
              "other",
            ],
          },
          objections: { type: "array", items: { type: "string" } },
          next_question_key: { type: ["string", "null"] },
          reasoning: { type: ["string", "null"], description: "One-line internal rationale for the turn." },
        },
      },
      routing: {
        type: "object",
        required: ["next_step", "reason", "should_handoff", "should_mirror_to_venuemba"],
        properties: {
          next_step: {
            type: "string",
            enum: [
              "clarify",
              "concession_offer",
              "share_to_group",
              "callback_schedule",
              "nurture",
              "abandon",
              "book",
              "immediate_handoff",
              "disqualify",
            ],
          },
          reason: { type: "string" },
          should_handoff: { type: "boolean" },
          handoff_priority: { type: ["string", "null"], enum: ["low", "normal", "high", "urgent", null] },
          handoff_reason: { type: ["string", "null"] },
          should_mirror_to_venuemba: { type: "boolean" },
          mirror_reason: { type: ["string", "null"], enum: ["qualified_complete", "abandonment", "handoff", "booked", null] },
        },
      },
      next_message: {
        type: "object",
        required: ["body"],
        properties: {
          body: { type: "string", description: "What the guest sees next. One reply, one question max." },
          widgets_to_show: { type: "array", items: { type: "string" } },
        },
      },
      agent_state_patch: {
        type: ["object", "null"],
        properties: {
          phase: { type: ["string", "null"] },
          asked_keys: { type: ["array", "null"], items: { type: "string" } },
        },
      },
      actions: {
        type: "array",
        description:
          "Proposed tool calls. The harness executes them per-action by confidence threshold. Phase 1 ships `send_message` and `commit_facts` only.",
        items: {
          oneOf: [
            {
              type: "object",
              required: ["tool", "input", "confidence"],
              properties: {
                tool: { const: "send_message" },
                input: {
                  type: "object",
                  required: ["body"],
                  properties: {
                    body: { type: "string" },
                    widget: { type: "string" },
                  },
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                rationale: { type: ["string", "null"] },
              },
            },
            {
              type: "object",
              required: ["tool", "input", "confidence"],
              properties: {
                tool: { const: "commit_facts" },
                input: {
                  type: "object",
                  required: ["slots"],
                  properties: {
                    slots: { type: "object" },
                    confidence: { type: "object" },
                  },
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                rationale: { type: ["string", "null"] },
              },
            },
          ],
        },
      },
      overall_confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  },
};

// ──────────────────────────────────────────────────────────────────
// Output sanitization: hard brand rule
// ──────────────────────────────────────────────────────────────────
//
// Every dash character is banned in AI-authored text the guest sees.
// That includes em (—, U+2014), en (–, U+2013), hyphen-minus (-,
// U+002D), and non-breaking hyphen (‑, U+2011). Belt-and-suspenders:
// (1) the prompt forbids them, (2) anything that slips through the
// prompt gets cleaned here before it hits the guest.
//
// Strategy:
//   1. Em / en dashes (commonly used as sentence breaks) collapse with
//      surrounding whitespace into a comma-space.
//   2. Any remaining hyphen-minus or non-breaking hyphen becomes a
//      space. "mid-week" becomes "mid week"; "Thursday-Saturday"
//      becomes "Thursday Saturday".
//   3. Trim, collapse whitespace, strip stray leading commas.

export function sanitizeGuestText(s: string): string {
  return s
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/[\u002D\u2011]/g, " ")
    .replace(/^,\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ──────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────

export interface RunInquiryAgentInput {
  session: InquirySessionRow;
  guestMessage: TurnMessage;
  trigger: string;
}

export interface RunInquiryAgentOutput {
  reply: TurnMessage;
  slotsUpdate: Partial<ExtractedSlots>;
  signalsUpdate: Partial<Signals>;
  routingNextStep: string | null;
  hardTriggerBlocked: { reason: string; intent: string } | null;
}

export async function runInquiryAgent(
  input: RunInquiryAgentInput,
): Promise<RunInquiryAgentOutput> {
  const { session, guestMessage, trigger } = input;
  const startedAt = Date.now();

  // ─── 1. Hard-trigger pre-check ─────────────────────────────────
  for (const trig of HARD_TRIGGERS) {
    if (trig.pattern.test(guestMessage.body)) {
      const reply: TurnMessage = {
        role: "olivia",
        body: trig.intent === "human_request"
          ? "Got it. I’ll flag Abe to text you directly. Best number for him to reach you on?"
          : "All good. I’ll back off. If you want to pick this up later, just text back.",
        ts: new Date().toISOString(),
      };
      await persistActivity(session.id, {
        session_id: session.id,
        model: MODEL,
        skill: SKILL,
        prompt_version: PROMPT_VERSION,
        trigger,
        input: { hard_trigger: trig.pattern.source, message: guestMessage.body },
        output: null,
        overall_confidence: null,
        status: "pre_check_blocked",
        latency_ms: Date.now() - startedAt,
        input_tokens: null,
        output_tokens: null,
        cost_cents: null,
        error_message: null,
        actions_executed: [],
        actions_drafted: [],
        actions_skipped: [],
      });
      return {
        reply,
        slotsUpdate: {},
        signalsUpdate: { intent: trig.intent === "human_request" ? "human_request" : "other" } as Partial<Signals>,
        routingNextStep: trig.intent === "human_request" ? "immediate_handoff" : null,
        hardTriggerBlocked: { reason: "matched_hard_trigger", intent: trig.intent },
      };
    }
  }

  // ─── 2. Assemble context ───────────────────────────────────────
  const systemPrompt = loadSystemPrompt();
  const messages = buildClaudeMessages(session, guestMessage);

  // ─── 3. Call Claude ────────────────────────────────────────────
  const client = new Anthropic();
  let response: Anthropic.Message;
  try {
    // Note: `thinking` is omitted on purpose. Opus 4.7 rejects
    // `thinking: {type: "adaptive"}` when tool_choice forces a specific
    // tool — the model can't think before producing the structured
    // output it's been pinned to. If we ever want thinking back we'd
    // need to drop the forced tool_choice (or accept output_config-
    // shaped structured outputs instead of the qualify_result tool).
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [QUALIFY_RESULT_TOOL],
      tool_choice: { type: "tool", name: "qualify_result" },
      messages,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Anthropic.APIError
        ? `Anthropic ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    await persistActivity(session.id, {
      session_id: session.id,
      model: MODEL,
      skill: SKILL,
      prompt_version: PROMPT_VERSION,
      trigger,
      input: { messages_count: messages.length },
      output: null,
      overall_confidence: null,
      status: "error",
      latency_ms: Date.now() - startedAt,
      input_tokens: null,
      output_tokens: null,
      cost_cents: null,
      error_message: errorMessage,
      actions_executed: [],
      actions_drafted: [],
      actions_skipped: [],
    });
    return fallbackReply(session.id, "I lost my place for a second. Give me a beat and ask again?");
  }

  const latencyMs = Date.now() - startedAt;

  // ─── 4. Extract tool_use block ─────────────────────────────────
  const toolUseBlock = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name === "qualify_result",
  );
  if (!toolUseBlock) {
    await persistActivity(session.id, {
      session_id: session.id,
      model: MODEL,
      skill: SKILL,
      prompt_version: PROMPT_VERSION,
      trigger,
      input: { messages_count: messages.length },
      output: { content: response.content as unknown as Record<string, unknown> },
      overall_confidence: null,
      status: "validation_failed",
      latency_ms: latencyMs,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_cents: estimateCostCents(response.usage),
      error_message: "No tool_use block in Claude response despite forced tool_choice",
      actions_executed: [],
      actions_drafted: [],
      actions_skipped: [],
    });
    return fallbackReply(session.id, "Hold on. Let me catch up.");
  }

  // ─── 5. Zod validate ───────────────────────────────────────────
  const parsed = QualifyResultSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    await persistActivity(session.id, {
      session_id: session.id,
      model: MODEL,
      skill: SKILL,
      prompt_version: PROMPT_VERSION,
      trigger,
      input: { messages_count: messages.length },
      output: toolUseBlock.input as Record<string, unknown>,
      overall_confidence: null,
      status: "validation_failed",
      latency_ms: latencyMs,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_cents: estimateCostCents(response.usage),
      error_message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      actions_executed: [],
      actions_drafted: [],
      actions_skipped: [],
    });
    return fallbackReply(session.id, "Hold on. Let me catch up.");
  }
  const result: QualifyResult = parsed.data;

  // ─── 6. Confidence-gate actions ────────────────────────────────
  const executed: ExecutedAction[] = [];
  const drafted: DraftedAction[] = [];
  const skipped: SkippedAction[] = [];

  for (const action of result.actions) {
    const thresholds = DEFAULT_THRESHOLDS[action.tool];
    const isExecutable = PHASE_1_EXECUTABLE_TOOLS.has(action.tool);

    if (action.confidence < thresholds.floor) {
      skipped.push({
        tool: action.tool,
        input: action.input as Record<string, unknown>,
        confidence: action.confidence,
        rationale: action.rationale ?? null,
        reason: "below_floor",
      });
      continue;
    }

    if (!isExecutable) {
      // Phase-2 tool — log as skipped with the not-implemented reason so
      // we can see what Claude would have proposed once we wire them up.
      skipped.push({
        tool: action.tool,
        input: action.input as Record<string, unknown>,
        confidence: action.confidence,
        rationale: action.rationale ?? null,
        reason: "validation_failed", // closest enum match; "not_implemented" added later
      });
      continue;
    }

    if (action.confidence < thresholds.auto) {
      drafted.push({
        tool: action.tool,
        input: action.input as Record<string, unknown>,
        confidence: action.confidence,
        rationale: action.rationale ?? null,
        reason: "below_auto_threshold",
      });
      continue;
    }

    // Above auto threshold AND executable → run it
    executed.push({
      tool: action.tool,
      input: action.input as Record<string, unknown>,
      confidence: action.confidence,
      rationale: action.rationale ?? null,
      result: null, // filled by side-effect block below
    });
  }

  // ─── 7. Apply executed actions ─────────────────────────────────
  let oliviaReplyBody: string | null = null;
  const slotsUpdate: Partial<ExtractedSlots> = {};

  for (const action of executed) {
    if (action.tool === "send_message") {
      const input = action.input as { body?: string };
      if (typeof input.body === "string") oliviaReplyBody = input.body;
      action.result = { sent: true };
    } else if (action.tool === "commit_facts") {
      const input = action.input as { slots?: Record<string, unknown> };
      if (input.slots && typeof input.slots === "object") {
        Object.assign(slotsUpdate, input.slots);
      }
      action.result = { slots_keys: Object.keys(input.slots ?? {}) };
    }
  }

  // Fallback: if Claude didn't propose send_message above the auto
  // threshold, fall back to next_message.body so the guest still gets
  // a reply. Don't strand them on silence.
  if (oliviaReplyBody === null) {
    oliviaReplyBody = result.next_message.body;
  }

  // Belt-and-suspenders: strip em/en dashes from the body before it
  // ever leaves the harness. The prompt also forbids them, but LLMs
  // slip; this is the deterministic enforcement.
  oliviaReplyBody = sanitizeGuestText(oliviaReplyBody);

  // ─── 8. Log activity ───────────────────────────────────────────
  const status: ActivityStatus =
    drafted.length > 0 && executed.length === 0 ? "low_confidence" : "success";

  await persistActivity(session.id, {
    session_id: session.id,
    model: MODEL,
    skill: SKILL,
    prompt_version: PROMPT_VERSION,
    trigger,
    input: { messages_count: messages.length },
    output: toolUseBlock.input as Record<string, unknown>,
    overall_confidence: result.overall_confidence,
    status,
    latency_ms: latencyMs,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_cents: estimateCostCents(response.usage),
    error_message: null,
    actions_executed: executed,
    actions_drafted: drafted,
    actions_skipped: skipped,
  });

  return {
    reply: {
      role: "olivia",
      body: oliviaReplyBody,
      ts: new Date().toISOString(),
    },
    slotsUpdate,
    signalsUpdate: pickSignalsUpdate(result.signals),
    routingNextStep: result.routing.next_step,
    hardTriggerBlocked: null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function buildClaudeMessages(
  session: InquirySessionRow,
  guestMessage: TurnMessage,
): Anthropic.MessageParam[] {
  // Conversation history. We treat olivia↔user as the assistant↔user
  // alternation Claude expects. Widget-confirm tokens stay as user
  // messages so Claude sees what was committed.
  const messages: Anthropic.MessageParam[] = [];

  for (const turn of session.transcript) {
    if (turn.role === "user") {
      messages.push({ role: "user", content: turn.body });
    } else if (turn.role === "olivia") {
      messages.push({ role: "assistant", content: turn.body });
    }
    // 'system' role turns get folded into the next user message as a
    // <system-reminder> block to preserve cache. None today.
  }

  // Append the live guest message + session context as a single user
  // turn. The system-reminder block keeps Claude oriented without
  // pushing volatile content into the cached system prompt.
  const sessionContext = JSON.stringify({
    phase: session.phase,
    slots: session.slots,
    signals: session.signals,
  });
  messages.push({
    role: "user",
    content: `<system-reminder>\nCurrent session state:\n${sessionContext}\n</system-reminder>\n\n${guestMessage.body}`,
  });

  return messages;
}

function pickSignalsUpdate(signals: QualifyResult["signals"]): Partial<Signals> {
  return {
    stage: signals.stage,
    urgency: signals.urgency,
    fit: signals.fit,
    complexity: signals.complexity,
    sentiment: signals.sentiment,
    intent: signals.intent,
    objections: signals.objections,
    next_question_key: signals.next_question_key ?? null,
    reasoning: signals.reasoning ?? null,
  };
}

function fallbackReply(sessionId: string, body: string): RunInquiryAgentOutput {
  void sessionId; // reserved for future use (could fire notify_abe)
  return {
    reply: { role: "olivia", body, ts: new Date().toISOString() },
    slotsUpdate: {},
    signalsUpdate: {},
    routingNextStep: null,
    hardTriggerBlocked: null,
  };
}

function estimateCostCents(usage: Anthropic.Usage): number {
  // Opus 4.7 pricing: $5/M input, $25/M output. Cents.
  const inputCents = (usage.input_tokens / 1_000_000) * 500;
  const outputCents = (usage.output_tokens / 1_000_000) * 2_500;
  return Math.round(inputCents + outputCents);
}

async function persistActivity(sessionId: string, row: AgentActivityRow): Promise<void> {
  const supabase = supabaseServer();
  const { error } = await supabase.from("agent_activity").insert(row);
  if (error) {
    // Never throw from logging — surface to stderr for ops visibility,
    // don't break the guest's turn.
    console.error(`[inquiry-agent] failed to persist agent_activity for session ${sessionId}:`, error.message);
  }
}
