-- raw_data preserves the full per-date PriceLabs payload (weekly/monthly
-- discount multipliers, extra_person_fee, check_in/check_out flags,
-- demand color, booking status + same-time-last-year, ADR — everything
-- we don't yet use but may want without another migration).
-- `available` is the authoritative booking flag: false when Airbnb shows
-- the date as booked (PriceLabs sets user_price=-1) OR when PriceLabs
-- flagged it unbookable due to min-stay / check-in / check-out rules.
alter table public.listing_prices
  add column if not exists raw_data  jsonb,
  add column if not exists available boolean not null default true;

create index if not exists listing_prices_available_idx
  on public.listing_prices (listing_id, stay_date)
  where available = false;
