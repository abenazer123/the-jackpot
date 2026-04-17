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
