-- Inquiry-agent foundation: live session state + audit log.
--
-- inquiry_session holds the live conversation. One row per guest visit
-- to /chat. Mutates as the conversation unfolds (slots get filled,
-- signals get inferred, transcript appends). Terminal states are
-- abandoned / booked / disqualified / handoff_complete.
--
-- agent_activity is the audit log. One row per Claude call. Full
-- structured input + output preserved so any session can be replayed
-- for debugging, prompt evaluation, or transcript review.
--
-- Type safety on slots/signals lives at the Zod layer in app code
-- (src/lib/inquiry-agent/validation.ts) — keeping these as jsonb at
-- the DB level lets the schema evolve without per-slot ALTERs.
--
-- RLS is on with no policies — only service_role (server-side) can
-- read/write, same pattern as inquiries. The anon key cannot reach
-- these tables.
--
-- Companion docs:
--   docs/inquiry-agent-intel-brief-2026-06-05.md   (slot/signal spec)
--   docs/inquiry-agent-simulation-2026-06-05.md    (end-to-end walkthrough)
--   docs/venuemba-harness-analysis-2026-05-20.md   (architectural pattern)

-- ─────────────────────────────────────────────────────────────────
-- inquiry_session
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.inquiry_session (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),

  -- Lifecycle phase. Listed phases are the v1 set; extend via ALTER
  -- when adding new sub-flows (e.g. share_flow, save_flow).
  phase text not null default 'state1'
    check (phase in (
      'state1',
      'state1_to_checking',
      'checking',
      'available',
      'pricing',
      'post_price',
      'awaiting_abe',
      'abandoned',
      'booked',
      'disqualified',
      'handoff_complete'
    )),

  -- Attribution (mirrors what we already capture on inquiries)
  utm jsonb,
  user_agent text,
  ip text,

  -- Layer 1 + Layer 2 from the intel brief. Shape is enforced by Zod
  -- in app code, not by the DB. See validation.ts.
  --
  -- Expected keys (v1 lock):
  --   arrival, departure, nights,
  --   name, email, phone,
  --   guest_count (int 1-14), occasion,
  --   price_response, date_flexibility, alternatives_considered,
  --   must_haves_canonical, must_haves_freeform,
  --   decision_makers, decision_timeline,
  --   send_to_group_intent, returning_visitor, objections,
  --   sleeping_setup_needs, dietary_plan, arrival_logistics,
  --   add_on_interest, photo_intent, neighborhood_comfort,
  --   concession_accepted, confidence
  slots jsonb not null default '{}'::jsonb,

  -- Layer 3 (passive signals) — running interpretation, updated each
  -- LLM turn. Same Zod-enforcement note as slots.
  --
  -- Expected keys: stage, urgency, fit, complexity, sentiment,
  --                intent, next_question_key, reasoning, objections
  signals jsonb not null default '{}'::jsonb,

  -- Append-only chat history.
  --
  -- Each entry: {
  --   role: 'user' | 'olivia' | 'system',
  --   body: string,
  --   ts: ISO timestamp,
  --   widget?: string (e.g. 'dates_confirm', 'price_card', 'concession_card'),
  --   widget_payload?: jsonb
  -- }
  transcript jsonb not null default '[]'::jsonb,

  -- Link to the committed lead row once Abe closes the deal. Null
  -- while the session is still in flight or terminal-but-not-booked.
  inquiry_id uuid references public.inquiries(id) on delete set null,

  -- Terminal-state metadata
  terminal_reason text,
  terminal_at timestamptz,

  -- VenueMBA mirror tracking — last_mirror_event names the milestone
  -- we last fired (qualified_complete / abandonment / handoff /
  -- booked). last_mirror_at is when it succeeded. If a session
  -- transitions to a new milestone we re-fire, keyed idempotently by
  -- session_id on the VMBA side.
  last_mirror_event text,
  last_mirror_at timestamptz
);

alter table public.inquiry_session enable row level security;

-- Indexes
create index if not exists inquiry_session_last_activity_idx
  on public.inquiry_session (last_activity_at desc);

-- Abandonment sweep query: find sessions stuck in non-terminal phases
-- past their idle threshold.
create index if not exists inquiry_session_phase_activity_idx
  on public.inquiry_session (phase, last_activity_at)
  where phase not in ('awaiting_abe', 'abandoned', 'booked', 'disqualified', 'handoff_complete');

-- Lookup by committed inquiry (admin: "show me the session that
-- became this inquiry").
create index if not exists inquiry_session_inquiry_id_idx
  on public.inquiry_session (inquiry_id)
  where inquiry_id is not null;

-- jsonb lookups on extracted slot values (e.g. all sessions where
-- price_response = 'too_high'). GIN gives us flexible jsonb querying
-- without per-key indexes.
create index if not exists inquiry_session_slots_gin_idx
  on public.inquiry_session using gin (slots jsonb_path_ops);

create index if not exists inquiry_session_signals_gin_idx
  on public.inquiry_session using gin (signals jsonb_path_ops);

-- ─────────────────────────────────────────────────────────────────
-- agent_activity (audit log)
-- ─────────────────────────────────────────────────────────────────
--
-- One row per Claude call. Deterministic widget commits (dates
-- confirm, contact save, etc.) do NOT write here — those land in
-- session_events if/when we add that later. This table is purely the
-- LLM audit trail.

create table if not exists public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inquiry_session(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Which LLM + prompt produced this turn. prompt_version lets us
  -- A/B prompt variants without losing comparability.
  model text not null,
  skill text not null default 'inquiry',
  prompt_version text not null default 'v1',

  -- What triggered the call. Examples: 'guest_message',
  -- 'free_text_parse', 'price_revealed', 'concession_accept',
  -- 'composer_off_script'.
  trigger text not null,

  -- Full record for replay. input = the assembled messages + context
  -- + tool schema we sent to Claude. output = Claude's raw structured
  -- response (post-Zod-validation, pre-execution).
  input jsonb not null,
  output jsonb,

  -- Outcomes
  overall_confidence numeric(3,2),
  status text not null default 'success'
    check (status in (
      'success',
      'validation_failed',
      'low_confidence',
      'pre_check_blocked',
      'error'
    )),

  -- Performance
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_cents integer,

  -- Error details (only populated when status != 'success')
  error_message text,

  -- What the harness actually did with Claude's proposed actions.
  -- Each is an array of {tool, input, confidence, rationale, result?}.
  actions_executed jsonb not null default '[]'::jsonb,
  actions_drafted jsonb not null default '[]'::jsonb,
  actions_skipped jsonb not null default '[]'::jsonb
);

alter table public.agent_activity enable row level security;

-- Indexes
create index if not exists agent_activity_session_id_idx
  on public.agent_activity (session_id, created_at);

create index if not exists agent_activity_created_at_idx
  on public.agent_activity (created_at desc);

-- Failure investigation: pull all non-success activity, recent first.
create index if not exists agent_activity_failures_idx
  on public.agent_activity (status, created_at desc)
  where status != 'success';
