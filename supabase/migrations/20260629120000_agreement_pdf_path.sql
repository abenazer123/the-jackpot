-- Path to the generated signed-agreement PDF in the private booking-ids
-- bucket. Written at signing time alongside the rest of the record, so the
-- contract package includes an openable signed document.

alter table public.booking_agreements
  add column if not exists agreement_pdf_path text;
