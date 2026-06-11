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

import { sendAbeNotification } from "@/lib/email/abeNotification";
import { computeQuote } from "@/lib/pricing/computeQuote";
import { generateShareToken } from "@/lib/share/generateShareToken";
import { siteOrigin } from "@/lib/siteOrigin";
import { supabaseServer } from "@/lib/supabase-server";

import { mirrorSessionToVenueMBA } from "./mirror";

import { QualifyResultSchema } from "./validation";
import {
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

/** Tools the harness actually executes today. mirror_to_venuemba is
 *  routing-driven, not action-driven (see §7.5 below), so it's not in
 *  this set even though it's wired up. Anything proposed but not in
 *  this set still gets recorded in agent_activity for visibility. */
const EXECUTABLE_TOOLS = new Set<ToolName>([
  "send_message",
  "commit_facts",
  "notify_abe",
  "show_widget",
  "advance_to_pricing",
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
          "Proposed tool calls. The harness executes per-action by confidence threshold. Available tools: `send_message`, `commit_facts`, `notify_abe`. Propose `notify_abe` when the guest needs Abe specifically (contract / deposit / legal questions, explicit human request, anything outside your fact sheet) AND has confirmed they want you to flag him.",
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
            {
              type: "object",
              required: ["tool", "input", "confidence"],
              properties: {
                tool: { const: "show_widget" },
                input: {
                  type: "object",
                  required: ["widget"],
                  properties: {
                    widget: {
                      type: "string",
                      enum: ["date_picker", "contact_form", "group_occasion", "share_link", "reserve_form"],
                      description: "Which widget to render inline in the chat so the guest taps instead of types. `date_picker` = calendar for arrival/departure. `contact_form` = name/email/phone. `group_occasion` = guest count + occasion. `share_link` = mints a /trip URL. `reserve_form` = the no-payment hold form (used on the reserve path once you have dates + group + occasion). Use a widget WHENEVER you need structured data. Never ask for those in prose.",
                    },
                    payload: {
                      type: "object",
                      description: "Optional widget-specific data. The harness fills server-controlled fields (token, URL) automatically.",
                    },
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
                tool: { const: "advance_to_pricing" },
                input: {
                  type: "object",
                  properties: {
                    reason: { type: "string", description: "Why you're advancing now (e.g. 'have dates, count, occasion, and email')." },
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
                tool: { const: "notify_abe" },
                input: {
                  type: "object",
                  required: ["reason", "urgency"],
                  properties: {
                    reason: {
                      type: "string",
                      description: "One sentence explaining why Abe needs to look. He sees this in the email subject and banner.",
                    },
                    urgency: { type: "string", enum: ["low", "normal", "high"] },
                    transcript_url: {
                      type: "string",
                      description: "Ignored on server side. The harness overrides with the real /admin/sessions URL.",
                    },
                    preferred_channel: { type: "string", enum: ["sms", "slack", "email"] },
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

// Filler openers that read as a bot stalling ("Heard you. ...",
// "Cool, ..."). The prompt forbids them, but the model has a strong
// habit, so we also strip a single leading filler clause here and
// recapitalize the remainder. Only strips when it is a lead-in
// followed by more sentence, never the whole reply.
const FILLER_OPENER_STRIP =
  /^(cool|heard you|heard|got it|perfect|amazing|love that|love it|sounds good|awesome|great)[.,!]+\s+(?=["'a-z0-9])/i;

export function sanitizeGuestText(s: string): string {
  let out = s
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/[\u002D\u2011]/g, " ")
    .replace(/^,\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = out.match(FILLER_OPENER_STRIP);
  if (m) {
    out = out.slice(m[0].length);
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
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
  /** When a mirror_to_venuemba fired successfully this turn, the
   *  milestone it represented. The route handler persists this into
   *  inquiry_session.last_mirror_event so subsequent turns don't
   *  re-fire the same milestone. Null on skip / failure / no fire. */
  mirrorFired: { event: string; at: string } | null;
  /** Widgets the LLM proposed via show_widget actions, executed and
   *  enriched server-side with whatever the widget needs (e.g.
   *  share_link gets a real /trip URL minted from a fresh inquiry
   *  row). Frontend renders these inline below Olivia's reply. */
  widgets: Array<{ type: string; payload: Record<string, unknown> }>;
  /** If the share executor wrote an inquiry row, the route handler
   *  links it onto inquiry_session.inquiry_id so the session and the
   *  lead point at each other. */
  inquiryIdLinked: string | null;
  /** True when the agent fired advance_to_pricing. The frontend
   *  fast-forwards to the price reveal (gated on having email locally). */
  advanceToPricing: boolean;
}

export async function runInquiryAgent(
  input: RunInquiryAgentInput,
): Promise<RunInquiryAgentOutput> {
  const { session, guestMessage, trigger } = input;
  const startedAt = Date.now();

  // ─── 1. Hard-trigger pre-check ─────────────────────────────────
  for (const trig of HARD_TRIGGERS) {
    if (trig.pattern.test(guestMessage.body)) {
      const isHumanRequest = trig.intent === "human_request";
      const reply: TurnMessage = {
        role: "olivia",
        body: isHumanRequest
          ? "I’ll flag Abe to text you directly. Best number for him to reach you on?"
          : "No problem, I’ll back off. If you want to pick this up later, just text back.",
        ts: new Date().toISOString(),
      };

      // Human-request triggers fire notify_abe deterministically. The
      // promised "I'll flag Abe" only holds if Abe actually hears
      // about it; skipping the email here would silently strand the
      // guest. Non-human triggers (stop/unsubscribe) don't email.
      const executedActions: ExecutedAction[] = [];
      if (isHumanRequest) {
        const recentTranscript = session.transcript
          .filter((m) => m.role === "user" || m.role === "olivia")
          .slice(-6)
          .map((m) => ({ role: m.role, body: m.body, ts: m.ts }));
        const emailResult = await sendAbeNotification({
          sessionId: session.id,
          reason: `Guest explicitly asked for you. They said: "${guestMessage.body.slice(0, 240)}"`,
          urgency: "high",
          transcriptUrl: `${siteOrigin()}/admin/sessions/${session.id}`,
          slots: session.slots as Record<string, unknown>,
          signals: session.signals as Record<string, unknown>,
          recentTranscript,
        });
        executedActions.push({
          tool: "notify_abe",
          input: { reason: "hard_trigger_human_request", urgency: "high" },
          confidence: 1,
          rationale: "Deterministic fire from hard-trigger pre-check",
          result: emailResult.ok
            ? { sent: true, email_id: emailResult.id, channel: "email" }
            : { sent: false, error: emailResult.error },
        });
      }

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
        actions_executed: executedActions,
        actions_drafted: [],
        actions_skipped: [],
      });
      return {
        reply,
        slotsUpdate: {},
        signalsUpdate: { intent: isHumanRequest ? "human_request" : "other" } as Partial<Signals>,
        routingNextStep: isHumanRequest ? "immediate_handoff" : null,
        hardTriggerBlocked: { reason: "matched_hard_trigger", intent: trig.intent },
        mirrorFired: null,
        widgets: [],
        inquiryIdLinked: null,
        advanceToPricing: false,
      };
    }
  }

  // ─── 2. Assemble context ───────────────────────────────────────
  const systemPrompt = loadSystemPrompt();
  const messages = buildClaudeMessages(session, guestMessage);

  // ─── 3. Call Claude ────────────────────────────────────────────
  const client = new Anthropic();

  // Single call attempt: returns the parsed QualifyResult or a reason
  // it failed (so the caller can retry once). Opus 4.7 occasionally
  // returns an empty tool input on the first shot; a single retry
  // clears it without user-visible failure.
  async function attempt(): Promise<
    | { ok: true; response: Anthropic.Message; result: QualifyResult }
    | { ok: false; response: Anthropic.Message | null; reason: "no_tool_block" | "validation_failed"; detail: string }
  > {
    // Note: `thinking` is omitted on purpose. Opus 4.7 rejects
    // `thinking: {type: "adaptive"}` when tool_choice forces a specific
    // tool.
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools: [QUALIFY_RESULT_TOOL],
      tool_choice: { type: "tool", name: "qualify_result" },
      messages,
    });
    const block = resp.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name === "qualify_result",
    );
    if (!block) {
      return { ok: false, response: resp, reason: "no_tool_block", detail: "No qualify_result tool block" };
    }
    const p = QualifyResultSchema.safeParse(block.input);
    if (!p.success) {
      return {
        ok: false,
        response: resp,
        reason: "validation_failed",
        detail: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }
    return { ok: true, response: resp, result: p.data };
  }

  let response: Anthropic.Message;
  let result: QualifyResult;
  try {
    let attemptResult = await attempt();
    if (!attemptResult.ok) {
      // One retry — clears transient empty/garbled tool outputs.
      const retry = await attempt();
      if (retry.ok) {
        attemptResult = retry;
      } else {
        // Both attempts failed — log and fall back.
        await persistActivity(session.id, {
          session_id: session.id,
          model: MODEL,
          skill: SKILL,
          prompt_version: PROMPT_VERSION,
          trigger,
          input: { messages_count: messages.length, retried: true },
          output: (retry.response?.content ?? null) as unknown as Record<string, unknown> | null,
          overall_confidence: null,
          status: "validation_failed",
          latency_ms: Date.now() - startedAt,
          input_tokens: retry.response?.usage.input_tokens ?? null,
          output_tokens: retry.response?.usage.output_tokens ?? null,
          cost_cents: retry.response ? estimateCostCents(retry.response.usage) : null,
          error_message: `${retry.detail} (after 1 retry)`,
          actions_executed: [],
          actions_drafted: [],
          actions_skipped: [],
        });
        return fallbackReply(session.id, "Hold on. Let me catch up.");
      }
    }
    response = attemptResult.response;
    result = attemptResult.result;
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

  // attempt() already extracted + validated; `result` is set. Grab the
  // raw tool block for the activity-log `output` field.
  const toolUseBlock = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name === "qualify_result",
  )!;

  // ─── 6. Confidence-gate actions ────────────────────────────────
  const executed: ExecutedAction[] = [];
  const drafted: DraftedAction[] = [];
  const skipped: SkippedAction[] = [];

  for (const action of result.actions) {
    const thresholds = DEFAULT_THRESHOLDS[action.tool];
    const isExecutable = EXECUTABLE_TOOLS.has(action.tool);

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
  let mirrorFiredEvent: RunInquiryAgentOutput["mirrorFired"] = null;
  const widgets: RunInquiryAgentOutput["widgets"] = [];
  let inquiryIdLinked: string | null = null;
  let advanceToPricing = false;

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
    } else if (action.tool === "show_widget") {
      const input = action.input as { widget?: string };
      if (input.widget === "share_link") {
        const share = await ensureShareLink(session, slotsUpdate);
        if (share.ok) {
          widgets.push({
            type: "share_link",
            payload: {
              url: share.url,
              token: share.token,
              total_cents: share.totalCents,
            },
          });
          if (share.inquiryIdLinked) inquiryIdLinked = share.inquiryIdLinked;
          action.result = { rendered: "share_link", url: share.url };
        } else {
          action.result = { rendered: false, error: share.error };
        }
      } else if (
        input.widget === "date_picker" ||
        input.widget === "contact_form" ||
        input.widget === "group_occasion" ||
        input.widget === "reserve_form"
      ) {
        // Collection widgets render inline client-side from the
        // existing scripted components. No server work needed; just
        // pass the widget type through and the frontend mounts it.
        widgets.push({ type: input.widget, payload: {} });
        action.result = { rendered: input.widget };
      } else {
        action.result = { rendered: false, error: "unknown_widget" };
      }
    } else if (action.tool === "advance_to_pricing") {
      // Signal the frontend to fast-forward to the price reveal. The
      // frontend validates it has dates + guest count + occasion +
      // email locally before acting (email-before-price gate); if
      // anything's missing it shows the relevant widget instead.
      advanceToPricing = true;
      action.result = { signalled: true };
    } else if (action.tool === "notify_abe") {
      // Fetch fresh session for the email payload (slots may have
      // shifted during this turn via earlier commit_facts execution).
      const merged = {
        ...session.slots,
        ...slotsUpdate,
      } as Record<string, unknown>;
      const recentTranscript = session.transcript
        .filter((m) => m.role === "user" || m.role === "olivia")
        .slice(-6)
        .map((m) => ({ role: m.role, body: m.body, ts: m.ts }));

      const input = action.input as {
        reason?: string;
        urgency?: "low" | "normal" | "high";
        transcript_url?: string;
      };

      // Server-side override on the URL — never trust an LLM to invent
      // a valid path. Admin viewer at /admin/sessions/<id> is a Phase
      // 2.6 follow-up; for now the link points at the route even if
      // the page renders a 404.
      const transcriptUrl = `${siteOrigin()}/admin/sessions/${session.id}`;

      const emailResult = await sendAbeNotification({
        sessionId: session.id,
        reason: input.reason ?? "Olivia flagged this session",
        urgency: input.urgency ?? "normal",
        transcriptUrl,
        slots: merged,
        signals: session.signals as Record<string, unknown>,
        recentTranscript,
      });

      action.result = emailResult.ok
        ? { sent: true, email_id: emailResult.id, channel: "email" }
        : { sent: false, error: emailResult.error };
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

  // ─── 7.5 Mirror to VenueMBA on milestones ──────────────────────
  // Routing-driven, not action-driven. The LLM signals intent by
  // setting routing.should_mirror_to_venuemba + routing.mirror_reason;
  // the harness fires the deterministic POST. Idempotent on
  // session_id (VMBA upserts), but we also gate on
  // session.last_mirror_event to avoid burning webhook traffic on
  // every turn after the LLM keeps flagging the same milestone.
  if (
    result.routing.should_mirror_to_venuemba &&
    result.routing.mirror_reason &&
    session.last_mirror_event !== result.routing.mirror_reason
  ) {
    const mirrorResult = await mirrorSessionToVenueMBA(
      // Apply this turn's slot update before the mirror so VMBA sees
      // the latest contact info captured this turn.
      {
        ...session,
        slots: { ...session.slots, ...slotsUpdate },
      },
      result.routing.mirror_reason,
      result.routing.reason,
      {
        handoff_reason: result.routing.handoff_reason,
        handoff_priority: result.routing.handoff_priority,
      },
    );
    executed.push({
      tool: "mirror_to_venuemba",
      input: {
        event: result.routing.mirror_reason,
        reason: result.routing.reason,
      },
      confidence: result.overall_confidence,
      rationale: "Fired from routing.should_mirror_to_venuemba",
      result: mirrorResult as unknown as Record<string, unknown>,
    });
    if (mirrorResult.ok) {
      mirrorFiredEvent = {
        event: result.routing.mirror_reason,
        at: new Date().toISOString(),
      };
    }
  }

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
    mirrorFired: mirrorFiredEvent,
    widgets,
    inquiryIdLinked,
    advanceToPricing,
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
  // messages so Claude sees what was committed. System-role transcript
  // entries (e.g. past price reveals) get folded into the next user
  // message as <system-reminder> blocks; if a system entry is the
  // tail, we drop it here since the live trigger below replays it.
  const messages: Anthropic.MessageParam[] = [];
  let pendingSystemBlocks: string[] = [];

  for (const turn of session.transcript) {
    if (turn.role === "system") {
      pendingSystemBlocks.push(turn.body);
      continue;
    }
    const prefix = pendingSystemBlocks.length
      ? `<system-reminder>\n${pendingSystemBlocks.join("\n")}\n</system-reminder>\n\n`
      : "";
    pendingSystemBlocks = [];
    if (turn.role === "user") {
      messages.push({ role: "user", content: `${prefix}${turn.body}` });
    } else if (turn.role === "olivia") {
      // System block can't ride on an assistant turn — defer to the
      // next user turn (or to the live trigger below).
      if (prefix) pendingSystemBlocks.push(...prefix.split("\n"));
      messages.push({ role: "assistant", content: turn.body });
    }
  }

  // Build the live trigger. The system-reminder block carries phase +
  // slots + signals so Claude doesn't have to infer them.
  const sessionContext = JSON.stringify({
    phase: session.phase,
    slots: session.slots,
    signals: session.signals,
  });
  const trailingSystem = pendingSystemBlocks.length
    ? `\n${pendingSystemBlocks.join("\n")}`
    : "";

  if (guestMessage.role === "system") {
    // No actual guest message — this is an event trigger (e.g.
    // price card just rendered). Frame it explicitly so Claude knows
    // there's nothing typed to react to, just a state change.
    messages.push({
      role: "user",
      content:
        `<system-reminder>\nState changed in the chat without the guest typing anything. Respond to this event as Olivia would.\n\nEvent: ${guestMessage.body}\n\nCurrent session state:\n${sessionContext}${trailingSystem}\n</system-reminder>\n\nProduce your turn now.`,
    });
  } else {
    messages.push({
      role: "user",
      content: `<system-reminder>\nCurrent session state:\n${sessionContext}${trailingSystem}\n</system-reminder>\n\n${guestMessage.body}`,
    });
  }

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
    mirrorFired: null,
    widgets: [],
    inquiryIdLinked: null,
    advanceToPricing: false,
  };
}

function estimateCostCents(usage: Anthropic.Usage): number {
  // Opus 4.7 pricing: $5/M input, $25/M output. Cents.
  const inputCents = (usage.input_tokens / 1_000_000) * 500;
  const outputCents = (usage.output_tokens / 1_000_000) * 2_500;
  return Math.round(inputCents + outputCents);
}

/** Ensure a share-link inquiry exists for this session. Returns the
 *  full /trip URL plus the token. Idempotent on inquiry_session.inquiry_id —
 *  if a row already exists, re-fetches the token instead of creating
 *  a duplicate. Skips when the required slot data isn't there yet.
 */
async function ensureShareLink(
  session: InquirySessionRow,
  slotsUpdateThisTurn: Partial<ExtractedSlots>,
): Promise<
  | {
      ok: true;
      url: string;
      token: string;
      totalCents: number | null;
      inquiryIdLinked: string | null;
    }
  | { ok: false; error: string }
> {
  const merged = {
    ...(session.slots as Record<string, unknown>),
    ...(slotsUpdateThisTurn as Record<string, unknown>),
  };
  const arrival = typeof merged.arrival === "string" ? merged.arrival : null;
  const departure = typeof merged.departure === "string" ? merged.departure : null;
  const email = typeof merged.email === "string" ? merged.email : null;
  const name = typeof merged.name === "string" ? merged.name : null;
  const phone = typeof merged.phone === "string" ? merged.phone : null;
  const guests = typeof merged.guest_count === "number" ? merged.guest_count : null;
  const occasion = typeof merged.occasion === "string" ? merged.occasion : null;

  // Phone is required everywhere we capture a lead, including the share
  // path, so the share link only mints once we can actually reach them.
  if (!arrival || !departure || !email || !name || !phone || !guests || !occasion) {
    return { ok: false, error: "missing_required_slots" };
  }

  const supabase = supabaseServer();

  // Idempotency: if this session already links to an inquiry row,
  // reuse its token.
  if (session.inquiry_id) {
    const { data } = await supabase
      .from("inquiries")
      .select("share_token,quote_total_cents")
      .eq("id", session.inquiry_id)
      .single();
    if (data && typeof data.share_token === "string" && data.share_token) {
      return {
        ok: true,
        url: `${siteOrigin()}/trip/${data.share_token}`,
        token: data.share_token,
        totalCents:
          typeof data.quote_total_cents === "number" ? data.quote_total_cents : null,
        inquiryIdLinked: null, // already linked
      };
    }
  }

  // Compute the quote — best-effort, cache-only. We use computeQuote
  // (not computeQuoteLive) here on purpose: a live PriceLabs backfill
  // can take minutes on a cold cache and blocked one share mint for
  // 610s. The cache is kept warm by the 4-hour cron, and the /trip
  // page does its own live-quote fallback when it renders, so a null
  // snapshot here is harmless.
  const quoteResult = await computeQuote({ arrival, departure, guests, occasion });
  const quote = quoteResult.ok ? quoteResult.quote : null;

  const token = generateShareToken();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      arrival,
      departure,
      email,
      name,
      phone: phone ?? "",
      guests,
      reason: occasion,
      source: "chat_share",
      share_token: token,
      shared_at: now,
      quote_snapshot: quote,
      quote_total_cents: quote?.totalCents ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  return {
    ok: true,
    url: `${siteOrigin()}/trip/${token}`,
    token,
    totalCents: quote?.totalCents ?? null,
    inquiryIdLinked: data.id as string,
  };
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
