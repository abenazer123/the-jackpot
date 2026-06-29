-- Self-built e-signature audit record for the /confirm/[token] booking page.
--
-- One append-only row per signed booking agreement. This is the legal
-- record: who signed (typed name), the exact agreement version + a SHA-256
-- hash of the precise text shown, which acknowledgments were checked, the
-- timestamp, IP, and user-agent, plus the deposit payment reference once
-- Stripe is wired. Valid e-signature under US ESIGN/UETA.
--
-- Append-only by convention: rows are inserted, never updated, so the
-- record cannot be altered after signing. (deposit_payment_ref is the one
-- exception, back-filled by the Stripe webhook on a successful deposit.)
--
-- RLS is on with no policies: only the service role (server-side, via
-- /api/booking/*) can read/write, same pattern as inquiries / landing_event.

create table if not exists public.booking_agreements (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- the booking this agreement belongs to
  inquiry_id uuid references public.inquiries (id),
  share_token text not null,

  -- who signed
  guest_name text,
  signature_name text not null,

  -- exactly what they agreed to
  agreement_version text not null,
  agreement_hash text not null,
  acknowledgments jsonb not null default '[]'::jsonb,

  -- when / from where
  signed_at timestamptz not null default now(),
  ip text,
  user_agent text,

  -- path to the guest's photo ID in the private booking-ids storage bucket
  -- (never a public URL; viewed via short-lived signed URLs in admin)
  id_document_path text,

  -- payment (back-filled by the Stripe webhook in the deposit phase)
  deposit_payment_ref text,
  deposit_amount_cents integer,

  status text not null default 'signed'
    check (status in ('signed', 'deposit_paid', 'void'))
);

create index if not exists booking_agreements_token_idx
  on public.booking_agreements (share_token);

create index if not exists booking_agreements_inquiry_idx
  on public.booking_agreements (inquiry_id);

alter table public.booking_agreements enable row level security;

-- Private storage bucket for guest photo IDs. public=false, so files are
-- only reachable with the service role (server) or a short-lived signed
-- URL. No storage.objects policies are added, which keeps it service-role
-- only, the same trust model as the table above.
insert into storage.buckets (id, name, public)
values ('booking-ids', 'booking-ids', false)
on conflict (id) do nothing;
