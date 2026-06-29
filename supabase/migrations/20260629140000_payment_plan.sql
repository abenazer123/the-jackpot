-- Which payment plan the guest chose at checkout: how much they paid today.
--   reserve - the flat $500 hold (default for older rows)
--   half    - 50 percent today
--   full    - paid in full today
-- The actual amount paid today is in deposit_amount_cents; this records the
-- intent so the milestone auto-charge knows how many payments remain.

alter table public.booking_agreements
  add column if not exists payment_plan text not null default 'reserve'
    check (payment_plan in ('reserve', 'half', 'full'));
