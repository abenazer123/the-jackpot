-- Quote Reveal redesign — three-path success screen.
--
-- Removes Step 4 ("Shape Your Stay") from the funnel. Budget signal is
-- now captured implicitly through which of three reaction paths the
-- visitor takes on the success screen:
--   1. "interested"  — budget works, ready to talk
--   2. "share"       — budget probably works, sending to group
--   3. "appeal"      — budget is a stretch, with an explicit
--                      stretch_level + free-text "what would work"
--
-- The legacy Step 4 columns (budget_bucket, budget_other_text,
-- split_intent, split_count) are LEFT IN PLACE so existing rows keep
-- their data. New writes won't touch them.

alter table public.inquiries
  -- Which path the visitor took on the success screen. Null until they
  -- click one of the three CTAs.
  add column if not exists primary_cta_path text
    check (primary_cta_path in ('interested', 'share', 'appeal') or primary_cta_path is null),

  -- Path 2 ("Send this to my group") — fires immediately on tap so
  -- Abe knows they wanted to share even if they never click a primary
  -- CTA afterwards.
  add column if not exists share_requested boolean not null default false,

  -- Path 3 ("If the numbers don't line up...") — captures how far off
  -- the price was from what the visitor's group expected. Pairs with
  -- the existing appeal_text column.
  add column if not exists appeal_stretch_level text
    check (appeal_stretch_level in ('close', 'far') or appeal_stretch_level is null),

  -- Split-pay link tap — replaces the Step 4 split_intent question.
  -- Visitor explicitly indicated they want individual payment links.
  add column if not exists split_pay_requested boolean not null default false;

-- Index on primary_cta_path so Abe can filter the inquiries table by
-- path without a sequential scan.
create index if not exists inquiries_primary_cta_path_idx
  on public.inquiries (primary_cta_path)
  where primary_cta_path is not null;
