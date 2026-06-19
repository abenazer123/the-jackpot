-- Landing-screen analytics: the /batch occasion screen funnel.
--
-- The /batch entry shows an occasion picker before the landing page.
-- We record two events per visit so we can measure the thing the
-- inquiries table can't see (pre-inquiry behavior):
--
--   occasion_screen_viewed  — fired when the screen mounts.
--   occasion_selected        — fired when the guest taps an occasion.
--
-- Bounce rate = 1 - (unique anon_id that selected / unique anon_id that
-- viewed). `internal` flags our own test traffic (set via a jp_internal
-- cookie from /batch?internal=1) so it can be excluded. Dedup is by
-- anon_id (a client-set cookie), not raw rows.
--
-- See docs/batch-funnel-brief-2026-06-18.md.
--
-- RLS is on with no policies — only service_role (server-side, via
-- /api/landing-event) can read/write, same pattern as inquiries.

create table if not exists public.landing_event (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Client-set anonymous id (cookie), the dedup key.
  anon_id text not null,

  event text not null
    check (event in ('occasion_screen_viewed', 'occasion_selected')),

  -- Set on occasion_selected. `occasion` is the picked option;
  -- `occasion_freetext` is the "Something else" free text.
  occasion text,
  occasion_freetext text,

  -- Attribution, captured on the /batch landing (mirrors inquiries).
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_path text,

  -- Our own test traffic (jp_internal cookie). Excluded from analytics.
  internal boolean not null default false
);

create index if not exists landing_event_created_at_idx
  on public.landing_event (created_at desc);

create index if not exists landing_event_anon_idx
  on public.landing_event (anon_id);

alter table public.landing_event enable row level security;
