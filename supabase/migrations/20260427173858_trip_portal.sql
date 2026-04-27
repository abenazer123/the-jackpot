-- Phase 2 Push 1 — trip portal page columns.
--
-- share_views          — running count of /trip/[token] page loads,
--                        deduplicated server-side by IP within a
--                        30-min window. Surfaced in the host-share
--                        notification + (later) a host dashboard.
-- shared_at            — timestamp of the first /trip/[token] view
--                        OR first share-CTA tap, whichever comes
--                        first. Anchors the 60-day expiry window.
-- share_email_sent_at  — gate for the host-share signal email so a
--                        re-opened preview sheet doesn't re-fire it.

alter table public.inquiries
  add column if not exists share_views integer not null default 0,
  add column if not exists shared_at timestamptz,
  add column if not exists share_email_sent_at timestamptz;

create index if not exists inquiries_shared_at_idx
  on public.inquiries (shared_at)
  where shared_at is not null;
