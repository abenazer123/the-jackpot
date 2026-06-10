-- Reserve-with-no-payment fields on inquiries.
--
-- The chat agent's reserve flow soft-holds dates with nothing due now
-- and books a quick call with Abe to lock it in. These columns record
-- that a row came in via reserve and when the guest is free to talk.
--
--   reserved_at          — set when the guest taps "Hold my dates".
--   reserve_call_window  — the guest's chosen call window string
--                          (e.g. "Tomorrow, evening"). Free text; Abe
--                          coordinates the exact time off this.
--
-- source='chat_reserve' already distinguishes these rows (set by
-- /api/inquiry-agent/reserve); these add the timing detail Abe needs.

alter table public.inquiries
  add column if not exists reserved_at timestamptz,
  add column if not exists reserve_call_window text;

create index if not exists inquiries_reserved_at_idx
  on public.inquiries (reserved_at desc)
  where reserved_at is not null;
