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
