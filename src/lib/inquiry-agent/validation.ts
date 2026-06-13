/**
 * Zod schemas for the inquiry-agent harness.
 *
 * This file is the single source of truth for slot names, signal
 * vocabularies, routing decisions, and tool action shapes. Every
 * field name here becomes a contract — once a transcript is saved
 * referencing a slot, renames cost data hygiene.
 *
 * Locked field names mirror the v1 list documented in the migration
 * header at supabase/migrations/20260606120000_inquiry_agent_tables.sql.
 *
 * See also:
 *   docs/inquiry-agent-intel-brief-2026-06-05.md  (slot/signal spec)
 *   docs/inquiry-agent-simulation-2026-06-05.md   (walkthrough)
 *   docs/venuemba-harness-analysis-2026-05-20.md  (architectural pattern)
 */

import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
// Layer 1 + Layer 2 enums (extracted slot values)
// ──────────────────────────────────────────────────────────────────

export const OccasionSchema = z.enum([
  "bachelor",
  "bachelorette",
  "wedding",
  "other",
]);

export const PriceResponseSchema = z.enum([
  "happy",
  "stretched",
  "too_high",
  "open",
  "unknown",
]);

export const DateFlexibilitySchema = z.enum([
  "none",
  "mid_week",
  "off_peak",
  "any_window",
  "unknown",
]);

export const DecisionMakersSchema = z.enum([
  "solo",
  "partner",
  "crew",
  "unknown",
]);

export const DecisionTimelineSchema = z.enum([
  "immediate",
  "this_week",
  "this_month",
  "flexible",
  "unknown",
]);

export const DietaryPlanSchema = z.enum([
  "cook_in",
  "order_in",
  "restaurants",
  "mixed",
  "unknown",
]);

export const ArrivalLogisticsSchema = z.enum([
  "driving",
  "flying",
  "mixed",
  "unknown",
]);

export const NeighborhoodComfortSchema = z.enum([
  "known",
  "new",
  "unknown",
]);

/**
 * Canonical must-have vocabulary. Free-text guest mentions get
 * normalized into one of these; the freeform array catches the rest.
 * Constrained list lets us filter / segment downstream cleanly.
 */
export const MustHaveCanonicalSchema = z.enum([
  "cinema",
  "hot_tub",
  "bar",
  "courtyard",
  "kitchen",
  "sleeping_setup",
  "walkable",
  "parking",
]);

// ──────────────────────────────────────────────────────────────────
// Layer 3 signal enums
// ──────────────────────────────────────────────────────────────────

export const StageSchema = z.enum(["early", "mid", "late", "unknown"]);
export const UrgencySchema = z.enum(["low", "medium", "high", "unknown"]);
export const FitSchema = z.enum(["good", "maybe", "poor", "unknown"]);
export const ComplexitySchema = z.enum(["low", "medium", "high"]);
export const SentimentSchema = z.enum(["positive", "neutral", "negative"]);

/**
 * Jackpot-specific intent vocabulary. Diverges from VMBA's intents
 * because our domain is web-chat negotiation post-quote, not SMS lead
 * qualification.
 */
export const IntentSchema = z.enum([
  "pricing_negotiation",
  "date_flex_probe",
  "alternates_compare",
  "send_to_group",
  "book",
  "human_request",
  "info_request",
  "objection",
  "other",
]);

// ──────────────────────────────────────────────────────────────────
// Routing
// ──────────────────────────────────────────────────────────────────

export const NextStepSchema = z.enum([
  "clarify",
  "concession_offer",
  "share_to_group",
  "callback_schedule",
  "nurture",
  "abandon",
  "book",
  "immediate_handoff",
  "disqualify",
]);

export const HandoffPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const MirrorReasonSchema = z.enum([
  "qualified_complete",
  "abandonment",
  "handoff",
  "booked",
]);

export const RoutingSchema = z
  .object({
    next_step: NextStepSchema,
    reason: z.string(),
    should_handoff: z.boolean(),
    handoff_priority: HandoffPrioritySchema.nullable().optional(),
    handoff_reason: z.string().nullable().optional(),
    should_mirror_to_venuemba: z.boolean().default(false),
    mirror_reason: MirrorReasonSchema.nullable().optional(),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────
// Extracted slots (Layer 1 + Layer 2)
// ──────────────────────────────────────────────────────────────────

/**
 * Per-slot confidence map. Open shape (passthrough) so Claude can
 * include confidence for any slot it touched without us listing every
 * key here.
 */
export const SlotConfidenceSchema = z
  .object({
    overall: z.number().min(0).max(1),
  })
  .passthrough();

export const ExtractedSlotsSchema = z
  .object({
    // Layer 1 — pre-price, widget-filled (LLM may also extract these
    // from free-text composer input)
    arrival: z.string().nullable().optional(),
    departure: z.string().nullable().optional(),
    nights: z.number().int().positive().nullable().optional(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    guest_count: z.number().int().min(1).max(14).nullable().optional(),
    occasion: OccasionSchema.nullable().optional(),

    // Layer 2 — post-price, LLM-extracted
    price_response: PriceResponseSchema.nullable().optional(),
    date_flexibility: DateFlexibilitySchema.nullable().optional(),
    alternatives_considered: z.array(z.string()).optional().default([]),
    must_haves_canonical: z.array(MustHaveCanonicalSchema).optional().default([]),
    must_haves_freeform: z.array(z.string()).optional().default([]),
    decision_makers: DecisionMakersSchema.nullable().optional(),
    decision_timeline: DecisionTimelineSchema.nullable().optional(),
    send_to_group_intent: z.boolean().nullable().optional(),
    returning_visitor: z.boolean().nullable().optional(),
    objections: z.array(z.string()).optional().default([]),
    sleeping_setup_needs: z.array(z.string()).optional().default([]),
    dietary_plan: DietaryPlanSchema.nullable().optional(),
    arrival_logistics: ArrivalLogisticsSchema.nullable().optional(),
    add_on_interest: z.array(z.string()).optional().default([]),
    photo_intent: z.boolean().nullable().optional(),
    neighborhood_comfort: NeighborhoodComfortSchema.nullable().optional(),
    concession_accepted: z.string().nullable().optional(),

    confidence: SlotConfidenceSchema,
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────
// Signals (Layer 3)
// ──────────────────────────────────────────────────────────────────

export const SignalsSchema = z
  .object({
    stage: StageSchema,
    urgency: UrgencySchema,
    fit: FitSchema,
    complexity: ComplexitySchema,
    sentiment: SentimentSchema,
    intent: IntentSchema,
    objections: z.array(z.string()).optional().default([]),
    next_question_key: z.string().nullable().optional(),
    reasoning: z.string().nullable().optional(),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────
// Olivia's reply for the turn
// ──────────────────────────────────────────────────────────────────

export const NextMessageSchema = z
  .object({
    body: z.string(),
    widgets_to_show: z.array(z.string()).optional().default([]),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────
// Agent state patch (merged into inquiry_session.signals / phase)
// ──────────────────────────────────────────────────────────────────

export const AgentStatePatchSchema = z
  .object({
    phase: z.string().nullable().optional(),
    asked_keys: z.array(z.string()).nullable().optional(),
    last_routing: NextStepSchema.nullable().optional(),
    stop_requested: z.boolean().nullable().optional(),
  })
  .passthrough()
  .nullable()
  .optional();

// ──────────────────────────────────────────────────────────────────
// Tool action inputs — one schema per tool the LLM can propose
// ──────────────────────────────────────────────────────────────────

const PriceQuoteSchema = z.object({
  arrival: z.string(),
  departure: z.string(),
  total_cents: z.number().int().nonnegative(),
});

export const SendMessageInputSchema = z.object({
  body: z.string(),
  widget: z.string().optional(),
});

export const ShowWidgetInputSchema = z.object({
  widget: z.string(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export const AdvanceToPricingInputSchema = z.object({
  reason: z.string().optional(),
});

export const CommitFactsInputSchema = z.object({
  slots: z.record(z.string(), z.unknown()),
  confidence: z.record(z.string(), z.number()).optional(),
});

export const OfferConcessionInputSchema = z.object({
  type: z.enum(["alt_dates", "midweek_shift", "drop_addon", "shoulder_season"]),
  current: PriceQuoteSchema,
  alt: PriceQuoteSchema,
});

export const NotifyAbeInputSchema = z.object({
  reason: z.string(),
  urgency: z.enum(["low", "normal", "high"]),
  // transcript_url is optional from the LLM's side; the harness always
  // overrides it server-side with the real /admin/sessions URL so the
  // model can't hallucinate a bad link.
  transcript_url: z.string().optional(),
  preferred_channel: z.enum(["sms", "slack", "email"]).optional(),
});

export const ScheduleCallbackInputSchema = z.object({
  delay_min: z.number().int().positive(),
  channel: z.enum(["sms", "email"]),
  to_phone: z.string().optional(),
  to_email: z.string().optional(),
});

export const MirrorToVenuembaInputSchema = z.object({
  event: MirrorReasonSchema,
  session_id: z.string(),
});

export const HandoffInputSchema = z.object({
  to: z.enum(["abe"]),
  context: z.string(),
});

// ──────────────────────────────────────────────────────────────────
// Action discriminated union
// ──────────────────────────────────────────────────────────────────

const ActionCommon = {
  confidence: z.number().min(0).max(1),
  rationale: z.string().nullable().optional(),
};

export const ActionSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("send_message"), input: SendMessageInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("show_widget"), input: ShowWidgetInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("advance_to_pricing"), input: AdvanceToPricingInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("commit_facts"), input: CommitFactsInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("offer_concession"), input: OfferConcessionInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("notify_abe"), input: NotifyAbeInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("schedule_callback"), input: ScheduleCallbackInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("mirror_to_venuemba"), input: MirrorToVenuembaInputSchema, ...ActionCommon }),
  z.object({ tool: z.literal("handoff"), input: HandoffInputSchema, ...ActionCommon }),
]);

// ──────────────────────────────────────────────────────────────────
// Top-level: the structured output Claude returns every turn
// ──────────────────────────────────────────────────────────────────

export const QualifyResultSchema = z
  .object({
    summary_for_human: z.string(),
    extracted_slots: ExtractedSlotsSchema,
    signals: SignalsSchema,
    routing: RoutingSchema,
    next_message: NextMessageSchema,
    agent_state_patch: AgentStatePatchSchema,
    actions: z.array(ActionSchema).default([]),
    overall_confidence: z.number().min(0).max(1),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────
// API contract: POST /api/inquiry-agent/turn request + response
// ──────────────────────────────────────────────────────────────────

export const TurnMessageSchema = z.object({
  role: z.enum(["user", "olivia", "system"]),
  body: z.string(),
  ts: z.string(),
  widget: z.string().optional(),
  widget_payload: z.record(z.string(), z.unknown()).optional(),
});

export const TurnRequestSchema = z.object({
  session_id: z.string().nullable(),
  message: TurnMessageSchema,
  client_context: z
    .object({
      phase: z.string(),
      slots: z.record(z.string(), z.unknown()).optional().default({}),
      // Signals the scripted widgets capture directly (e.g. the qualify
      // beat's decision_timeline / decision_makers). Merged into the
      // session on a widget-confirm commit, no LLM extraction needed.
      signals: z.record(z.string(), z.unknown()).optional().default({}),
      viewport: z.enum(["mobile", "desktop"]).optional(),
      utm: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .optional()
    .default({ phase: "state1", slots: {}, signals: {} }),
  // Scripted-widget commit: forces the no-LLM path (so a readable
  // tap-through still records to the transcript without calling Claude)
  // and supplies the scripted Olivia line to store opposite the guest's
  // message. `message.body` carries the human-readable guest choice.
  commit: z.boolean().optional(),
  agent_line: z.string().optional(),
});

export const TurnWidgetSchema = z.object({
  type: z.string(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export const TurnResponseSchema = z.object({
  session_id: z.string(),
  phase: z.string(),
  messages: z.array(TurnMessageSchema),
  widgets: z.array(TurnWidgetSchema).default([]),
  /**
   * Slots the harness extracted and committed this turn. The frontend
   * uses this to pre-fill scripted widgets so a guest who typed
   * "memorial day weekend, 12 girls bachelorette" in the composer
   * doesn't re-enter the same info via chips. Strict-confirm: pre-fills
   * still require the guest to tap the widget's commit button.
   */
  extracted_slots: z.record(z.string(), z.unknown()).optional().default({}),
  /** True when the agent fired advance_to_pricing. Frontend fast-
   *  forwards to the price reveal (gated on having email locally). */
  advance_to_pricing: z.boolean().optional().default(false),
});

// ──────────────────────────────────────────────────────────────────
// Phase enum (mirrors the CHECK constraint in the migration)
// ──────────────────────────────────────────────────────────────────

export const PhaseSchema = z.enum([
  "state1",
  "state1_to_checking",
  "checking",
  "available",
  "pricing",
  "post_price",
  "awaiting_abe",
  "abandoned",
  "booked",
  "disqualified",
  "handoff_complete",
]);
