/**
 * Inquiry-agent types.
 *
 * Most types here are inferred from the Zod schemas in validation.ts
 * so the contract stays single-sourced. Internal harness types that
 * never cross the Claude boundary live here as plain TypeScript.
 */

import type { z } from "zod";

import type {
  ActionSchema,
  AgentStatePatchSchema,
  ArrivalLogisticsSchema,
  CommitFactsInputSchema,
  ComplexitySchema,
  DateFlexibilitySchema,
  DecisionMakersSchema,
  DecisionTimelineSchema,
  DietaryPlanSchema,
  ExtractedSlotsSchema,
  FitSchema,
  HandoffInputSchema,
  HandoffPrioritySchema,
  IntentSchema,
  MirrorReasonSchema,
  MirrorToVenuembaInputSchema,
  MustHaveCanonicalSchema,
  NeighborhoodComfortSchema,
  NextMessageSchema,
  NextStepSchema,
  NotifyAbeInputSchema,
  OccasionSchema,
  OfferConcessionInputSchema,
  PhaseSchema,
  PriceResponseSchema,
  QualifyResultSchema,
  RoutingSchema,
  ScheduleCallbackInputSchema,
  SendMessageInputSchema,
  SentimentSchema,
  ShowWidgetInputSchema,
  SignalsSchema,
  SlotConfidenceSchema,
  StageSchema,
  TurnMessageSchema,
  TurnRequestSchema,
  TurnResponseSchema,
  TurnWidgetSchema,
  UrgencySchema,
} from "./validation";

// ──────────────────────────────────────────────────────────────────
// Inferred from Zod (the LLM-facing contract surface)
// ──────────────────────────────────────────────────────────────────

export type Occasion = z.infer<typeof OccasionSchema>;
export type PriceResponse = z.infer<typeof PriceResponseSchema>;
export type DateFlexibility = z.infer<typeof DateFlexibilitySchema>;
export type DecisionMakers = z.infer<typeof DecisionMakersSchema>;
export type DecisionTimeline = z.infer<typeof DecisionTimelineSchema>;
export type DietaryPlan = z.infer<typeof DietaryPlanSchema>;
export type ArrivalLogistics = z.infer<typeof ArrivalLogisticsSchema>;
export type NeighborhoodComfort = z.infer<typeof NeighborhoodComfortSchema>;
export type MustHaveCanonical = z.infer<typeof MustHaveCanonicalSchema>;

export type Stage = z.infer<typeof StageSchema>;
export type Urgency = z.infer<typeof UrgencySchema>;
export type Fit = z.infer<typeof FitSchema>;
export type Complexity = z.infer<typeof ComplexitySchema>;
export type Sentiment = z.infer<typeof SentimentSchema>;
export type Intent = z.infer<typeof IntentSchema>;

export type NextStep = z.infer<typeof NextStepSchema>;
export type HandoffPriority = z.infer<typeof HandoffPrioritySchema>;
export type MirrorReason = z.infer<typeof MirrorReasonSchema>;
export type Phase = z.infer<typeof PhaseSchema>;

export type SlotConfidence = z.infer<typeof SlotConfidenceSchema>;
export type ExtractedSlots = z.infer<typeof ExtractedSlotsSchema>;
export type Signals = z.infer<typeof SignalsSchema>;
export type Routing = z.infer<typeof RoutingSchema>;
export type NextMessage = z.infer<typeof NextMessageSchema>;
export type AgentStatePatch = z.infer<typeof AgentStatePatchSchema>;

export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;
export type ShowWidgetInput = z.infer<typeof ShowWidgetInputSchema>;
export type CommitFactsInput = z.infer<typeof CommitFactsInputSchema>;
export type OfferConcessionInput = z.infer<typeof OfferConcessionInputSchema>;
export type NotifyAbeInput = z.infer<typeof NotifyAbeInputSchema>;
export type ScheduleCallbackInput = z.infer<typeof ScheduleCallbackInputSchema>;
export type MirrorToVenuembaInput = z.infer<typeof MirrorToVenuembaInputSchema>;
export type HandoffInput = z.infer<typeof HandoffInputSchema>;

export type Action = z.infer<typeof ActionSchema>;
export type ToolName = Action["tool"];

export type QualifyResult = z.infer<typeof QualifyResultSchema>;

export type TurnMessage = z.infer<typeof TurnMessageSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export type TurnWidget = z.infer<typeof TurnWidgetSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;

// ──────────────────────────────────────────────────────────────────
// Internal harness types (never cross the Claude boundary)
// ──────────────────────────────────────────────────────────────────

/**
 * Confidence thresholds per action. Above auto → execute. Between
 * auto and floor → draft for admin review. Below floor → silent skip.
 *
 * Initial values from docs/inquiry-agent-intel-brief-2026-06-05.md §9.
 * Should be tuned from real funnel data within the first week of
 * shipping; calibrate per-action, not globally.
 */
export interface ConfidenceThresholds {
  auto: number;
  floor: number;
}

export const DEFAULT_THRESHOLDS: Record<ToolName, ConfidenceThresholds> = {
  send_message: { auto: 0.75, floor: 0.4 },
  show_widget: { auto: 0.7, floor: 0.4 },
  // commit_facts auto threshold is intentionally low because the
  // widget itself is the second safety check — pre-fills still
  // require the guest to tap Continue / Save. Let extractions through
  // freely; the worst case is the guest edits before confirming.
  commit_facts: { auto: 0.5, floor: 0.3 },
  // Widget surfacing + advance are low-risk: the widget itself is the
  // commit gate, and advance just fast-forwards to a price the guest
  // can react to. Let them through freely.
  advance_to_pricing: { auto: 0.5, floor: 0.3 },
  offer_concession: { auto: 0.75, floor: 0.4 },
  notify_abe: { auto: 0.85, floor: 0.4 },
  schedule_callback: { auto: 0.8, floor: 0.4 },
  mirror_to_venuemba: { auto: 0.8, floor: 0.4 },
  handoff: { auto: 0.85, floor: 0.4 },
};

export type ActivityStatus =
  | "success"
  | "validation_failed"
  | "low_confidence"
  | "pre_check_blocked"
  | "error";

/**
 * One row of agent_activity. Mirrors the DB columns; harness builds
 * this then writes it via the Supabase service-role client.
 */
export interface AgentActivityRow {
  session_id: string;
  model: string;
  skill: string;
  prompt_version: string;
  trigger: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  overall_confidence: number | null;
  status: ActivityStatus;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  error_message: string | null;
  actions_executed: ExecutedAction[];
  actions_drafted: DraftedAction[];
  actions_skipped: SkippedAction[];
}

export interface ExecutedAction {
  tool: ToolName;
  input: Record<string, unknown>;
  confidence: number;
  rationale: string | null;
  result: Record<string, unknown> | null;
}

export interface DraftedAction {
  tool: ToolName;
  input: Record<string, unknown>;
  confidence: number;
  rationale: string | null;
  reason: "below_auto_threshold";
}

export interface SkippedAction {
  tool: ToolName;
  input: Record<string, unknown>;
  confidence: number;
  rationale: string | null;
  reason: "below_floor" | "validation_failed";
}

/**
 * The full row shape we persist for inquiry_session. Mirrors the
 * DB columns; transcript is the append-only chat history.
 */
export interface InquirySessionRow {
  id: string;
  created_at: string;
  last_activity_at: string;
  phase: Phase;
  utm: Record<string, unknown> | null;
  user_agent: string | null;
  ip: string | null;
  slots: Partial<ExtractedSlots>;
  signals: Partial<Signals>;
  transcript: TurnMessage[];
  inquiry_id: string | null;
  terminal_reason: string | null;
  terminal_at: string | null;
  last_mirror_event: MirrorReason | null;
  last_mirror_at: string | null;
}
