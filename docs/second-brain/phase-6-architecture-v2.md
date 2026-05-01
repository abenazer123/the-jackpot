# Phase 6 — Second Brain Data & Capability Architecture
## Version 2.0

**Property:** The Jackpot — Stravon Group LLC | **Last Updated:** May 1, 2026
**Supersedes:** Phase 6 v1.0 (April 30, 2026)
**Companion docs:** Master KB v1.0, thresholds.yaml, Second Brain + Semi-Agent Spec, Second Brain System Prompt

---

## §0. About This Document

This is the canonical strategic reference for what we're building: a **Second Brain** for revenue management of The Jackpot — a system that briefs, suggests, tracks decisions, and assesses outcomes, with a defined evolution path toward bounded autonomous execution.

Version 2.0 reflects three substantive shifts since v1:

1. **PriceLabs API ground truth.** The Customer API surface was probed end-to-end. The 11-endpoint inventory replaces v1's speculative endpoint list. Most importantly: the API exposes more write capability and more market-relative benchmarking than v1 assumed — but less programmatic depth on Market Dashboards and Portfolio Analytics than v1 hoped for.

2. **Browser scraping as a first-class data plane.** PriceLabs' Market Dashboards, Portfolio Analytics deep views, and Compare Competitor Calendar are dashboard-only. Rather than accept this as a hard limitation, the Second Brain extracts dashboard data via scheduled browser automation (Claude in Chrome or Playwright) on per-target cadences. Most v1 "no match" gaps become "scrapable on cadence."

3. **Stack alignment.** The runtime is the existing Next.js + Supabase + `lib/pricelabs.ts` infrastructure, not greenfield. Schemas are Postgres tables, scrapers extend the existing cron, briefings render in the existing app surface.

Version 2.0 does not replace the Master KB or thresholds.yaml — those remain the knowledge and calibration layers. It defines the *system* that consumes them.

What this document is *not*: an engineering specification with concrete schemas and contracts (that's the Second Brain + Semi-Agent Spec) or a runtime instruction set (that's the Second Brain System Prompt). This is the strategic architecture — the WHAT and WHY.

---

## §1. The Second Brain: Operating Concept

### 1.1 What It Does

Four core jobs:

1. **Brief** — observe what's happening (in your data, your market, the calendar, the regulatory landscape) and surface what matters.
2. **Suggest** — recommend specific actions with reasoning chains, KB citations, source links, and breakdowns of how it got to the recommendation.
3. **Track** — record decisions you make and observe what happens after, building an institutional record of your operating history.
4. **Assess** — periodically retrospect on past decisions: did the outcome match the prediction? what factors drove the variance? what calibration shifts does this suggest?

### 1.2 The Evolution Path: Second Brain → Semi-Agent → Agent

The system grows in autonomy over time. Five stages:

| Stage | Authority | Trigger to Advance |
|---|---|---|
| **S1: Pure Second Brain** | Read-only. Briefs and suggests. Operator executes everything. | Day-one default. |
| **S2: Operator-Prompted Action** | System suggests, operator one-clicks approve, system executes. | Once operator trusts the recommendation quality (~3 months of clean briefings). |
| **S3: Bounded Semi-Agent** | For specific decision categories with proven track record, system acts within tight magnitude bounds (e.g., ±5%). | Statistically validated success rate >85% over 6+ months in the relevant decision category. |
| **S4: Wider Autonomy** | For categories with strong track record, wider bounds. | Continued track record + 12+ months of property history (YoY pacing). |
| **S5: Full Agent** | As originally specified in old Phase 3 — full dynamic pricing within configured anchors. | 24+ months of clean operation; statistically validated elasticity coefficients. |

The Second Brain is built to support all five stages architecturally from day one. The data plane, schemas, and decision-graph evaluator don't change between stages — only the execution authority changes. This means we don't rebuild when we advance; we re-configure.

**Critical:** The path isn't all-or-nothing. Stage progression is per-decision-category. The system might be at S3 for close-in pricing (proven track record) while still at S1 for base-price changes (high-stakes, lower data density). Each decision category has its own confidence trajectory.

### 1.3 What It Doesn't Do

- Compliance/regulatory interpretation
- Capital expenditures or amenity changes
- Guest communication
- Operational decisions (cleaning, maintenance dispatch)
- Marketing decisions (photos, copy, promotions)
- Tax or financial reporting
- Strategic decisions (channel deactivation, second-property expansion)

Anything in those categories: surface signals, flag for operator, do not act.

### 1.4 Why "Brief + Suggest + Track + Assess" (Not Just "Brief")

A pure briefing system gives raw observations: "Pacing is 12pp behind market for the second weekend of June." That's data, not insight. Without recommendation, you do the strategic work yourself every time.

A briefing-and-suggesting system gives you the observation plus a reasoning chain that produces a recommendation — and the *reasoning* is what teaches you. Over time, you internalize the framework, and the system's role shifts from "tell me what to do" to "validate my read."

The **tracking layer** makes the system anti-fragile. Every decision becomes a data point. After three months you can ask: "When pacing has been behind by >10pp and we held, what did pickup look like at 14 days out?" That's how hunches become knowledge.

The **assessment layer** is what unlocks Stage progression. Without measured outcomes, "the system has earned the right to act" is just vibes. Outcome tracking turns vibes into evidence.

---

## §2. Briefing Taxonomy

Five types of output. Each has distinct purpose, cadence, and data footprint.

### 2.1 Daily Pulse

**Purpose:** Catch overnight changes; surface what needs attention today.
**Cadence:** Every morning, automated.
**Format:** Concise summary (read in under a minute) with drill-down available in dashboard.

**Contents:**
- New bookings since last pulse (count, revenue, channel, lead time)
- Cancellations
- Compression signals firing on dates within next 60 days
- **Market-relative occupancy delta** (next 7/30/60 days, from `GET /v1/listings/{id}`)
- Active tests with status (T-15 Vrbo markdown evaluation status, others)
- Goal trajectory snapshot (YTD revenue, forward booked, pace vs $175K floor and $200K stretch)
- Flagged anomalies (unusual pickup, comp moves, scraper failures)
- Newly observed DSOs (date-specific overrides created since last pulse — operator's recent rate adjustments)

### 2.2 Weekly Synthesis

**Purpose:** Step back; analyze trends; pacing positions; what's working, what's not.
**Cadence:** Monday or Tuesday morning.
**Format:** Longer, analytical, with charts and pacing visualizations.

**Contents:**
- Past-week realized performance (bookings, revenue, ADR, channel mix)
- 30-day forward booking pace vs. last week (improving/stable/declining)
- Comp set rate and availability changes (from latest scrape)
- Booking curves (yours vs market, from Portfolio Analytics + Market Dashboard scrapes)
- Thresholds approaching evaluation windows
- Recommendations for the week
- Open questions surfaced by the week's data

### 2.3 Event-Triggered Alert

**Purpose:** Don't wait for cadence when something material happens.
**Trigger conditions:**
- Compression test transitions from 0/3 → 2/3 or 3/3 firing
- Comp set availability drops >20% in 7 days (from latest scrape)
- Pickup velocity exceeds 2× rolling baseline
- Major event date approaches a critical lead-time threshold
- Active test reaches its evaluation window
- Booking cancellation cluster (3+ in 7 days)
- Listing health metric crosses threshold (when listing-health scraping is online)
- Scraper failure beyond grace period

**Format:** Short, action-oriented, pushed via notification.

### 2.4 On-Demand Explainer (Chat)

**Purpose:** You ask, it answers — with full context.
**Trigger:** Conversational query.
**Format:** Conversational; depth scales to question.

The chat interface has the Master KB, thresholds, decision log, all PriceLabs data (API + scrape snapshots), and goal arc loaded — any question gets a complete contextual answer.

### 2.5 Forward-Looking Forecast Narrative

**Purpose:** Look ahead 30/60/90 days; tell the story of what's expected, what could go right, what could go wrong.
**Cadence:** Bi-weekly, or on-demand.
**Format:** Narrative + supporting charts.

**Contents:**
- Forecast revenue for next 30/60/90 days
- Major event windows and current pricing readiness
- Risks (events not yet priced, pacing softness, comp set moves)
- Opportunities (compression candidates, channel rebalancing)
- Trajectory toward $175K/$200K goals

---

## §3. Decision-to-Surface Registry

The 25 distinct data needs from v1 remain canonical. Re-mapped to actual sources in §6 (Gap Analysis: Closures).

### 3.1 Decision Categories Supported

- Pricing decisions (daily refresh, event-driven, compression response, discount/promo, base re-anchor, channel-specific, cancellation tier)
- LOS / minimum stay decisions (default by season/DOW, event-window, orphan-night, close-in relaxation)
- Channel strategy decisions (mix targeting, Vrbo summer markdown, direct activation, channel deactivation)
- Performance diagnostic decisions (visibility/value-gap diagnosis, cancellation cluster, listing health audit)
- Goal trajectory decisions (pace vs goal, path-to-goal modeling, calendar gap monetization)
- Strategic calendar decisions (event planning, owner-stay coordination, maintenance scheduling)

### 3.2 Decision Categories' Stage Trajectories

Different decision categories will progress through Stages 1–5 at different rates. Likely ordering:

| Category | Likely earliest semi-agent (S3) timing |
|---|---|
| Close-in pricing (T-7 to T-30) | 6–9 months (high data density) |
| Event-driven pricing | 12+ months (need 1+ event cycle) |
| LOS adjustments | 6–9 months |
| Channel-specific markdowns | 9–12 months |
| Base price changes | 18+ months (high stakes, lower data density) |
| Cancellation policy | Manual indefinitely (sensitive, low frequency) |

---

## §4. PriceLabs API Capability — Confirmed Inventory

The PriceLabs Customer API exposes 11 endpoints. The complete catalog, with status as of May 1, 2026:

### 4.1 Connection

- **Base URL:** `https://api.pricelabs.co`
- **Auth:** `X-API-Key` header
- **Rate limits:** 60/min, 1000/hour. 429 on exceed.
- **Timeout guidance:** 300s recommended; existing `plFetch` defaults to 120s.

### 4.2 Connected Listings (as of May 1, 2026)

| PMS | Listing ID | Name | Push Enabled |
|---|---|---|---|
| `airbnb` | `1517776645045787467` | Hot Tub*Theater*Game Room*Fire Pit*Bar*Sleeps 14 | ✅ |
| `vrbo` | `_units_0004_a0d34536...` | The Jackpot — Hot Tub, Cinema, Game Room, etc. | ✅ |
| `bcom` | `15172862___1517286201` | THE RETREAT — Hot Tub, Theater, Game Room... | ✅ |
| `airbnb` | `662725717960110756` | *(no name, dormant)* | ❌ |

**⚠ Two flags:**
1. **Booking.com is connected with push enabled.** Earlier conversations had channel mix at 70% Airbnb / 30% Vrbo / 0% Booking.com. This needs verification — is Booking.com active but with zero realized bookings, or is the push toggle on without an active listing? The reservation_data history will resolve this.
2. **Dormant Airbnb listing (`662725717960110756`)** — likely stale. May be eating ranking signal that should consolidate. Worth investigation; out of scope for this document.

### 4.3 Endpoint Catalog by Function

#### Listings — Read & Update

| Endpoint | Method | Purpose | Currently Wired? |
|---|---|---|---|
| `/v1/listings` | GET | Bulk list with summary | ✅ `fetchListings()` |
| `/v1/listings/{id}` | GET | Detail incl. **market_occupancy_next_7/30/60** | ❌ — high-value gap |
| `/v1/listings` | POST | Update min/base/max prices | ❌ |
| `/v1/add_listing_data` | POST | Onboard new PMS listing | ❌ (rare op) |

**Critical capability in `/v1/listings/{id}`:** Returns `market_occupancy_next_7`, `market_occupancy_next_30`, `market_occupancy_next_60` alongside your own `occupancy_next_*`. This is the cleanest market-relative pacing benchmark available programmatically. At time of audit, The Jackpot trailed market by 18–20 percentage points across all three windows. **This should drive Daily Pulse content directly.**

#### Pricing — Read Forward, Override Per-Date

| Endpoint | Method | Purpose | Currently Wired? |
|---|---|---|---|
| `/v1/listing_prices` | POST | Forward dynamic prices (730 days) | ✅ `fetchListingPrices()` — daily cron |
| `/v1/listings/{id}/overrides` | GET | Read DSOs (Date-Specific Overrides) | ❌ — high-value gap |
| `/v1/listings/{id}/overrides` | POST | Add/update DSOs | ❌ |
| `/v1/listings/{id}/overrides` | DELETE | Remove DSOs | ❌ |
| `/v1/fetch_rate_plans` | GET | Rate plans | ❌ (empty for us) |

**`/listing_prices` returns** per-date: `price`, `min_stay`, `unbookable`, `user_price`, `demand_color`, `demand_desc`, `weekly_discount`, `monthly_discount`, `extra_person_fee`, `check_in`, `check_out`, plus listing-level `los_pricing`.

**`/overrides` returns** the manual rate adjustments operator has applied, with `price`, `price_type` (percent/fixed/daily_factor), and optional `min_stay`, `min_price`, `max_price`, `check_in_check_out_enabled`, `check_in`, `check_out` (weekday masks like `"0000010"`), and `reason` field.

**This unlocks DSO-driven decision capture** (see §7.3).

#### Demand — Neighborhood Comps

| Endpoint | Method | Purpose | Currently Wired? |
|---|---|---|---|
| `/v1/neighborhood_data` | GET | Comp percentile prices by listing category | ❌ |

**Returns:** `Future Percentile Prices` broken out by category 0–7 (entry → whole-house), with X_values (dates) and Y_values (price percentiles, typically p25/p50/p75/p90), pulled from ~350 listings. Not as rich as Market Dashboards, but a useful programmatic comp benchmark.

#### Reservations — Past + Future

| Endpoint | Method | Purpose | Currently Wired? |
|---|---|---|---|
| `/v1/reservation_data` | GET | All reservations with channel, ADR, dates, LOS | ✅ ad-hoc; needs helper |

**Returns** per reservation: `listing_id`, `reservation_id`, `check_in`, `check_out`, `booking_status`, `booked_date`, `cancelled_on`, `rental_revenue`, `total_cost`, `no_of_days`, `currency`, `cleaning_fees`, `guestName: "Hidden"` (privacy-redacted).

**Caveats:**
- `rental_revenue` cleanliness varies by PMS; normalize using `(rental_revenue − cleaning_fees)` and flag suspect data
- `guestName` always redacted; cannot do guest-cohort analysis via this endpoint
- 100 results per page; paginate via `offset` until `next_page: false`

### 4.4 Update Frequencies

| Data | Cadence |
|---|---|
| Reservations sync (PriceLabs ← PMS) | 24h default; manual "Sync Now" available |
| Forward prices recalculation | Daily |
| Pricing pushed to channels | 24h default; configurable to more frequent |
| Listing detail / market occupancy | Daily refresh |
| Neighborhood data | Daily refresh |

### 4.5 What the API Does NOT Provide

Confirmed gone (these only live in PriceLabs dashboards):

- **Booking curves** (yours and market) — "Days Until Stay Date" pacing visualization
- **Comp set ADR percentiles per date with rich filtering** (Market Dashboards)
- **Comp set occupancy by date**
- **Comp set LOS distribution**
- **Comp set booking window distribution**
- **YoY market comparisons**
- **Compare Competitor Calendar** (CCC) — rate-by-rate by date for selected competitors
- **Listing customizations summary** — your active rules, seasonal profiles, gap-fill logic, etc.
- **Pricing recommendations history** — what PriceLabs was recommending 30/60/90 days ago

The first six items above motivate the browser scraping layer in §5.

The "pricing recommendations history" gap is closeable by **snapshotting `listing_prices` daily into a versioned store** — the API gives us *current* recommendations, and our own snapshot history gives us recommendation drift over time.

---

## §5. Browser Scraping Layer

A first-class data plane for what the API doesn't expose. Implemented as scheduled browser automation against your authenticated PriceLabs (and later, Airbnb/Vrbo) accounts.

### 5.1 Why This Works

- **Authenticated against your own data**, not third parties — fundamentally different posture than competitive scraping.
- **Dashboard data refreshes daily**; cadence-based scraping (3/7/30 days) is well within freshness envelope.
- **Tools are mature** — Claude in Chrome, Playwright, headless Chrome; extraction patterns are well-understood.

### 5.2 What It Doesn't Solve

- **Fragility**: UI changes, A/B tests, modal popups, slow loads break scrapers. Mitigated by validation rules and heartbeat alerts (§5.6).
- **Speed**: 30s API call → 5min browser session. Fine for cadence-based; bad for time-critical.
- **Not for execution**: scraping = read-only. Writes still go through API. Never push pricing changes via browser automation.

### 5.3 Scrape Targets and Cadences

#### Tier A — PriceLabs Dashboards

**Target A1: Portfolio Analytics (3-day cadence)**
- Booking curves (your listing, "days until stay date" axis)
- Lead time distribution histogram
- LOS distribution histogram
- YoY pacing (when 12+ months of history exists)
- Listing-level KPI scatter

**Target A2: Market Dashboards (7-day cadence, requires $9.99/mo subscription)**
- Comp set ADR by percentile (p25/p50/p75/p90) per date
- Comp set occupancy by date
- Comp set booking curves
- Comp set LOS distribution
- Comp set booking window distribution
- Listing Map by Price
- YoY market comparisons

**Target A3: Compare Competitor Calendar (7-day cadence)**
- Rate-by-rate by date for selected competitors
- Visual side-by-side with your asking prices

**Target A4: Listing Customizations Audit (30-day cadence)**
- Active customizations summary (seasonal, day-of-week, last-minute discounts, gap-fill rules)
- Rule conflict warnings
- Configuration drift detection

#### Tier B — Other Platforms (separate workstream, sequenced after Tier A)

**Target B1: Airbnb Host Dashboard (7-day cadence)**
- View counts by date
- Conversion rate (bookings/views)
- Search rank position for canonical queries
- Guest Favorite / Superhost badges
- Response rate, response time
- Host cancellation rate

**Target B2: Vrbo Host Dashboard (7-day cadence)**
- Same shape as Airbnb where exposed
- Vrbo's dashboard data is more limited externally; manageable

### 5.4 Architecture Pattern

```
Scheduled trigger (cron or Vercel cron)
  ↓
Spin up authenticated browser session
  (Claude in Chrome OR Playwright + persisted cookies)
  ↓
Navigate to specific dashboard module
  ↓
Apply standard filter set per scrape target
  ↓
Wait for data load (network idle + chart render)
  ↓
Extract structured data (DOM scrape + chart data when accessible)
  ↓
Validate against schema
  ↓
Diff against last successful snapshot (sanity check)
  ↓
Write versioned snapshot to Supabase
  ↓
Tag with scrape metadata
  ↓
Alert on failure / suspicious diff
  ↓
Tear down session
```

### 5.5 Critical Implementation Considerations

**Authentication.** Persisted session cookies refreshed on auth failure. Avoid storing credentials in scrape script; use environment-loaded auth flow or a secret manager.

**Self-rate-limiting.** Don't hammer PriceLabs even from your own account. 2–5s between page loads, 30s+ between distinct dashboard sections.

**UI drift detection.** Scrapers break when PriceLabs changes UI. Schema validation on every extraction; heartbeat alerts when extraction fails; raw HTML snapshot on unexpected empty success.

**Idempotent storage.** Each scrape produces a versioned snapshot. Don't overwrite previous snapshots — diff between snapshots is itself useful data.

**Validation rules.** "Did we get garbage?" tests:
- Comp set p50 within ±50% of previous scrape's p50 → likely real
- Comp set has at least N listings → not empty
- Booking curve has at least N data points → not truncated
- Dates within expected forward window → not stale

**Failure mode.** When a scrape fails or returns suspect data, the briefing system falls back to the last good snapshot and *flags the staleness* in the briefing: "Comp set data last refreshed 9 days ago — scraper has been failing since X."

### 5.6 Scraper Monitoring

A scraper that "succeeds" with bad data is worse than one that errors out. Monitoring layer:

- **Heartbeat**: every successful scrape logs to a heartbeat table; absence → alert
- **Data validation**: schema and range checks on every payload
- **Diff sanity**: compare current extraction to previous; flag implausible deltas
- **Manual re-run capability**: operator can trigger a scraper manually from dashboard
- **Failure budgets**: if scrape fails 3 consecutive runs, alert and switch the briefing to "stale data" mode

---

## §6. Gap Analysis: Closures (Reclassified)

The 25 data needs from §3, with v2 closures.

### 6.1 Direct API Match

| Data Need | Source |
|---|---|
| Reservations (past + future) | API: `reservation_data` |
| Asking-rate calendar (current + 730d forward) | API: `listing_prices` |
| Base/min/max prices | API: `listings` (bulk + detail) |
| Minimum stay rules | API: `listing_prices` (per-date `min_stay` field) |
| Date-specific overrides | API: `listings/{id}/overrides` |
| **Market-relative occupancy (next 7/30/60)** | API: `listings/{id}` (the `market_occupancy_next_*` fields) |
| Channel mix (own listing) | API: `reservation_data` |
| Realized cancellation rate | API: `reservation_data` (compute from `booking_status` + `cancelled_on`) |

### 6.2 Closed via Browser Scraping

| Data Need | Closure |
|---|---|
| Booking curves (own) | Scrape: Portfolio Analytics (3-day) |
| Booking curves (market) | Scrape: Market Dashboards (7-day) |
| Comp set ADR percentiles per date | Scrape: Market Dashboards (7-day) |
| Comp set availability by date | Scrape: Market Dashboards (7-day) |
| Comp set LOS distribution | Scrape: Market Dashboards (7-day) |
| Comp set booking window distribution | Scrape: Market Dashboards (7-day) |
| Lead time distribution (own) | Scrape: Portfolio Analytics (3-day) |
| Length-of-stay distribution (own) | Scrape: Portfolio Analytics (3-day) |
| YoY pacing (when available) | Scrape: Portfolio Analytics (3-day, post-Nov 2026) |
| Listing customizations active rules | Scrape: Listing customizations audit (30-day) |
| Pickup velocity (own + market) | Scrape: derive from booking curves + reservation diffs |

### 6.3 Closed via Daily API Snapshot

| Data Need | Closure |
|---|---|
| Pricing recommendations history | Snapshot `listing_prices` API response daily into versioned store |
| Override change history | Snapshot `overrides` API response daily; diff for changes |
| Listing configuration history | Snapshot `listings/{id}` daily |

### 6.4 Closed via Local Config

| Data Need | Closure |
|---|---|
| Threshold values (T-1 through T-15) | `thresholds.yaml` (existing) |
| Master KB content | `master_kb_v1.md` (existing) |
| Property cost structure | Extract to `cost_structure.yaml` |
| Goal architecture | Extract to `goals.yaml` |
| Owner-stay calendar | `owner_stay_calendar` table or .ics |
| Hot tub maintenance log | `maintenance_log` table |
| Event calendar with magnitude tags | `event_calendar.yaml` (manually maintained, quarterly refresh) |

### 6.5 Closed via Manual Operator Inputs

| Data Need | Closure |
|---|---|
| Inquiry quality observations | Operator-noted via chat |
| Direct-booking inquiry log | Operator-noted via chat |
| Regulatory/compliance flags | Operator-noted via chat |
| Hot tub status changes | Operator-noted via chat |

### 6.6 Closed via Tier B Scraping (when prioritized)

| Data Need | Closure |
|---|---|
| Listing health: views, conversion, badges, response | Scrape: Airbnb Host Dashboard (7-day) |
| Vrbo listing health | Scrape: Vrbo Host Dashboard (7-day) |

### 6.7 Closed via External APIs / Sources

| Data Need | Closure |
|---|---|
| Macro Chicago tourism data | Choose Chicago RSS / press releases |
| STR submarket supply trend | Chicago Open Data Portal API (Active Shared Housing Registrations) |
| Weather forecasts | OpenWeatherMap / NOAA API (Phase 7 priority) |
| Event calendar updates | Quarterly manual refresh (or PredictHQ later) |

### 6.8 Accepted Limitations (No Closure)

| Data Need | Why Accepted |
|---|---|
| Guest contact info / cohort analysis | API redacts `guestName`; Airbnb host data also limited; not material to revenue management |
| Real-time webhooks for new bookings | PriceLabs Customer API doesn't expose webhooks; daily polling is sufficient cadence |
| Channel mix (comp set) | Inferable from separate Airbnb-only and Vrbo-only Market Dashboard scrapes; not a hard requirement |

---

## §7. Decision and Outcome Tracking

The most distinctive feature of the Second Brain. Three capture mechanisms, three observation patterns.

### 7.1 Three Decision Capture Mechanisms

**Mechanism 1: DSO Observation (Automatic)**
- Daily polling of `GET /v1/listings/{id}/overrides`
- Diff against previous snapshot
- For each new/changed override: prompt operator: *"I see you applied a +12% override on June 7. What's the rationale? I'll add this to the decision log and start tracking the outcome."*
- Operator responds in chat or dismisses with "no log needed"
- System logs decision with operator-provided rationale + automatic context (current pacing, recent comp moves, KB rules likely in play)

**Mechanism 2: Conversational Capture (Operator-Initiated)**
- Operator chats: *"I just dropped Memorial Day weekend by 8% because pickup was lagging."*
- System parses, creates structured decision log entry, asks for any missing context
- Confirms back to operator: *"Logged dec_20260501_007. Tracking checkpoints at 7d, 14d, 30d, at arrival."*

**Mechanism 3: System-Suggested Then Operator-Approved**
- System produces a recommendation (in briefing or chat)
- Operator approves (one-click or "yes, do that")
- System logs decision with full reasoning chain pre-populated
- For Stage 1 (current): operator manually executes change in PriceLabs UI; system observes via DSO polling and links to the pre-logged decision
- For Stage 2+: system executes via API; logs execution

### 7.2 Decision Log Schema

```yaml
- decision_id: dec_20260430_001
  timestamp: 2026-04-30T14:23:00-05:00
  capture_mechanism: dso_observation | conversational | system_suggested
  decision_type: price_change | los_change | cancellation_policy_change | channel_strategy | promo | base_price_change | other
  scope:
    dates: [2026-07-30, 2026-07-31, 2026-08-01, 2026-08-02]
    channels: [airbnb, vrbo]  # or "all"
  what_changed:
    field: nightly_price
    from: 1100
    to: 2400
    method: dso_percent | dso_fixed | base_price_change | api_override
  rationale_at_time:
    - "Lollapalooza weekend approaching 90-day window"
    - "Master KB §9.4: 2.5–3.0x base for Lolla"
    - "Comp set showing limited availability for these dates"
  expected_outcome:
    - "Bookings within 30 days at ≥$2000 ADR"
    - "If pickup slow at T-30, drop to 2.2x base"
  source_briefing_id: brief_20260430_002  # if system-suggested
  confidence: high | medium | low
  alternatives_considered:
    - "Hold at 1.8x; risk under-pricing"
    - "Push to 3.5x; risk no bookings"
  operator_notes: "Free text"
  related_decisions: [dec_20260301_004]  # similar prior decisions for pattern tracking
```

### 7.3 Outcome Observation Schema

For each decision, the system observes outcomes at four checkpoints:

```yaml
- outcome_for: dec_20260430_001
  observation_window:
    start: 2026-04-30
    checkpoints: [7d, 14d, 30d, at_arrival]
  observed_at_7d:
    pickup: 0
    pacing_position: behind  # vs comp set
    comp_movement: -3% to -5%
    market_occupancy_delta: -22pp  # from listings/{id} market_occupancy_next_7
    notes: "No immediate pickup; market still building"
  observed_at_14d:
    pickup: 1
    new_booking_rate: 2173
    pacing_position: on_track
    comp_movement: stable
  observed_at_30d:
    pickup: 2
    realized_arrivals: 0
    pacing_position: ahead
    notes: "Pricing supported by market"
  observed_at_arrival:
    final_booked: true
    final_revenue: 9692
    final_adr: 2423
    final_los: 4
    expected_vs_actual: "expected $2000+; got $2423"
    decision_assessment: successful | mixed | unsuccessful | inconclusive
    contributing_factors:
      - "Lolla compression accelerated more than forecast"
      - "Comp set raised in parallel, validating our band"
```

### 7.4 Periodic Outcome Assessment

**Cadence:** Monthly retrospective briefing.

**Outputs:**
- All decisions made in the prior month, tagged with assessment
- Pattern recognition: which decision types succeeded, which didn't
- Threshold-calibration suggestions ("T-2 magnitude function may be too aggressive; raises produced overshoot 3 of 5 times")
- Lessons that update the Master KB
- Stage-progression candidates (decision categories with sufficient track record to consider advancing)

### 7.5 What This Enables

| After | What's Available |
|---|---|
| 3 months | Pattern recognition on what works for The Jackpot specifically vs. generic frameworks |
| 6 months | Statistically defensible threshold calibrations; first decision categories candidate for S2 |
| 12 months | YoY benchmarking (first true comparison); first categories candidate for S3 |
| 24 months | Per-segment elasticity coefficients; categories candidate for S4–S5 |

---

## §8. Briefing Construction Patterns

How raw data + KB context + research becomes a coherent briefing. The system's reasoning layer.

### 8.1 The Construction Pipeline

```
1. INGEST
   - Pull current state from API (listings, listing_prices, overrides, reservations)
   - Pull market-relative occupancy from listings/{id}
   - Pull latest snapshots from scrape store (Portfolio Analytics, Market Dashboards)
   - Load thresholds.yaml fresh
   - Load any updated KB sections
   - Pull decision log entries from past 30 days

2. ANALYZE
   - Per-date evaluation (pacing, compression signals, event overlay)
   - Aggregate analysis (channel mix, ADR trends, goal trajectory)
   - Anomaly detection (unexpected pickup, comp moves, scraper failures)
   - Active test status checks
   - DSO change detection

3. INTERPRET
   - Apply Master KB frameworks to raw signals
   - Cross-reference threshold values
   - Identify decision opportunities
   - Compute recommendations with reasoning chains

4. STRUCTURE
   - Group findings by category
   - Prioritize by urgency
   - Format for the appropriate briefing type

5. PRESENT
   - Render in chat / dashboard / email
   - Include reasoning chains, KB citations, data sources, confidence levels
   - Link to underlying data for drill-down
```

### 8.2 Reasoning Chain Anatomy

Every recommendation includes:

1. **What data signals fired** (raw observations with sources)
2. **What KB rules apply** (frameworks invoked, with section references)
3. **What thresholds inform** (calibrated values used, with IDs)
4. **What the proposed action is** (concrete recommendation)
5. **Why this magnitude/direction** (reasoning, not handwaving)
6. **Alternatives considered** (other options explicitly rejected)
7. **Confidence level** (high/medium/low with justification)
8. **Sources** (where each piece of evidence came from)
9. **Next checkpoint** (when to revisit)

This format is non-negotiable. It's what makes the system *educational*.

### 8.3 Citations and Sources

Every claim links to its source:

- **PriceLabs API data:** Cite endpoint and timestamp. *"PriceLabs `listings/1517776645045787467`, pulled 2026-05-01T06:00:00 UTC."*
- **Scraped data:** Cite scrape target and snapshot timestamp. *"Market Dashboards comp set scrape, snapshot 2026-04-29."*
- **KB rules:** Cite section. *"Master KB §6.4 (compression detection)."*
- **Thresholds:** Cite ID and current value. *"Threshold T-1, comp_drop_threshold = 0.30."*
- **External:** Cite name and date. *"Choose Chicago press release, October 1, 2025."*
- **Decision log:** Cite ID. *"Decision dec_20260301_004."*

No black-box claims.

---

## §9. Conversational Query Patterns

Status / Diagnostic / Recommendation / Educational / Historical / What-If.

Each pattern has distinct data requirements; all share the same reasoning-chain output format.

(Detailed query patterns preserved from v1; see §9 of v1.0 for examples. Not repeated here for brevity.)

---

## §10. Storage Architecture

### 10.1 Stack Alignment

The runtime is the existing infrastructure:

- **Database:** Supabase (Postgres)
- **App:** Next.js
- **PriceLabs wrapper:** `src/lib/pricelabs.ts` (extend, don't replace)
- **Scheduled jobs:** Existing cron (`/api/cron/pricelabs-sync` and new endpoints)
- **Scraping runtime:** Claude in Chrome (primary) or Playwright (when headless server-side execution needed)

### 10.2 Schema (Postgres / Supabase)

```sql
-- Existing (already in production)
listing_prices                    -- daily forward dynamic prices
pricing_config                    -- listing-level config, base/min/max

-- New for v2

-- Daily API snapshots (versioned for forecast history)
listing_detail_snapshots          -- daily GET /v1/listings/{id} captures
listing_prices_snapshots          -- daily forward price recommendation history
overrides_snapshots               -- daily DSO state captures

-- Reservations
reservations                      -- normalized GET /v1/reservation_data
reservations_diff_log             -- detected new bookings/cancellations

-- Browser-scraped data
scrape_snapshots                  -- raw scrape payloads (jsonb), versioned
portfolio_analytics_booking_curves
portfolio_analytics_los_dist
market_dashboards_comp_set_percentiles
market_dashboards_comp_curves
listing_customizations_audit

-- Decision capture and outcome tracking
decisions                         -- decision log (per §7.2 schema)
outcomes                          -- outcome observations (per §7.3 schema)
briefings                         -- generated briefing log

-- Local config (could be file or table)
thresholds                        -- T-1 through T-15 with override status
event_calendar                    -- 2026 events with magnitude tags
goals                             -- annual revenue targets
cost_structure                    -- fixed/variable costs

-- Operator-noted observations
operator_notes                    -- inquiries, hot tub status, regulatory flags

-- Scraper monitoring
scrape_heartbeats                 -- per-target last-success times
scrape_failures                   -- log of failures and recovery
```

### 10.3 Why Database Over Files

V1 specified local files in `/state/` for portability. V2 uses Supabase tables because:

- Existing infrastructure already has it
- Queryability matters (decision log queries, outcome aggregation, time-series analysis)
- Versioning at row level beats file-versioning for diff queries
- Backups handled by Supabase
- Multi-user later (when partner / accountant gets read access) is trivial in DB

Local files reserved for: `thresholds.yaml`, `master_kb.md`, `event_calendar.yaml` — these are semi-static config that benefits from git versioning.

---

## §11. Dashboard Logical Structure

UX/UI is explicitly out of scope. This is the logical structure — what views surface what data.

### 11.1 View Hierarchy

**Primary views:**
1. **Today** — daily pulse rendered visually
2. **Calendar** — 90-day forward view with prices, pacing, events overlaid
3. **Trajectory** — goal pace ($175K / $200K) with realized + forward booked
4. **Decisions** — decision log with outcomes
5. **Chat** — conversational interface

**Secondary views:**
6. **Performance** — KPI dashboard with time-series
7. **Comp Set** — your position vs. comparables (heavy use of scraped data)
8. **Events** — 2026 event calendar with current pricing readiness
9. **Tests** — active tests with status and evaluation dates
10. **Settings** — thresholds, KB, integrations, scraper status

### 11.2 Information Architecture Principles

- **Recency at top** of any list view
- **Action items prominent** — anything requiring decision today is impossible to miss
- **Drill-down everywhere** — every aggregate has a clickable path to underlying data
- **Reasoning chains accessible** — every recommendation, decision, assessment links to its full reasoning
- **No hidden state** — what the system is doing is always inspectable
- **Staleness visible** — when data is old (scraper failed, etc.), the view says so explicitly

---

## §12. Implementation Roadmap

Sequenced sub-phases. Each produces standalone value.

### 12.1 Phase 6.1 — API Data Plumbing (Highest Priority)

**Goal:** Extend `lib/pricelabs.ts` to wrap all 11 endpoints; daily snapshots flowing to Supabase.

**Tasks:**
- Add `fetchListingDetail()` for `GET /v1/listings/{id}` with market_occupancy fields
- Add `fetchOverrides()` for `GET /v1/listings/{id}/overrides`
- Add `fetchReservations()` helper (paginated) for `GET /v1/reservation_data`
- Add `fetchNeighborhoodData()` for `GET /v1/neighborhood_data`
- Add `fetchRatePlans()` for completeness
- Add write helpers: `upsertListing()`, `upsertOverrides()`, `deleteOverrides()`
- Extend cron to snapshot all read endpoints daily into Supabase
- Implement reservation diff detection (new bookings, cancellations) → operator notification

**Outcome:** Complete API coverage. All programmatic data flowing daily.

### 12.2 Phase 6.2 — Daily Pulse Briefing v1

**Goal:** First automated briefing.

**Tasks:**
- Implement briefing construction pipeline (§8.1) for daily pulse format
- Wire Master KB and thresholds.yaml as context
- Implement reasoning chain generation
- Email/Slack delivery + dashboard view
- Include market-relative occupancy delta as headline signal
- Include reservations diff (new bookings/cancellations overnight)
- Include DSO change detection

**Outcome:** Daily briefing arrives every morning.

### 12.3 Phase 6.3 — Chat Interface

**Goal:** Conversational queries with full context.

**Tasks:**
- Web interface with chat (extend Next.js app)
- All data + KB + decision log loaded as context per query
- Implement query patterns (status / diagnostic / recommendation / educational / historical / what-if)
- Implement DSO observation prompt (when new override detected, prompt for rationale)

**Outcome:** Ad-hoc questions get contextualized, KB-grounded answers.

### 12.4 Phase 6.4 — Decision and Outcome Tracking

**Goal:** Operator can log decisions; system tracks outcomes.

**Tasks:**
- Implement decision-log entry from chat and DSO-observation flow
- Implement outcome observation logic (checkpoints at 7d/14d/30d/at_arrival)
- Implement monthly retrospective generation
- Build Decisions view in dashboard

**Outcome:** Institutional memory builds. Patterns become observable.

### 12.5 Phase 6.5 — Browser Scraping Layer (Tier A)

**Goal:** Close the dashboard-only data gap.

**Tasks:**
- Stand up scraping framework (Claude in Chrome or Playwright)
- Build authenticated session management
- Build validation + heartbeat + failure-handling layer
- Implement Portfolio Analytics scraper (3-day cadence)
- Implement Market Dashboards scraper (7-day cadence) — *requires $9.99/mo subscription*
- Implement Compare Competitor Calendar scraper (7-day cadence)
- Implement Listing Customizations scraper (30-day cadence)
- Wire scraped data into briefings

**Outcome:** Comp set behavior visible programmatically. Booking curves available. Pacing benchmarks rich.

### 12.6 Phase 6.6 — Listing Health Layer (Tier B)

**Goal:** Close the highest-impact non-PriceLabs gap.

**Tasks:**
- Build Airbnb Host Dashboard scraper (7-day cadence)
- Build Vrbo Host Dashboard scraper (7-day cadence)
- Integrate listing-health metrics into briefings (visibility-problem detection, value-gap detection)

**Outcome:** Full-funnel visibility, not just pricing.

### 12.7 Phase 6.7 — Event Calendar Pipeline

**Goal:** Maintain event calendar without manual updates.

**Tasks:**
- Build scrapers for Choose Chicago / McCormick Place
- Optional: PredictHQ integration (paid, more comprehensive)
- Update `event_calendar` table automatically
- Surface event-readiness in briefings

**Outcome:** Event calendar stays fresh.

### 12.8 Phase 6.8 — Dashboard

**Goal:** Visual layer.

**Tasks:**
- Implement primary views (Today, Calendar, Trajectory, Decisions, Chat)
- Implement secondary views (Performance, Comp Set, Events, Tests, Settings)
- Iterate on UX

**Outcome:** Visual interface for the parts where charts and calendar grids beat prose.

### 12.9 Phase 6.9+ — Stage Progression

After 6+ months of clean operation:

- Review which decision categories have sufficient track record for S2 (operator-prompted action)
- Build approval-and-execute flow for those categories
- After 12+ months and YoY availability: review for S3 candidates
- Continue gradual stage progression per §1.2

---

## §13. Open Items and Verifications

Before Phase 6.1 begins:

1. **Booking.com channel mix verification.** Connected via API with push enabled, but earlier conversations had 0% Booking.com bookings. Pull `reservation_data` filtered by Booking.com to confirm whether realized bookings exist.

2. **Dormant Airbnb listing investigation.** `662725717960110756` flagged as dormant. Verify whether it's a stale duplicate eating ranking signal or a deliberate parked listing.

3. **Market Dashboards subscription decision.** $9.99/mo for one location. Recommended to subscribe given Phase 6.5 dependency. Confirm before that phase.

4. **Operator response time SLA.** Affects briefing logic — when "action required" is sent, how long before the system escalates further?

5. **Notification channel preference.** Email / Slack / both / dashboard-only?

6. **Scraping infrastructure choice.** Claude in Chrome vs. Playwright. Recommendation: start with Claude in Chrome for v1 (lower setup cost, conversational flexibility); migrate to Playwright if/when headless server-side reliability becomes critical.

7. **Tier B (Airbnb/Vrbo scraping) prioritization.** Listing health is the highest-impact non-PriceLabs gap. Worth pulling forward to Phase 6.5b? Or stick with the 6.5 → 6.6 sequence?

8. **Active test handling.** T-15 (Vrbo summer markdown) is currently active. The 14-day evaluation window is approaching (May 14). Will the operator manually evaluate, or wait for the system to handle it via Phase 6.4?

---

## §14. Summary

The strategic architecture for The Jackpot's revenue management Second Brain. Comprehensive in scope, incremental in build sequencing, evolution-aware in design.

**Three things that distinguish v2 from v1:**

1. **Empirical grounding.** API capabilities are confirmed, not inferred. The 11-endpoint inventory and the `market_occupancy_next_*` fields specifically change what's directly possible.

2. **Browser scraping as architecture, not workaround.** Most v1 "no match" gaps become "scrapable on cadence." Comp set booking curves, market LOS distribution, listing customizations audit — all recoverable.

3. **Stage-aware design.** The Second Brain is built to grow into a Semi-Agent and eventually an Agent, with stage progression per decision category gated by realized track record. Day-one architecture supports day-365 capability.

**What this buys, end state:**

After Phase 6.1–6.4: complete API coverage, daily briefings, conversational interface, decision tracking. Three months of institutional memory.

After Phase 6.5–6.7: dashboard-only data is no longer dashboard-only. Comp set behavior, listing health, event calendar — all programmatic.

After Phase 6.8: visual layer for the parts where charts beat prose.

After 6+ months: first decision categories qualify for S2 operator-approved execution. The system has earned the right to act on specific things.

After 12+ months: YoY pacing, S3 candidates emerge, real elasticity coefficients begin to form.

**The cumulative shift, in operator's words:** decision-making becomes *well-guided* rather than *random and unpredictable*, with an institutional record that compounds, and a foundation that becomes real agent automation when the evidence supports it.

---

*End of Phase 6 Architecture v2.0. Companion documents: Second Brain + Semi-Agent Spec (engineering specification), Second Brain System Prompt (runtime instructions), Master KB v1.0 (knowledge layer), thresholds.yaml (calibration database).*
