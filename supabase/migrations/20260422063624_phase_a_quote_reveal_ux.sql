-- Phase A — guest-facing quote reveal UX.
-- Adds the columns and config needed for the new Step 4 ("What kind of
-- weekend are you going for?"), the success-screen reveal, the
-- sticker-shock safety valve, and the make-an-offer flow. See
-- docs/guest-experience-ux.md §15 for the full scope.

-- ─────────────────────────────────────────────────────────────────
-- 1. Inquiry columns: budget, split intent, appeal, deposit/alt-dates flags
-- ─────────────────────────────────────────────────────────────────
alter table public.inquiries
  add column if not exists budget_bucket text
    check (budget_bucket is null or budget_bucket in (
      'the_stay','the_weekend','the_takeover','the_whole_thing','other','skip'
    )),
  add column if not exists budget_other_text text,
  add column if not exists split_intent text
    check (split_intent is null or split_intent in ('yes','no','maybe')),
  add column if not exists split_count int check (split_count is null or split_count >= 1),
  add column if not exists appeal_text text,
  add column if not exists alt_dates_requested boolean not null default false,
  add column if not exists deposit_link_requested boolean not null default false;

-- ─────────────────────────────────────────────────────────────────
-- 2. Pricing config additions: sticker-shock + deposit defaults
-- ─────────────────────────────────────────────────────────────────
insert into public.pricing_config (key, value_text, value_number, description) values
  ('alt_dates_threshold_cents', null, 30000,
     'Per-person-per-night threshold (in cents) above which the sticker-shock nudge fires. Default $300/person/night.'),
  ('deposit_amount_cents', null, 150000,
     'Flat deposit amount (in cents) for the "Hold these dates" CTA. Default $1,500.')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────
-- 3. pricing_events: known event windows used by the Step 4 conditional
-- ─────────────────────────────────────────────────────────────────
-- Used by the Step 4 gate logic — if any night in a guest's requested
-- range falls within an active event window, Step 4 fires regardless
-- of group size or reason. recurring_yearly=true means the gate also
-- matches the same MM-DD range in subsequent years.
create table if not exists public.pricing_events (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  start_date       date not null,
  end_date         date not null check (end_date >= start_date),
  recurring_yearly boolean not null default true,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.pricing_events enable row level security;

create index if not exists pricing_events_active_idx
  on public.pricing_events (active, start_date) where active;

-- Seed the 9 known Chicago event windows (per docs/pricing-strategy.md §9).
-- Anchored to 2026 dates; recurring_yearly=true means the same MM-DD
-- range matches subsequent years too. Adjust per-year specifics
-- (e.g., Lolla, Marathon) by editing rows.
insert into public.pricing_events (name, start_date, end_date, recurring_yearly) values
  ('NYE',                '2026-12-29', '2027-01-02', true),
  ('MLK weekend',        '2027-01-15', '2027-01-19', true),
  ('Memorial Day',       '2026-05-22', '2026-05-25', true),
  ('July 4 weekend',     '2026-07-02', '2026-07-06', true),
  ('Lollapalooza',       '2026-07-30', '2026-08-03', true),
  ('Labor Day',          '2026-09-04', '2026-09-07', true),
  ('Chicago Marathon',   '2026-10-09', '2026-10-12', true),
  ('Thanksgiving',       '2026-11-25', '2026-11-29', true),
  ('Christmas week',     '2026-12-22', '2026-12-28', true)
on conflict do nothing;
