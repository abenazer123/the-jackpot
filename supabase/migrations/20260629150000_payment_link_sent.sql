-- Track when a payment link was emailed to an inquiry from the admin, so the
-- Inquiries panel can show that it went out (and how many times).

alter table public.inquiries
  add column if not exists payment_link_sent_at timestamptz;

alter table public.inquiries
  add column if not exists payment_link_sent_count integer not null default 0;
