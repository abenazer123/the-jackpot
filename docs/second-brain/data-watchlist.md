# Data watchlist — values to revisit

Tracker for *values* (numbers, rates, definitions) that look
hardcoded in code or UI text and should become dynamic. This
is the operational counterpart to
`architecture-decisions.md`, which tracks *structural*
decisions.

Each entry: **what / where it lives now / what should change /
why**.

---

## 1. Hardcoded today, needs dynamic source

### Channel fee rates

- **What**: Airbnb host fee 15.5% (17.5% if Super Strict),
  VRBO 5%, Booking.com ~15%.
- **Where it lives now**: free-text `notes` column on the seed
  rows for `expense_categories.airbnb_fee` /
  `vrbo_fee` / `bcom_fee` (migration
  `20260501031607_expense_tracking.sql`). Also referenced as
  literals in /admin overview's Cost Structure card subtitle.
- **What should change**: store the percentage as a numeric
  value queryable from code. Either as `value_number` rows in
  `pricing_config` (`airbnb_host_fee_bps`, `vrbo_host_fee_bps`,
  `bcom_host_fee_bps` in basis points) or as a
  `channel_fees` table if rates need to vary by listing.
- **Why**: contribution-margin calculations need to multiply
  this against ADR. Parsing `notes` text is brittle. Today's
  CVP card explicitly excludes channel fees because of this.

### Stripe processing rate

- **What**: 2.9% + $0.30 per transaction (direct bookings
  only).
- **Where it lives now**: `expense_categories.stripe_processing`
  row, hardcoded into the Cost Structure card text on /admin.
- **What should change**: same shape as channel fees —
  numeric in `pricing_config` (`stripe_pct_bps`,
  `stripe_flat_cents`) so direct-booking math is computable.
- **Why**: only matters once direct bookings exist (Phase 8),
  but capture now so the Phase 8 work doesn't have to
  rediscover the rates.

### Season boundaries

- **What**: KB §2.4 — Peak Jun–Aug, Spring shoulder Mar–May,
  Fall shoulder Sep–Nov, Winter Dec–Feb. Plus the winter gas
  uplift (+$250/mo Nov–Mar).
- **Where it lives now**: KB markdown only. Not referenced by
  any code today (we explicitly skipped the season indicator
  on /admin to avoid hardcoding).
- **What should change**: a `seasons` config — either
  `pricing_config` rows, a small `seasons` table, or
  derived from `pricing_events` if we want to subsume both.
- **Why**: anything that conditionally adjusts behavior by
  season (winter cost uplift, peak ADR target, "start of
  season" prompts) needs the boundaries in one place, not
  re-derived in each surface.

### KB cost-line baselines

- **What**: $5,990/mo fixed, $540/booking variable, $71,880/yr
  fixed. These echo through KB §2.2 and §2.5.
- **Where it lives now**: derived correctly in /admin from
  `expense_categories.baseline_amount_cents` (so the dashboard
  is *not* hardcoded — it sums the active A1 monthly
  categories). The KB doc itself is the only place these
  totals appear as literals.
- **What should change**: nothing in code; just keep the KB
  totals in sync if categories are added/edited. Possibly a
  validation check that flags drift between `master-kb-v1.md`
  §2.2 and the live category sums.
- **Why**: safe today, but easy to drift silently as Abe edits
  categories and forgets to update the KB.

---

## 2. Pulled live from PriceLabs at render time

These are accurate today but cost an API call per render.

### ADR window

- **What**: 180-day trailing realized ADR, single-channel
  (Airbnb).
- **Where it lives now**: `getRealizedAdr180d()` in
  `src/lib/pricing/realized.ts`. Called from /admin server
  component on every page load.
- **What should change**: read from
  `reservations` Supabase table after Phase 6.1 ingestion
  cron is in place.
- **Why**: latency + reliability + ability to cache. Maps to
  `architecture-decisions.md` §3 row 1.

### Avg length-of-stay

- **What**: blended LOS across the same 180-day window, same
  single-channel.
- **Where it lives now**: same `realized.ts` helper.
- **What should change**: same as ADR (Phase 6.1).
- **Why**: same.

### Listing scope

- **What**: only the listing in
  `pricing_config.pricelabs_listing_id` (currently the Airbnb
  listing) is queried. VRBO bookings exist but aren't in any
  metric.
- **Where it lives now**: `realized.ts` reads single key.
- **What should change**: enumerate all syncing listings via
  `fetchListings({ onlySyncing: true })`, group by `pms`, pull
  reservations for each, blend (or break out per channel).
- **Why**: blended ADR is the KB §2.3 number. Single-channel
  ADR misleads pricing decisions.

---

## 3. Awaiting Phase 6.1 reservation snapshot

These need the persisted `reservations` table before they're
buildable.

| KPI | Why blocked |
|---|---|
| **Net revenue rate** | needs `host_fee_cents` per booking; live `reservation_data` doesn't expose host_fee directly |
| **Channel-specific contribution margin** | needs per-channel host fees + per-channel ADR — both require the snapshot |
| **Occupancy** | needs nights occupied / nights available; nights-available comes from listing inventory + blocked dates |
| **RevPAR** | derived from ADR × occupancy, both blocked above |
| **Lead time distribution** | needs `booked_date` history and ability to filter; live pull works for snapshots but not historical analysis |
| **Goal pacing ($175K / $200K)** | YTD revenue summed from `reservations` joined with cost data |
| **YoY pacing** | needs 12+ months of `synced_at` history |

---

## 4. Operator-managed, may need UI

Values that *are* numeric and configurable, but only via SQL or
markdown today.

### Goal targets

- **What**: $175K floor / $200K stretch (KB §2.5).
- **Where it lives now**: KB doc only.
- **What should change**: `pricing_config` rows
  (`revenue_goal_floor_cents`, `revenue_goal_stretch_cents`)
  read by goal-pacing widgets when those exist.
- **Why**: pacing surfaces will compare YTD revenue to these
  numbers. Currently no surface uses them.

### Min/base/max nightly anchors

- **What**: PriceLabs-side anchors that frame the dynamic
  pricing. KB §8.1.
- **Where it lives now**: PriceLabs (not exposed in our DB);
  base/min/max would have to be fetched via
  `GET /v1/listings/{id}` (not yet wired).
- **What should change**: surface read-only on /admin for
  reference; `POST /v1/listings` to update from our UI is
  Phase 6+ scope.
- **Why**: knowing the current floor without flipping over to
  PriceLabs UI is faster, especially when correlating
  drift signals with rate changes.

### Cost-line baselines (already operator-managed)

- **What**: `expense_categories.baseline_amount_cents`.
- **Where it lives now**: editable inline at
  `/admin/categories`. ✅ done.
- **What should change**: nothing structural; possibly a
  history table so a baseline change leaves a record (we can
  see when Abe last revised the gas baseline).
- **Why**: helpful audit trail but not load-bearing.

---

## How to use this list

When you write code that touches one of these values, add a
comment pointing here:

```ts
// data-watchlist §1 (channel fee rates) — currently excluded
const cmCents = adrCents - varCostPerNightCents;
```

When you build the proper version, remove the entry and keep a
mention in the commit message so `git log --grep="watchlist"`
finds the cleanup.
