-- Phase 1.5 — share_token column for the routed funnel.
--
-- A 22-character URL-safe nanoid identifying each inquiry in the
-- public-facing URLs. Used by both:
--   /book/quote/<token>   — interactive booker view, with CTAs
--   /trip/<token>         — read-only public share page (Phase 2)
--
-- Same token on both routes — different views of the same row.
-- Generated server-side on first finalize. Persisted on the row so
-- subsequent re-fetches and CTA flag updates resolve consistently.
--
-- Why a separate column instead of using the inquiry uuid: UUIDs
-- with hyphens look utility-grade in URL bars and paste poorly in
-- text messages. A nanoid is short, URL-clean, and the entropy
-- (~131 bits) is plenty for our scale.

alter table public.inquiries
  add column if not exists share_token text;

-- Partial unique index — only rows with a token are in the tree,
-- so we don't pay an index slot for partial-status drafts.
create unique index if not exists inquiries_share_token_idx
  on public.inquiries (share_token)
  where share_token is not null;
