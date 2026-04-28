-- Phase 2 Push 3 — friend-facing CTAs on the trip portal.
--
-- Two tables, both keyed off the inquiry the trip page belongs to
-- plus an anonymous per-viewer id (a 16-char random token stored
-- in a long-lived cookie). The viewer id lets a friend change
-- their vote or update their reservation without auth.
--
-- Privacy: viewer_id is opaque, no IP / fingerprinting. The
-- coordinator can't see who voted what — just the tally — until
-- someone reserves (and they leave their name explicitly).

-- ─────────────────────────────────────────────────────────────────
-- trip_votes
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.trip_votes (
  inquiry_id  uuid not null references public.inquiries(id) on delete cascade,
  viewer_id   text not null,
  vote        text not null check (vote in ('yes', 'maybe', 'no')),
  voted_at    timestamptz not null default now(),
  primary key (inquiry_id, viewer_id)
);

create index if not exists trip_votes_inquiry_id_idx
  on public.trip_votes (inquiry_id);

alter table public.trip_votes enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- trip_reservations
-- ─────────────────────────────────────────────────────────────────
-- Friend tapped "Reserve my stay" + left name+email. Fires Abe a
-- notification email so he can manually loop them into the booking.
-- v1: just a record of intent. Split-pay link generation lands later.
create table if not exists public.trip_reservations (
  inquiry_id   uuid not null references public.inquiries(id) on delete cascade,
  viewer_id    text not null,
  name         text not null,
  email        text not null,
  reserved_at  timestamptz not null default now(),
  primary key (inquiry_id, viewer_id)
);

create index if not exists trip_reservations_inquiry_id_idx
  on public.trip_reservations (inquiry_id);

alter table public.trip_reservations enable row level security;
