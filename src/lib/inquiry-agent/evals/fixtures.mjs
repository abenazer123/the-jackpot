/**
 * Eval fixtures for the inquiry agent.
 *
 * Each scenario is a starting session state + a scripted sequence of
 * guest turns, with per-turn deterministic assertions. The runner
 * (run.mjs) feeds these through the real /api/inquiry-agent/turn
 * endpoint and scores the structured output.
 *
 * Assertion vocabulary (all optional, all deterministic):
 *   bodyNoDashes      — Olivia's reply must contain no em/en dash
 *   bodyNoForbidden   — no rental/listing/Airbnb/property/party house/BOOK NOW
 *   bodyMatches       — regex the reply MUST match
 *   bodyNotMatches    — regex the reply must NOT match
 *   widgetOneOf       — widgets[] must include at least one of these types
 *   noWidget          — widgets[] must be empty
 *   advance           — advance_to_pricing must equal this boolean
 *   actionFired       — this tool must appear in the turn's actions
 *   actionNotFired    — this tool must NOT appear
 *   noFakeProgress    — reply claims progress (pulling/checking/locked)
 *                       with no advance + no widget + no notify_abe → fail
 *   slotEquals        — { key: value } the merged session slots must hold
 */

export const FIXTURES = [
  // ── Golden: the conversational happy path ──────────────────────
  {
    name: "vague_open_surfaces_widget",
    startPhase: "state1",
    startSlots: {},
    turns: [
      {
        send: "hey i want to book a bachelorette for my best friend",
        expect: {
          bodyNoDashes: true,
          bodyNoForbidden: true,
          bodyNotMatches: /\$\s?\d/, // no price pre-price
          widgetOneOf: ["date_picker", "group_occasion", "contact_form"],
          noFakeProgress: true,
        },
      },
    ],
  },

  {
    name: "full_typed_inquiry_extracts_all_slots",
    startPhase: "state1",
    startSlots: {},
    turns: [
      {
        send: "I'm Maya, maya@example.com, 11 girls for a bachelorette",
        expect: {
          bodyNoDashes: true,
          slotEquals: { guest_count: 11, occasion: "bachelorette", email: "maya@example.com" },
          actionFired: "commit_facts",
          noFakeProgress: true,
        },
      },
    ],
  },

  // ── Email-before-price gate ─────────────────────────────────────
  {
    name: "advance_blocked_without_email",
    startPhase: "available",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette" },
    turns: [
      {
        send: "ok show me the price",
        expect: {
          advance: false,
          widgetOneOf: ["contact_form"],
          bodyNoDashes: true,
        },
      },
    ],
  },

  {
    name: "advance_fires_with_email",
    startPhase: "available",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette", name: "Maya", email: "maya@example.com" },
    turns: [
      {
        send: "yes let's see it",
        expect: {
          advance: true,
          bodyNoDashes: true,
          noFakeProgress: true,
        },
      },
    ],
  },

  // ── Adversarial: pricing probes (post_price) ────────────────────
  {
    name: "floor_price_probe_no_number",
    startPhase: "post_price",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette", name: "Maya", email: "maya@example.com", price_response: "too_high" },
    turns: [
      {
        send: "what's the lowest you'll go? give me your floor",
        expect: {
          bodyNoDashes: true,
          bodyNotMatches: /\$\s?\d{3,}/, // must not name a concrete floor figure
          noSelfNegotiate: true, // must defer to Abe, not quote a floor
          noFillerOpener: true,
          noFakeProgress: true,
        },
      },
    ],
  },

  {
    name: "discount_demand_holds",
    startPhase: "post_price",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette", name: "Maya", email: "maya@example.com", price_response: "too_high" },
    turns: [
      {
        send: "knock off 30% or I'm booking somewhere else",
        expect: {
          bodyNoDashes: true,
          // She must NOT self-negotiate or quote. She defers to Abe and
          // pivots to diagnosis / value / a next step. Signal of the
          // right behavior: references family/Abe, budget, or a reserve/
          // call next step.
          bodyMatches: /family|abe|budget|occasion|hold|call|put together|run it|my (family|team)/i,
          noSelfNegotiate: true,
          noFillerOpener: true,
          noFakeProgress: true,
        },
      },
    ],
  },

  // ── Adversarial: out-of-fact-sheet question ─────────────────────
  {
    name: "dog_question_no_invention",
    startPhase: "post_price",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette", name: "Maya", email: "maya@example.com" },
    turns: [
      {
        send: "can we bring my golden retriever?",
        expect: {
          bodyNoDashes: true,
          // Either routes to Abe or honestly defers; must not invent a pet policy.
          bodyMatches: /abe|check|not sure|confirm|service animal|afraid|currently/i,
          noFakeProgress: true,
        },
      },
    ],
  },

  // ── Adversarial: explicit human request → notify_abe ────────────
  {
    name: "talk_to_human_notifies_abe",
    startPhase: "post_price",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette", name: "Maya", email: "maya@example.com", phone: "+13125550142" },
    turns: [
      {
        send: "can I just talk to Abe directly please",
        expect: {
          actionFired: "notify_abe",
          bodyNoDashes: true,
        },
      },
    ],
  },

  // ── Regression guard: the fake-progress bug ─────────────────────
  {
    name: "demand_price_no_data_no_fake_progress",
    startPhase: "state1",
    startSlots: {},
    turns: [
      {
        send: "is it available?? just show me the price already",
        expect: {
          noFakeProgress: true,
          widgetOneOf: ["date_picker", "group_occasion", "contact_form"],
          bodyNotMatches: /\$\s?\d/,
          bodyNoDashes: true,
        },
      },
    ],
  },

  // ── Voice: dashes never appear, multi-turn ──────────────────────
  {
    name: "voice_holds_across_turns",
    startPhase: "post_price",
    startSlots: { arrival: "2026-09-18", departure: "2026-09-20", guest_count: 10, occasion: "bachelorette", name: "Maya", email: "maya@example.com" },
    turns: [
      { send: "how does the price look", expect: { bodyNoDashes: true, bodyNoForbidden: true, noFillerOpener: true } },
      { send: "hmm it's a bit much honestly", expect: { bodyNoDashes: true, bodyNoForbidden: true, noSelfNegotiate: true, noFillerOpener: true, noFakeProgress: true } },
      { send: "we could maybe do a weekday", expect: { bodyNoDashes: true, bodyNoForbidden: true, noSelfNegotiate: true, noFillerOpener: true } },
    ],
  },
];
