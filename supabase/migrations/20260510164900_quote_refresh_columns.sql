-- Quote refresh columns.
--
-- The original quote_snapshot + quote_total_cents stay immutable —
-- they preserve what the guest saw at submit time (audit trail).
-- These three new columns track a *re-quoted* version when the
-- live PriceLabs price for the same dates has dropped meaningfully
-- since the original quote.
--
-- Render rule on /trip/[token]:
--   if quote_refreshed_total_cents IS NOT NULL
--     and quote_refreshed_total_cents < quote_total_cents:
--       show refreshed prominently with original strikethrough
--   else:
--       show original (current behavior)
--
-- Why we don't refresh upward: the trip page is a re-engagement
-- surface for stale leads; raising the price after they inquired
-- would feel like a bait-and-switch. We only "honor the lower
-- number" since they last looked.

alter table public.inquiries
  add column if not exists quote_refreshed_snapshot jsonb,
  add column if not exists quote_refreshed_total_cents integer,
  add column if not exists quote_refreshed_at timestamptz;

-- No index needed — these columns are read on a single-row lookup
-- by share_token (already indexed) on the trip page.
