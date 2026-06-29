-- Stripe billing identifiers so the saved card can be charged again for the
-- later milestone payments (and the security hold).
--
-- stripe_customer_id lives on the inquiry (one customer per guest, reused
-- across their payments). stripe_payment_method_id lives on the signed
-- agreement (the specific card saved at deposit time).

alter table public.inquiries
  add column if not exists stripe_customer_id text;

alter table public.booking_agreements
  add column if not exists stripe_payment_method_id text;
