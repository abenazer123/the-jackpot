# Architecture decisions — what's permanent, what's temporary

This doc captures the *design intent* behind the
revenue-management system, the **stopgap decisions** we're
making to ship value before the proper layer is in place, and
the **revisit list** so future-us doesn't accumulate implicit
assumptions.

Companion doc: `data-watchlist.md` tracks specific *values*
that need to become dynamic. This doc tracks *structural*
decisions.

---

## §1. Booking ingestion middle layer (long-term design)

### Why we need it

Today every metric that touches revenue, occupancy, or ADR has
to call PriceLabs at request time. That's:

- **Slow** — `/v1/reservation_data` is paginated; even the
  current ~84 reservations is a 1–2s call. With 12+ months of
  history it gets worse.
- **Unreliable** — PriceLabs API can return errors or be
  unreachable; the dashboard shouldn't go dark when it does.
- **Lossy** — PriceLabs is a *read-through* pricing tool, not
  an archive. We don't know how long they retain reservation
  history. **We should own the copy.**
- **Single-channel by accident** — every ad-hoc query so far
  has hit only Airbnb because `pricing_config` stores one
  listing. The Jackpot also has VRBO bookings (real revenue,
  no ingestion path), Booking.com (push-enabled, currently
  zero realized), and direct (Phase 8). The metrics layer
  needs all of them blended.

### Schema sketch — `reservations`

Channel-agnostic. PK is `(channel, reservation_id)` so the same
PriceLabs row across PMSes never collides.

```sql
create table public.reservations (
  channel               text not null check (channel in (
    'airbnb','vrbo','bcom','direct'
  )),
  reservation_id        text not null,
  listing_id            text not null,        -- PriceLabs listing id
  check_in              date not null,
  check_out             date not null,
  nights                int generated always as (check_out - check_in) stored,
  booking_status        text not null check (booking_status in ('booked','cancelled')),
  booked_date           timestamptz,
  cancelled_at          timestamptz,
  -- Money lines (cents). Nullable because not all channels expose all fields.
  gross_revenue_cents   integer,              -- what guest paid (close to total_cost)
  net_revenue_cents     integer,              -- after platform fees (close to rental_revenue)
  host_fee_cents        integer,              -- platform commission to host
  cleaning_fee_cents    integer,
  -- Audit / debug
  raw_payload           jsonb,                -- the original PriceLabs row
  synced_at             timestamptz not null default now(),
  primary key (channel, reservation_id)
);

create index reservations_check_in_idx on public.reservations (check_in);
create index reservations_booked_date_idx on public.reservations (booked_date);
create index reservations_listing_idx on public.reservations (listing_id);
```

Decision still TBD: separate `reservations_raw` table vs the
`raw_payload jsonb` column. The column is simpler; the
separate table is cleaner if raw payloads start to balloon.
Default to the column until proven otherwise.

### Ingestion

- **Cadence**: daily Vercel cron at 3am Chicago time (after
  midnight bookings settle, before the morning briefing).
- **Helper**: `fetchReservations({ pms })` already wraps the
  endpoint with auto-pagination. The cron loops the channel
  list and upserts.
- **Window**: first sync = trailing 24 months (one call per
  channel). Daily sync after that = trailing 60 days (covers
  late-arriving cancellations + recent activity, with overlap
  for safety; upsert is idempotent).
- **Failure mode**: cron logs to Supabase `cron_runs` table
  (not yet built); a stale `synced_at` on the dashboard
  indicates the cron is broken without taking the dashboard
  down.

### What this enables

Every KB §5.1 KPI:

- ADR (all-night, weekend, channel-specific) — group by date /
  day-of-week / channel.
- Occupancy — combined with listing inventory (KB §2.1: 14
  guests, 4 BR; PriceLabs API also exposes inventory).
- RevPAR — ADR × occupancy.
- Net revenue rate — `net_revenue_cents / gross_revenue_cents`
  per booking, blended over window.
- Lead time distribution — `check_in − booked_date` histogram.
- Pacing — group bookings by `booked_date` per forward arrival
  date.
- Channel mix — group revenue by `channel`.
- YoY pacing — once we have 12+ months of `synced_at` history.

This maps to `phase-6-architecture-v2.md` §6.1 ("API data
plumbing"). Treat that as the canonical scope; this doc is the
concrete design.

---

## §2. Two-layer UI (long-term design)

### Today's structure (cost-up)

```
/admin                  ← cost KPIs (baseline implied, avg, this month)
                          + cost-structure breakdown
                          + drift signals
                          + recent entries
/admin/categories       ← edit baselines
/admin/entries          ← log money out
/admin/monthly          ← month × bucket totals
/admin/capex            ← long-lived purchases
```

The dashboard answers *"how much did we spend?"* well.
It does **not** answer the questions a revenue manager actually
asks every morning:

- *Are we tracking toward $200K / $175K?*
- *What's our weekend ADR pacing vs last week?*
- *Are we pricing too low for next weekend?*
- *What's our break-even at current cost structure?*
- *Which channel is converting best?*

### Long-term structure (metrics-first, cost as drill-down)

Two top-level surfaces:

**Performance (`/admin` future):** the daily-driver dashboard.
- Hero KPIs: ADR (window), occupancy, RevPAR, contribution
  margin, break-even, goal pacing toward $175K / $200K.
- Forward-looking: pacing curve, compression flags, suggested
  rate moves (Phase 6.2 Daily Pulse briefing).
- Each KPI links to a drill-down — clicking ADR opens a
  per-booking breakdown; clicking break-even opens cost
  detail.

**Operations (`/admin/operations` future):** the cost surface
we have today. Categories, entries, monthly bucket totals,
capex. The detail layer.

**Top nav (long-term):** Performance · Bookings · Operations ·
Settings. ("Bookings" surfaces the ingested
`reservations` table once it exists.)

### Why we're not doing this yet

The right structure depends on what KPIs we *actually* find
useful once they're populated with real data. Restructuring
the UI before the metrics work feels reactive. Better to:

1. Ship the metrics into the existing /admin as a section
   (this round).
2. Live with them for a couple weeks.
3. Restructure once we know which KPIs we open first every
   morning.

---

## §3. Stopgap decisions (this round) and what to revisit

Each row is a decision we're making now to ship CVP KPIs
visible on /admin. None of these should outlive the proper
version they point to.

| Stopgap | Why temporary | Proper version |
|---|---|---|
| Live `fetchReservations` on /admin render | No persistence yet; slow on cold cache; goes dark on API error | Daily cron writing to `reservations` table; dashboard reads from Supabase |
| Airbnb only (single-listing from `pricing_config.pricelabs_listing_id`) | Multi-channel aggregation is a real design effort | Loop pms list (`airbnb`, `vrbo`, …) and union, blended ADR + per-channel breakdown |
| Channel fees excluded from contribution margin | B2 fee rates not stored numerically; lives in seed `notes` text | Store rates in `pricing_config` keys or a `channel_fees` table; include in CM formula |
| CVP KPIs added as a section to existing `/admin` | UI restructure depends on which KPIs prove useful | New `/admin/performance` page once §2 redesign settles |
| Bucket legend hardcoded in shared const | Bucket taxonomy is structural, low churn | Acceptable as-is; revisit only if buckets need operator editing |
| ADR window = 180 trailing days | Matches KB §2.3 reporting window for now | Configurable window, plus weekend-only / channel-specific cuts |

### How to use this list

When implementing, every commit should reference the row above
that it ships against — so when we do the proper version,
`git log --grep` finds the work to undo. Example commit
message: *"feat: live PriceLabs ADR pull (stopgap §3 row 1)"*.

---

## §4. Open questions

Things still being thought through. No decision yet.

- **Where does the `reservations` table live in the migration
  history?** New migration, or extend the daily-snapshot table
  PriceLabs-related work has been talking about
  (`listing_prices` already exists)?
- **How do we model direct bookings (Phase 8)?** They don't
  flow through PriceLabs. A separate ingestion path or a
  manual-entry surface in the UI?
- **What's the right cancellation accounting?** A booking
  cancelled mid-month: do we keep its `rental_revenue` in
  trailing ADR? Probably no, but worth confirming.
- **Avg LOS — is per-channel meaningful?** Airbnb's 3-night
  bookings vs VRBO's longer stays might inform pricing
  strategy more than a blended number.
- **Goal pacing extrapolation method.** Naive `(YTD / months)
  × 12` undercounts summer-heavy properties. KB §2.4
  seasonality table has the shape — apply seasonal weights.
