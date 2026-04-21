-- Supabase migration: inquiries table for booking funnel submissions.
-- Run once in the Supabase SQL Editor (Project → SQL Editor → New query).

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  arrival date not null,
  departure date not null,
  nights int generated always as ((departure - arrival)) stored,
  email text not null,
  name text not null,
  phone text not null,
  guests int not null check (guests between 1 and 14),
  reason text not null,
  source text,
  venue text,
  user_agent text,
  ip text
);

-- RLS on, no policies defined — the service_role key bypasses RLS on the
-- server, and the anon key cannot read/write. That's what we want for a
-- write-only lead intake: never expose rows to the public.
alter table public.inquiries enable row level security;

create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);
create index if not exists inquiries_email_idx on public.inquiries (email);

-- Attribution columns (added 2026-04-17). UTM params, click IDs, referrer,
-- landing & current path. localStorage on the client keeps UTMs for 30 days
-- (sliding window) so last-touch attribution holds across sessions.
alter table public.inquiries
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists gclid text,
  add column if not exists fbclid text,
  add column if not exists msclkid text,
  add column if not exists referrer text,
  add column if not exists landing_path text,
  add column if not exists current_path text;

-- Partial indexes — only rows with actual attribution live in the tree.
create index if not exists inquiries_utm_source_idx
  on public.inquiries (utm_source)
  where utm_source is not null;
create index if not exists inquiries_utm_campaign_idx
  on public.inquiries (utm_campaign)
  where utm_campaign is not null;

-- =============================================================
-- PriceLabs integration (added 2026-04-20)
-- =============================================================
-- Nightly cache of PriceLabs' dynamic suggested rates. Populated by
-- /api/cron/pricelabs-sync once a day; every other consumer reads from
-- this table, never from PriceLabs directly.
create table if not exists public.listing_prices (
  listing_id   text not null,
  stay_date    date not null,
  rate_cents   int  not null check (rate_cents >= 0),
  min_stay     int  not null default 2 check (min_stay >= 1),
  unbookable   boolean not null default false,
  demand_desc  text,
  currency     text not null default 'USD',
  fetched_at   timestamptz not null default now(),
  primary key (listing_id, stay_date)
);
create index if not exists listing_prices_stay_date_idx
  on public.listing_prices (stay_date);

alter table public.listing_prices enable row level security;

-- Key/value config so Abe can tune numeric rates from the Supabase
-- Table Editor without a code deploy. value_text holds strings
-- (e.g., the PriceLabs listing id); value_number holds dollar amounts
-- in cents or percentages in basis points (1 bps = 0.01%).
create table if not exists public.pricing_config (
  key          text primary key,
  value_text   text,
  value_number numeric,
  description  text not null,
  updated_at   timestamptz not null default now()
);

alter table public.pricing_config enable row level security;

insert into public.pricing_config (key, value_text, value_number, description) values
  ('pricelabs_listing_id', '1517776645045787467', null,
     'PriceLabs listing id to pull nightly rates for. Currently the Airbnb listing.'),
  ('pricelabs_pms',        'airbnb',              null,
     'PMS name PriceLabs expects alongside the listing id.'),
  ('cleaning_fee_cents',   null,                  47500,
     'Flat cleaning fee in cents (currently $475).'),
  ('tax_rate_bps',         null,                  1737,
     'Effective Chicago STR tax in basis points (~17.37%).'),
  ('tax_enabled',          'false',               null,
     'Gate tax-inclusive display until Abe is registered with Chicago DOF + IL DOR.'),
  ('min_stay_floor',       null,                  2,
     'Absolute minimum nights we quote, regardless of PriceLabs min_stay.'),
  ('max_guests',           null,                  14,
     'Max guests we quote for (whole-house product).'),
  ('min_nightly_cents',    null,                  40000,
     'Safety floor: never quote a night below $400 even if PriceLabs recommends lower.'),
  ('airbnb_fee_bps',       null,                  1420,
     'Airbnb guest service fee (~14.2%). Used only for the "saved vs Airbnb" narrative line.'),
  ('vrbo_fee_bps',         null,                  1000,
     'VRBO guest service fee (~10%). Narrative only.')
on conflict (key) do nothing;

-- Discount rules applied at quote time. Non-stackable resolution:
-- computeQuote() picks the single rule with the largest dollar impact
-- unless an explicit promo code is supplied (code overrides automatic).
-- Kept as a skeleton in v1 — no seed rows because PriceLabs returns
-- los_pricing:null for The Jackpot (no LOS tiers configured there yet).
create table if not exists public.discounts (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('los','occasion','code','date_window')),
  label           text not null,
  min_nights      int,
  occasion        text,
  code            text,
  stay_start      date,
  stay_end        date,
  valid_from      date,
  valid_to        date,
  percent_off_bps int check (percent_off_bps between 0 and 5000),
  amount_off_cents int check (amount_off_cents >= 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists discounts_kind_active_idx
  on public.discounts (kind) where active;
create unique index if not exists discounts_code_unique
  on public.discounts (lower(code)) where code is not null;

alter table public.discounts enable row level security;

-- Freeze the quote JSON at the moment of submit, so an email sent
-- weeks later still matches what the guest saw. quote_total_cents
-- is denormalized for cheap indexing/reporting.
alter table public.inquiries
  add column if not exists quote_snapshot    jsonb,
  add column if not exists quote_total_cents int;

-- =============================================================
-- Funnel partial-save (added 2026-04-20)
-- =============================================================
-- The funnel now POSTs twice: a `draft` the moment dates+email are
-- captured (Step 1 → Step 2 entry), then a `finalize` on full submit.
-- Drafts become visible partial-abandon leads for Abe; finalize flips
-- the same row to `submitted` and fires emails.

-- Backfill existing rows as submitted before adding NOT NULL.
alter table public.inquiries
  add column if not exists status text;
update public.inquiries set status = 'submitted' where status is null;
alter table public.inquiries
  alter column status set not null,
  alter column status set default 'partial';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_status_check'
  ) then
    alter table public.inquiries
      add constraint inquiries_status_check
      check (status in ('partial','submitted'));
  end if;
end$$;

-- Relax NOT NULLs that aren't known until Step 3.
alter table public.inquiries
  alter column name drop not null,
  alter column phone drop not null,
  alter column guests drop not null,
  alter column reason drop not null;

-- Conditional completeness: submitted rows must be fully populated.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_submitted_complete'
  ) then
    alter table public.inquiries
      add constraint inquiries_submitted_complete
      check (
        status = 'partial'
        or (name is not null and phone is not null
            and guests is not null and reason is not null)
      );
  end if;
end$$;

-- Indexes for abandon visibility + rate-limit lookups.
create index if not exists inquiries_status_created_idx
  on public.inquiries (status, created_at desc);
create index if not exists inquiries_partial_ip_idx
  on public.inquiries (ip, created_at desc)
  where status = 'partial';

-- =============================================================
-- Richer PriceLabs capture (added 2026-04-20)
-- =============================================================
-- raw_data preserves the full per-date PriceLabs payload (weekly/monthly
-- discount multipliers, extra_person_fee, check_in/check_out flags,
-- demand color, booking status + same-time-last-year, ADR — all the
-- things we don't yet use but may want without another migration).
-- `available` is the authoritative booking flag: false when Airbnb shows
-- the date as booked (PriceLabs sets user_price=-1) OR when PriceLabs
-- flagged it unbookable due to min-stay / check-in / check-out rules.
alter table public.listing_prices
  add column if not exists raw_data  jsonb,
  add column if not exists available boolean not null default true;

create index if not exists listing_prices_available_idx
  on public.listing_prices (listing_id, stay_date)
  where available = false;
