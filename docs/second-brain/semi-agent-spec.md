# Second Brain + Semi-Agent Specification
## Engineering Specification

**Property:** The Jackpot — Stravon Group LLC | **Version:** 1.0 | **Last Updated:** May 1, 2026
**Supersedes:** Phase 3 Agent Specification v1.0 (April 30, 2026)
**Companion docs:** Phase 6 Architecture v2, Master KB v1.0, thresholds.yaml, Second Brain System Prompt

---

## §0. About This Document

This is the engineering specification for the Second Brain — the *how* that operationalizes Phase 6 Architecture v2's *what and why*.

The previous Phase 3 Agent Specification was built around an autonomous executor with confidence-tier ramp. We pivoted away from that. This specification reflects the actual product: a Second Brain that briefs and suggests, captures decisions and observes outcomes, and grows into bounded execution authority over time as evidence accrues. The Semi-Agent stage isn't a future replacement of the Second Brain — it's the same system with expanded authority for proven decision categories.

**What this document is:** Tool inventory, data flows, schemas, decision capture mechanics, outcome assessment mechanics, briefing pipeline, conversational handler, failure modes, testing/validation, evolution path. The build target.

**What this document is not:** Strategic architecture (Phase 6 v2) or runtime instructions (System Prompt).

---

## §1. Scope and Authority

### 1.1 Core Capabilities

The Second Brain has four functional modes that operate concurrently:

1. **Brief mode** — observe the world, surface what matters
2. **Suggest mode** — produce specific recommendations with reasoning chains
3. **Track mode** — capture decisions, observe outcomes
4. **Assess mode** — periodically retrospect, identify patterns, suggest calibration shifts

Modes share the same data plane and reasoning layer. They differ in trigger conditions, output format, and consumer (operator-facing vs. internal logging).

### 1.2 Authority Boundaries (Stage 1, Current)

The system's current execution authority is **read-only against PriceLabs**. It does not push pricing changes, does not modify overrides, does not execute LOS adjustments. All actions require operator execution.

The architecture supports execution authority at later Stages (S2–S5), but Stage 1 is the launch state and it stays that way until decision-category-specific track records justify advancement.

### 1.3 Evolution Path Summary

| Stage | Read | Suggest | Execute |
|---|---|---|---|
| **S1: Pure Second Brain** (current) | ✅ All data | ✅ All categories | ❌ Nothing |
| **S2: Operator-Prompted Action** | ✅ All data | ✅ All categories | ✅ One-click approval flow |
| **S3: Bounded Semi-Agent** | ✅ All data | ✅ All categories | ✅ Autonomous within tight bounds, per-category |
| **S4: Wider Autonomy** | ✅ All data | ✅ All categories | ✅ Wider bounds, per-category |
| **S5: Full Agent** | ✅ All data | ✅ All categories | ✅ Full dynamic pricing within configured anchors |

Stage progression is per decision category. The system doesn't transition holistically; it earns expanded authority for *specific categories* based on track record.

### 1.4 What's In Scope

- Pricing decisions (recommend; later, execute via PriceLabs API)
- LOS / minimum stay decisions
- Cancellation policy decisions
- Channel strategy decisions
- Listing health observations (when scraping is online)
- Event-driven calendar planning
- Goal trajectory tracking
- Decision logging and outcome assessment

### 1.5 What's Out of Scope

- Compliance/regulatory interpretation (flag, never decide)
- Capital expenditures
- Amenity changes
- Guest communication
- Operational dispatch
- Marketing automation
- Tax/financial reporting
- Multi-property portfolio decisions

---

## §2. Architecture Overview

### 2.1 System Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                       OPERATOR (Abe)                           │
│  - Receives briefings (daily/weekly/event-triggered)           │
│  - Engages chat (on-demand queries)                            │
│  - Approves recommendations (Stage 2+)                         │
│  - Notes decisions (chat / DSO observation prompt)             │
└─────┬────────────────────────────────────────────┬─────────────┘
      │                                            │
      │  briefings, chat                           │  approvals,
      ▼                                            ▼  decision notes
┌────────────────────────────────────────────────────────────────┐
│              SECOND BRAIN (Reasoning + Routing)                │
│                                                                │
│  Loaded context per run:                                       │
│  - System Prompt                                               │
│  - Master KB v1.0                                              │
│  - thresholds.yaml                                             │
│  - Recent decision log + outcomes                              │
│  - Current data state (API + scrape snapshots)                 │
│                                                                │
│  Functional modes:                                             │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐            │
│  │  Brief  │ │ Suggest  │ │  Track  │ │  Assess   │            │
│  └─────────┘ └──────────┘ └─────────┘ └───────────┘            │
│                                                                │
│  Output: briefings, recommendations, decision logs, retros     │
└──┬──────────────┬──────────────┬─────────────────┬─────────────┘
   │              │              │                 │
   ▼              ▼              ▼                 ▼
┌────────┐  ┌────────────┐  ┌──────────┐  ┌────────────────────┐
│ Pricelabs│  │  Browser   │  │  Local   │  │   Supabase DB      │
│   API   │  │  Scrapers  │  │  Config  │  │  (state, logs)     │
└────────┘  └────────────┘  └──────────┘  └────────────────────┘
```

### 2.2 Component Inventory

**Reasoning Layer**
- LLM (Claude) loaded with system prompt, KB, thresholds, recent context
- Decision-graph evaluator (per-date pricing logic, compression detection, etc.)
- Briefing constructor
- Conversational query handler

**Data Layer**
- PriceLabs API wrapper (`src/lib/pricelabs.ts`, extended)
- Browser scrapers (Claude in Chrome / Playwright)
- Daily snapshot ingestion (cron jobs)
- Diff detectors (reservations, overrides, listing config)

**Storage Layer**
- Supabase (Postgres) — state, logs, snapshots
- Local files — `thresholds.yaml`, `master_kb_v1.md`, `event_calendar.yaml`, etc.

**Interface Layer**
- Next.js dashboard (eventual)
- Chat interface (initial: Claude Code; later: web UI)
- Notification channel (email/Slack)

### 2.3 Runtime

The runtime is the existing Next.js + Supabase + cron infrastructure. The Second Brain extends the existing app rather than running as a separate service.

- **Scheduled jobs:** Vercel cron (or equivalent) triggers daily/weekly snapshots
- **API wrappers:** Extended `src/lib/pricelabs.ts`
- **Scraper invocations:** Separate scheduled jobs; results land in Supabase
- **Briefing generation:** Triggered by cron (daily, weekly) or event (alerts)
- **Chat:** Web endpoint that calls Claude with full loaded context per query

---

## §3. The Four Modes

### 3.1 Brief Mode

**Purpose:** Surface what's happening.

**Triggers:**
- Scheduled (daily, weekly, bi-weekly forecast)
- Event-driven (compression transitions, comp moves, scraper failures, etc.)

**Process:**
1. Determine briefing type (daily pulse / weekly synthesis / event alert / forecast narrative)
2. Pull required data per briefing type (see §5 data flow)
3. Run analyzers (per-date evaluation, aggregate analysis, anomaly detection)
4. Run interpreter (apply KB frameworks, threshold lookups)
5. Structure output per briefing-type template
6. Render and deliver via configured channel

**Output:** Briefing artifact (stored in `briefings` table; rendered to operator).

### 3.2 Suggest Mode

**Purpose:** Produce specific actionable recommendations with reasoning chains.

**Triggers:**
- Embedded in briefings (recommendations alongside observations)
- On-demand via chat ("should I drop Memorial Day weekend?")
- Event-driven (compression detected → recommendation generated)

**Process:**
1. Identify decision context (date, scope, decision type)
2. Pull all relevant data (current state, pacing, comp set, events, KB rules)
3. Walk decision graph (75-55-35 framework, magnitude function, event overlay)
4. Apply confidence gating (per stage rules + per category)
5. Build full reasoning chain (§4 of the system prompt)
6. Output recommendation with: action, magnitude, rationale, alternatives considered, confidence, sources, next checkpoint

**Output:** Recommendation object (linked to briefing or chat session; logged for tracking).

### 3.3 Track Mode

**Purpose:** Capture decisions and observe outcomes.

**Triggers:**
- DSO observation (daily diff detects new override) → operator prompt
- Conversational decision capture ("I just dropped X")
- System-suggested + operator-approved
- Scheduled outcome observation (per decision, at 7d/14d/30d/at_arrival)

**Process:**

For decision capture:
1. Identify decision (mechanism: DSO / conversational / approved-suggestion)
2. Build decision log entry (§7.2 schema)
3. Resolve missing context (chat with operator if needed)
4. Persist to `decisions` table
5. Schedule outcome observations

For outcome observation:
1. At each checkpoint, compute observed outcome metrics
2. Persist to `outcomes` table
3. At final checkpoint, classify: successful / mixed / unsuccessful / inconclusive
4. Identify contributing factors

**Output:** Decision and outcome records.

### 3.4 Assess Mode

**Purpose:** Periodic retrospective; surface patterns and calibration shifts.

**Triggers:**
- Monthly scheduled retrospective
- Event-driven (e.g., 5+ decisions in a category — cohort large enough to assess)

**Process:**
1. Pull all decisions from review window (default: prior month)
2. Tag each by assessment classification
3. Compute success rates by decision category
4. Identify pattern signals (which thresholds may need adjustment, which categories show track record)
5. Generate retrospective briefing
6. Surface stage-progression candidates (decision categories with track record sufficient for advancement)

**Output:** Monthly retrospective briefing with pattern observations and calibration suggestions.

---

## §4. Tool Inventory

### 4.1 PriceLabs API Tools (Wired and Unwired)

```typescript
// All in src/lib/pricelabs.ts (extended from current)

// READS
fetchListings(opts?: { skip_hidden?: boolean, only_syncing?: boolean }): Promise<Listing[]>
fetchListingDetail(listingId: string, pms: string): Promise<ListingDetail>
fetchListingPrices(listings: ListingRange[]): Promise<PricesResponse>
fetchOverrides(listingId: string, pms: string): Promise<OverridesResponse>
fetchReservations(opts: { pms: string, start_date?: string, end_date?: string, limit?: number, offset?: number }): Promise<ReservationPage>
fetchAllReservations(opts): Promise<Reservation[]> // paginated wrapper
fetchNeighborhoodData(listingId: string, pms: string): Promise<NeighborhoodData>
fetchRatePlans(listingId: string, pms: string): Promise<RatePlansResponse>

// WRITES (Stage 2+ only; built but gated by stage flag)
upsertListing(listing: ListingUpdate): Promise<UpdateResponse>
upsertOverrides(listingId: string, pms: string, overrides: Override[]): Promise<UpdateResponse>
deleteOverrides(listingId: string, pms: string, dates: string[]): Promise<UpdateResponse>
addListingData(listing: NewListing): Promise<AddResponse> // rare op
```

### 4.2 Scraping Tools

```typescript
// Each scraper is a discrete function returning typed structured data

// Tier A — PriceLabs Dashboards
scrapePortfolioAnalytics(opts: { lookback_days: number }): Promise<PortfolioAnalyticsSnapshot>
scrapeMarketDashboard(opts: { dashboard_id: string }): Promise<MarketDashboardSnapshot>
scrapeCompareCompetitorCalendar(opts: { competitors: string[] }): Promise<CCCSnapshot>
scrapeListingCustomizations(listingId: string): Promise<CustomizationsSnapshot>

// Tier B — Other Platforms (sequenced after Tier A)
scrapeAirbnbHostDashboard(listingId: string): Promise<AirbnbHealthSnapshot>
scrapeVrboHostDashboard(listingId: string): Promise<VrboHealthSnapshot>
```

### 4.3 Storage Tools

```typescript
// Supabase wrappers
upsertListingDetailSnapshot(snapshot: ListingDetailSnapshot): Promise<void>
upsertListingPricesSnapshot(snapshot: ListingPricesSnapshot): Promise<void>
upsertOverridesSnapshot(snapshot: OverridesSnapshot): Promise<void>
upsertReservations(reservations: Reservation[]): Promise<DiffResult>
upsertScrapeSnapshot(target: string, payload: any): Promise<void>

logDecision(decision: Decision): Promise<DecisionId>
observeOutcome(decisionId: string, checkpoint: Checkpoint, observed: ObservedMetrics): Promise<void>

queryDecisions(opts: QueryOpts): Promise<Decision[]>
queryOutcomes(opts: QueryOpts): Promise<Outcome[]>
queryBriefings(opts: QueryOpts): Promise<Briefing[]>
queryScrapeSnapshots(target: string, before?: Date): Promise<ScrapeSnapshot[]>
```

### 4.4 Reasoning Tools

```typescript
// Decision graph evaluator
evaluateDate(date: string, ctx: EvaluationContext): Promise<DateEvaluation>
checkCompression(date: string, ctx: CompressionContext): Promise<CompressionResult>
computeMagnitude(signalCount: number, regime: LeadTimeRegime): number
classifyPacing(pacing: PacingMetrics): PacingPosition

// Briefing constructor
constructBriefing(type: BriefingType, ctx: BriefingContext): Promise<Briefing>

// Threshold and KB readers
readThreshold(id: string): ThresholdValue
readKBSection(section: string): string
readEventCalendar(date: string): Event[]
```

### 4.5 Notification Tools

```typescript
notifyOperator(notification: { severity: 'info' | 'action_required' | 'urgent', subject: string, body: string, channel?: 'email' | 'slack' | 'both' }): Promise<void>
```

---

## §5. Data Flow

### 5.1 Daily Cron Flow

```
06:00 UTC daily
  ↓
1. fetchListings() → upsert to listings_snapshots
2. fetchListingDetail() per listing → upsert to listing_detail_snapshots
   (captures market_occupancy_next_7/30/60)
3. fetchListingPrices() per listing × 730 days → upsert to listing_prices_snapshots
   (captures full forward calendar — versioned daily)
4. fetchOverrides() per listing → upsert to overrides_snapshots
   diff against yesterday → detect new/changed DSOs → trigger DSO observation flow
5. fetchAllReservations() per PMS → upsert to reservations
   diff → detect new bookings, cancellations → log diff
6. fetchNeighborhoodData() per listing → upsert to neighborhood_data_snapshots

  ↓
7. Run analyzers:
   - Per-date evaluation across next 180 days
   - Aggregate analysis (channel mix, ADR trends, goal trajectory)
   - Anomaly detection
   - DSO change detection (from step 4)
   
  ↓
8. Construct daily pulse briefing
9. Deliver via configured channel
10. Log briefing to briefings table
11. If DSO changes detected → trigger conversational decision capture flow
```

### 5.2 Periodic Scrape Flows

**Every 3 days:**
- Portfolio Analytics scrape → upsert versioned snapshot

**Every 7 days:**
- Market Dashboards scrape (if subscribed) → upsert versioned snapshot
- Compare Competitor Calendar scrape → upsert versioned snapshot
- Airbnb Host Dashboard scrape (Tier B) → upsert versioned snapshot
- Vrbo Host Dashboard scrape (Tier B) → upsert versioned snapshot

**Every 30 days:**
- Listing Customizations audit → upsert versioned snapshot

**Each scrape run:**
1. Execute scrape
2. Validate payload (schema + sanity diff)
3. On success: upsert snapshot, update heartbeat
4. On failure: log failure, increment failure counter, alert operator if > grace threshold

### 5.3 Event-Triggered Flows

**On reservation diff detected (new booking or cancellation):**
1. Recompute pacing for affected date range
2. Re-run compression test for nearby dates
3. If material change, generate event-triggered alert briefing
4. Update goal trajectory snapshot

**On DSO change detected:**
1. Identify whether change was operator-initiated (manual) or system-suggested-then-approved
2. If operator-initiated: trigger conversational capture prompt
3. If system-suggested: confirm execution, schedule outcome checkpoints

**On compression test transition (0/3 → 2/3 or 3/3):**
1. Generate event-triggered alert briefing
2. Include reasoning chain
3. Deliver via urgent notification channel

**On scrape failure (>3 consecutive):**
1. Mark scrape target as stale
2. Briefings now flag staleness
3. Alert operator

### 5.4 Outcome Observation Flow

**For each open decision in `decisions` table:**

```
At decision_timestamp + 7 days:
  observe_outcome_at_checkpoint(decision_id, '7d')
At decision_timestamp + 14 days:
  observe_outcome_at_checkpoint(decision_id, '14d')
At decision_timestamp + 30 days:
  observe_outcome_at_checkpoint(decision_id, '30d')
At max(decision_scope_dates):
  observe_outcome_at_checkpoint(decision_id, 'at_arrival')
  classify_outcome(decision_id)
```

`observe_outcome_at_checkpoint` pulls current state (pacing, comp set, market occupancy, realized bookings since decision) and writes an outcome row.

`classify_outcome` runs at final checkpoint, analyzing realized vs. expected and tagging successful/mixed/unsuccessful/inconclusive.

---

## §6. Schemas

### 6.1 Postgres Tables (Supabase)

```sql
-- Snapshots from API (daily versioned)

CREATE TABLE listing_detail_snapshots (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  payload JSONB NOT NULL,
  market_occupancy_next_7 DECIMAL(5,2),
  market_occupancy_next_30 DECIMAL(5,2),
  market_occupancy_next_60 DECIMAL(5,2),
  own_occupancy_next_7 DECIMAL(5,2),
  own_occupancy_next_30 DECIMAL(5,2),
  own_occupancy_next_60 DECIMAL(5,2),
  base_price DECIMAL(10,2),
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  recommended_base_price TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(listing_id, pms, snapshot_date)
);

CREATE TABLE listing_prices_snapshots (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  date DATE NOT NULL,
  asking_price DECIMAL(10,2),
  user_price DECIMAL(10,2),
  min_stay INT,
  unbookable BOOLEAN,
  demand_color TEXT,
  demand_desc TEXT,
  weekly_discount DECIMAL(5,2),
  monthly_discount DECIMAL(5,2),
  extra_person_fee DECIMAL(10,2),
  check_in BOOLEAN,
  check_out BOOLEAN,
  raw_payload JSONB,
  UNIQUE(listing_id, pms, snapshot_date, date)
);

CREATE TABLE overrides_snapshots (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  override_date DATE NOT NULL,
  price TEXT,
  price_type TEXT, -- 'percent' | 'fixed' | 'daily_factor'
  min_stay INT,
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  check_in_check_out_enabled BOOLEAN,
  check_in TEXT, -- weekday mask
  check_out TEXT,
  reason TEXT,
  raw_payload JSONB,
  UNIQUE(listing_id, pms, snapshot_date, override_date)
);

CREATE TABLE reservations (
  reservation_id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  listing_name TEXT,
  pms TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  no_of_days INT,
  booking_status TEXT, -- 'booked' | 'cancelled'
  booked_date TIMESTAMP,
  cancelled_on TIMESTAMP,
  rental_revenue DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  cleaning_fees DECIMAL(10,2),
  currency TEXT,
  raw_payload JSONB,
  ingested_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reservations_check_in ON reservations(check_in);
CREATE INDEX idx_reservations_pms_status ON reservations(pms, booking_status);

CREATE TABLE reservations_diff_log (
  id BIGSERIAL PRIMARY KEY,
  detected_at TIMESTAMP DEFAULT NOW(),
  diff_type TEXT, -- 'new_booking' | 'cancellation' | 'modification'
  reservation_id TEXT,
  listing_id TEXT,
  pms TEXT,
  details JSONB
);

CREATE TABLE neighborhood_data_snapshots (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE(listing_id, pms, snapshot_date)
);

-- Browser scrape snapshots

CREATE TABLE scrape_snapshots (
  id BIGSERIAL PRIMARY KEY,
  scrape_target TEXT NOT NULL, -- 'portfolio_analytics' | 'market_dashboards' | etc.
  scrape_timestamp TIMESTAMP NOT NULL,
  scrape_status TEXT NOT NULL, -- 'success' | 'partial' | 'failed'
  payload JSONB,
  validation_status TEXT,
  scraper_version TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scrape_snapshots_target_time ON scrape_snapshots(scrape_target, scrape_timestamp);

CREATE TABLE scrape_heartbeats (
  scrape_target TEXT PRIMARY KEY,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  consecutive_failures INT DEFAULT 0,
  staleness_threshold_hours INT
);

-- Decisions and outcomes

CREATE TABLE decisions (
  decision_id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  capture_mechanism TEXT NOT NULL, -- 'dso_observation' | 'conversational' | 'system_suggested'
  decision_type TEXT NOT NULL, -- 'price_change' | 'los_change' | etc.
  scope_dates DATE[],
  scope_channels TEXT[],
  what_changed JSONB,
  rationale_at_time TEXT[],
  expected_outcome TEXT[],
  source_briefing_id TEXT,
  confidence TEXT, -- 'high' | 'medium' | 'low'
  alternatives_considered TEXT[],
  operator_notes TEXT,
  related_decisions TEXT[]
);

CREATE INDEX idx_decisions_type ON decisions(decision_type);
CREATE INDEX idx_decisions_timestamp ON decisions(timestamp DESC);

CREATE TABLE outcomes (
  id BIGSERIAL PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES decisions(decision_id),
  checkpoint TEXT NOT NULL, -- '7d' | '14d' | '30d' | 'at_arrival'
  observed_at TIMESTAMP NOT NULL,
  observed_metrics JSONB,
  notes TEXT,
  UNIQUE(decision_id, checkpoint)
);

CREATE TABLE outcome_classifications (
  decision_id TEXT PRIMARY KEY REFERENCES decisions(decision_id),
  classification TEXT, -- 'successful' | 'mixed' | 'unsuccessful' | 'inconclusive'
  classified_at TIMESTAMP DEFAULT NOW(),
  contributing_factors TEXT[],
  expected_vs_actual TEXT
);

-- Briefings

CREATE TABLE briefings (
  briefing_id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  briefing_type TEXT NOT NULL, -- 'daily_pulse' | 'weekly_synthesis' | 'event_alert' | 'on_demand' | 'forecast'
  content_markdown TEXT,
  content_structured JSONB,
  recommendations_count INT,
  data_sources_used JSONB
);

CREATE INDEX idx_briefings_type_time ON briefings(briefing_type, timestamp DESC);

-- Operator-noted observations

CREATE TABLE operator_notes (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  note_type TEXT, -- 'inquiry' | 'hot_tub_status' | 'regulatory_flag' | 'direct_inquiry' | 'general'
  content TEXT,
  related_dates DATE[],
  related_decisions TEXT[]
);

-- Configuration tables (could also be files)

CREATE TABLE thresholds_runtime (
  threshold_id TEXT PRIMARY KEY,
  current_value JSONB,
  override_status TEXT,
  last_updated TIMESTAMP,
  notes TEXT
);

-- Stage authority configuration

CREATE TABLE stage_authority (
  decision_category TEXT PRIMARY KEY,
  current_stage TEXT, -- 'S1' | 'S2' | 'S3' | 'S4' | 'S5'
  authority_bounds JSONB, -- e.g., {max_magnitude_pct: 0.05}
  promoted_at TIMESTAMP,
  track_record_window_start TIMESTAMP
);
```

### 6.2 Decision Object Schema

```typescript
interface Decision {
  decision_id: string;            // dec_YYYYMMDD_NNN
  timestamp: string;              // ISO 8601
  capture_mechanism: 'dso_observation' | 'conversational' | 'system_suggested';
  decision_type: DecisionType;
  scope: {
    dates: string[];
    channels: ('airbnb' | 'vrbo' | 'bcom' | 'direct')[];
  };
  what_changed: {
    field: string;
    from: any;
    to: any;
    method: 'dso_percent' | 'dso_fixed' | 'base_price_change' | 'api_override';
  };
  rationale_at_time: string[];
  expected_outcome: string[];
  source_briefing_id?: string;
  confidence: 'high' | 'medium' | 'low';
  alternatives_considered: string[];
  operator_notes?: string;
  related_decisions: string[];
}
```

### 6.3 Outcome Object Schema

```typescript
interface Outcome {
  decision_id: string;
  checkpoint: '7d' | '14d' | '30d' | 'at_arrival';
  observed_at: string;
  observed_metrics: {
    pickup?: number;
    pacing_position?: 'ahead' | 'on_track' | 'behind';
    market_occupancy_delta?: number;
    comp_movement?: string;
    new_bookings?: number;
    realized_revenue?: number;
    [key: string]: any;
  };
  notes?: string;
}

interface OutcomeClassification {
  decision_id: string;
  classification: 'successful' | 'mixed' | 'unsuccessful' | 'inconclusive';
  contributing_factors: string[];
  expected_vs_actual: string;
}
```

---

## §7. Decision Capture Mechanisms (Detail)

### 7.1 DSO Observation Flow

This is the highest-value capture mechanism — invisible to operator, automatic.

```
Daily cron → fetchOverrides() per listing
  ↓
Diff against yesterday's overrides_snapshots
  ↓
For each new/changed override:
  - Identify if change is operator-initiated or system-suggested-then-approved
  - For operator-initiated:
      Generate operator prompt:
        "I see you applied a {price_type} {price} on {override_date}.
         What's the rationale? I'll add this to the decision log
         and start tracking the outcome.
         
         Current context:
         - Pacing position for this date: {pacing}
         - Market-relative occupancy: {market_delta}
         - Comp set position: {comp}
         - Active events nearby: {events}
         - KB rules likely in play: {rules}
         
         Any rationale? Or skip if no log needed."
      
      Wait for operator response (in chat or via dashboard)
      
      On response:
        Build Decision object with:
          capture_mechanism: 'dso_observation'
          rationale_at_time: [operator response + auto-context]
          confidence: derived
        Persist to decisions table
        Schedule outcome checkpoints
```

### 7.2 Conversational Capture Flow

```
Operator chats: "I just dropped Memorial Day weekend by 8% because pickup was lagging."
  ↓
Parse message:
  - Decision type: price_change
  - Scope dates: identify "Memorial Day weekend" → [2026-05-22, 2026-05-23, 2026-05-24, 2026-05-25]
  - Magnitude: -8%
  - Stated rationale: "pickup was lagging"
  ↓
Validate against current data:
  - Confirm DSO is now visible in next API poll OR
  - If not yet visible, flag and ask operator to confirm
  ↓
Auto-augment with context:
  - Current pacing for Memorial Day weekend
  - Recent comp moves
  - Applicable KB rules (T-8 framework, weak demand branch §7.6)
  ↓
Confirm back to operator:
  "Logged dec_20260501_007. Decision: -8% on Memorial Day weekend
   (May 22-25). Rationale: pickup was lagging. 
   
   I'll observe outcomes at 7d (May 8), 14d (May 15), 30d (May 31),
   and at-arrival (May 22-25).
   
   Anything else to add?"
  ↓
Persist Decision object to decisions table
Schedule outcome checkpoints
```

### 7.3 System-Suggested + Operator-Approved Flow

```
Briefing or chat surfaces recommendation:
  "Recommendation: raise July 31 from $1,800 to $2,500 (Lolla compression).
   [Full reasoning chain as per §8.2 of system prompt]
   
   Approve? Modify? Reject?"
  ↓
Operator approves:
  - Stage 1 (current): Operator manually executes in PriceLabs UI
    System pre-creates Decision object with status: 'pending_execution'
    On next DSO poll, when override appears, link DSO to decision and
      mark status: 'executed'
  - Stage 2+: System executes via API
    Decision object created with status: 'executed' immediately
  ↓
Schedule outcome checkpoints
```

---

## §8. Outcome Assessment Mechanisms

### 8.1 Per-Decision Checkpoint Observation

For each open decision, scheduled jobs run at:
- decision_timestamp + 7 days
- decision_timestamp + 14 days
- decision_timestamp + 30 days
- max(decision.scope.dates) — at-arrival checkpoint

Each checkpoint computes observed metrics relevant to the decision type:

**For price_change:**
- New bookings since decision (count, revenue, channel)
- Pacing position (ahead/on-track/behind)
- Market-relative occupancy delta
- Comp set movement since decision
- Realized vs. expected ADR

**For los_change:**
- New bookings of target LOS (count, revenue)
- Conversion rate of inquiries since change
- Bookings rejected for not meeting LOS

**For cancellation_policy_change:**
- New bookings since change
- Cancellation rate of new bookings (when sample sufficient)

**For channel_strategy:**
- Per-channel pickup since change
- Per-channel revenue share

### 8.2 Final Classification

At the at_arrival checkpoint, classify the decision:

```
function classifyOutcome(decision, observations):
  expected = decision.expected_outcome
  actual = observations.at_arrival
  
  if actual exceeds expected on key metrics:
    return 'successful'
  elif actual matches expected:
    return 'successful'
  elif actual mixed (some metrics good, some bad):
    return 'mixed'
  elif actual significantly under expected:
    return 'unsuccessful'
  elif insufficient data to judge:
    return 'inconclusive'
  
  Also identify contributing_factors:
    - Compression more/less than forecast
    - Comp set movement
    - Cancellation impact
    - Anomalous events
```

### 8.3 Monthly Retrospective

Scheduled monthly, aggregates the prior month's classifications:

```
Pull all decisions from last 30 days
Group by decision_type
For each group:
  count_successful = ...
  count_mixed = ...
  count_unsuccessful = ...
  success_rate = successful / total
  
  identify_pattern_signals(decisions):
    - Are raises systematically overshooting?
    - Are drops systematically working at expected magnitude?
    - Any threshold that may need adjustment?
  
  identify_stage_progression_candidates:
    - Decision categories with success_rate > 85% over n>=5 decisions
    - Categories with sufficient track record window (3+ months)
  
Generate retrospective briefing:
  - Per-category success rate table
  - Pattern observations
  - Threshold calibration suggestions
  - Stage progression candidates
  - Lessons that should update Master KB
```

---

## §9. Briefing Construction Pipeline (Detail)

### 9.1 Pipeline Stages

```
INGEST
  Pull state per briefing type:
    Daily Pulse:
      - Latest reservations + diff (since last pulse)
      - Latest listing_detail (market_occupancy fields)
      - Latest overrides + diff
      - Compression check across next 60 days
      - Active tests status
      - Goal trajectory snapshot
      - Latest scrape heartbeats (for staleness flags)
    
    Weekly Synthesis:
      - All of the above for the past week aggregated
      - Booking curves from latest Portfolio Analytics scrape
      - Comp set state from latest Market Dashboards scrape
      - Threshold-evaluation status
    
    Event Alert:
      - Triggering event details
      - Affected dates + scope
      - Most recent relevant data slice
    
    On-Demand (chat):
      - Question-relevant slice + full KB + decision log
    
    Forecast Narrative:
      - Forward 30/60/90 day data
      - Event calendar overlay
      - Pacing forecasts

ANALYZE
  Per-date evaluation (next 180 days):
    For each date d:
      regime = lead_time_regime(d)
      pacing = compute_pacing(d, scrapes, market_occupancy)
      compression = check_compression(d, scrapes, reservations, market)
      events = read_event_calendar(d)
      target_occ = lookup_target(regime)
      gap = target_occ - current_occ
      direction = classify_gap(gap)
      if compression.signals_count >= 2:
        direction = 'raise'
      magnitude = compute_magnitude(signal_count, regime)
      proposed_action = build_action(direction, magnitude, current, events)
  
  Aggregate analysis:
    Channel mix trends, ADR trends, goal trajectory, etc.
  
  Anomaly detection:
    Unexpected pickup, comp moves, scraper failures, etc.

INTERPRET
  Apply Master KB frameworks
  Cross-reference threshold values
  For each proposed action:
    Build reasoning chain (per §4 of system prompt format)
    Determine confidence
    List alternatives considered

STRUCTURE
  Group findings:
    Required-decision-today (top of brief)
    Material-but-not-urgent
    Informational
  Format per briefing type template

PRESENT
  Render markdown (and structured JSON for dashboard)
  Include all citations and source links
  Include next-checkpoint recommendations
  Persist to briefings table
  Deliver via configured channel
```

### 9.2 Reasoning Chain Format (Mandatory)

Every recommendation embedded in any briefing follows this structure:

```markdown
## [Recommendation title]

**Action:** [Concrete action with magnitude and scope]

**Reasoning chain:**

1. **Signals fired:**
   - [Observation 1 with source]
   - [Observation 2 with source]

2. **KB rules applying:**
   - [Master KB §X.Y]: [rule summary]
   - [Master KB §X.Y]: [rule summary]

3. **Thresholds informing:**
   - T-X (current value: V): [how it applies]
   - T-Y (current value: V): [how it applies]

4. **Why this magnitude/direction:**
   [Explanation, not handwaving]

5. **Alternatives considered:**
   - [Option A]: [why rejected]
   - [Option B]: [why rejected]

6. **Confidence:** [high/medium/low] — [justification]

7. **Sources:**
   - [Citation 1]
   - [Citation 2]

8. **Next checkpoint:** [When to revisit, what to look for]
```

---

## §10. Conversational Query Handler

### 10.1 Query Loop

```
On operator chat message:
  1. Load full context (KB + thresholds + recent data + decision log)
  2. Classify query type:
     - status / diagnostic / recommendation / educational / historical / what-if / decision-capture / threshold-override
  3. Pull additional data slices per query type
  4. Generate response with reasoning chain (where applicable)
  5. If response includes recommendations: format as approval-ready
  6. If response is a decision capture: persist Decision and confirm
  7. If response is a threshold override: update thresholds.yaml and confirm
```

### 10.2 Query Types and Handlers

**Status query** ("how am I tracking?")
- Pull goal trajectory, YTD revenue, forward booked, channel mix
- Format with headline metric → context → driver decomposition

**Diagnostic query** ("why is Vrbo so weak?")
- Pull relevant data slice (Vrbo reservations, Vrbo pacing, Vrbo asking prices)
- Enumerate hypotheses
- Evaluate each against evidence
- Surface most likely cause

**Recommendation query** ("should I drop Memorial Day?")
- Run per-date evaluation for the requested scope
- Produce full reasoning chain recommendation

**Educational query** ("explain T-8")
- Pull KB section
- Apply to current data as concrete example

**Historical query** ("what did I decide about June 7?")
- Query decisions table for matching entries
- Pull related outcomes
- Surface context + lessons

**What-if query** ("what if I raise weekend prices 10%?")
- Project scenario
- Estimate downstream impact (revenue, occupancy, channel impact)
- Note confidence/uncertainty

**Decision-capture query** ("I just dropped X")
- Conversational decision capture flow (§7.2)

**Threshold override query** ("change T-15 to -12%")
- Update thresholds.yaml
- Confirm change
- Note the override in decision log

---

## §11. Failure Modes and Fallbacks

### 11.1 PriceLabs API Down

- Detect via timeout or error
- Retry with exponential backoff (3 attempts)
- If still failing:
  - Mark API as stale in heartbeat
  - Briefings flag staleness
  - Skip per-date evaluation (use last known state)
  - Chat queries use last cached data with explicit staleness note
  - Alert operator if down > 6 hours

### 11.2 Scraper Failures

Per scrape target:
- 1 failure: log, retry next cadence
- 2 consecutive failures: log, alert operator (info severity)
- 3+ consecutive failures: mark target stale, alert operator (action_required)
- Briefings using that target flag staleness explicitly: *"Comp set data last refreshed 9 days ago — Market Dashboards scraper has been failing since {date}."*

Recovery: when scraper succeeds again, run validation diff between current and last-known-good. If diff is implausible, alert and require operator validation.

### 11.3 Conflicting Signals

When pacing says "raise" but compression test fires opposite, or compression says "raise" but listing health says "value gap":
- The decision graph is hierarchical: compression overrides pacing; listing-health diagnostic overrides both for visibility/value-gap classification
- Log the conflict explicitly in the reasoning chain
- If signals conflict in unexpected ways, escalate as event-triggered alert

### 11.4 Data Anomalies

Detect (not auto-react):
- Sudden 50%+ price move in comp set (likely data error)
- Pickup velocity >5× baseline (possible feed issue)
- Reservation count drops (possible sync error, not real cancellations)
- Forward booked dates suddenly going to zero

For all: do not act, escalate with full context, hold last-known-good as truth until verified.

### 11.5 Threshold Lookup Failures

If `read_threshold("T-X")` returns null:
- Use the value embedded in Master KB as fallback
- Log threshold-load failure
- Notify operator (info severity)

### 11.6 Action Execution Failures (S2+)

For Stage 2+, when system attempts to execute via PriceLabs API:
- If `upsertOverrides()` fails after retry:
  - Roll back any partial changes
  - Log failure with full context
  - Escalate to operator with proposed change that didn't execute
  - Mark decision status: 'execution_failed'

---

## §12. Testing and Validation

### 12.1 Pre-Launch Validation

**Decision-graph determinism:** Same inputs → same outputs. Run same date evaluation 10× and verify identical reasoning chains and proposed actions.

**Threshold sensitivity:** Adjust each threshold by ±10% and verify decision changes are proportional and predictable.

**Edge cases:**
- Date with zero booking history → behavior = hold + flag
- Conflicting compression and weak-pacing signals → behavior = hierarchical resolution + log conflict
- Proposed price below variable cost floor → clamp + log
- Lolla date 30 days out with no current bookings → full event multiplier + 4-night LOS recommendation

**Reasoning audit:** For 10 random past dates, run the system and check that reasoning chains match what an experienced operator would have decided. Disagreements either reveal bugs or surface threshold mis-calibrations.

**Briefing quality:** For 5 simulated days of data, generate Daily Pulses and have operator review for clarity, completeness, and educational value.

### 12.2 Shadow Mode (Stage 1, First 30+ Days)

The Second Brain runs at Stage 1 (read-only, brief + suggest, no execution) regardless of build state. The "shadow mode" of the original Phase 3 spec is conceptually subsumed: in this product, every recommendation is "shadow" until operator approves and executes. There's no separate shadow-vs-live distinction.

What we want from the first 30 days:
- 30+ days of clean briefing generation
- Operator agrees with recommendations >80% of the time
- No critical reasoning errors
- Threshold calibrations approved or overridden

After 30 days: review thresholds, refine briefing format, evaluate readiness for first decision capture flows.

### 12.3 Stage Progression Validation

Before any decision category advances from S1 to S2:
- ≥5 decisions of that type with operator-approved recommendations
- ≥3 months of recommendation track record
- Operator explicit approval to advance

Before S2 → S3 (the first true autonomy):
- ≥10 decisions of that type at S2
- Success rate >85%
- ≥6 months at S2
- Explicit operator approval

Each stage has its own progression gate. No automatic promotion.

---

## §13. Evolution Path: Becoming a Semi-Agent

### 13.1 What Changes at Each Stage

**S1 → S2:** No code changes; operator UX adds an "approve and I'll handle it" button. When operator approves, system pre-creates Decision in 'pending_execution' state; operator manually executes; system observes via DSO and links.

**S2 → S3 (per category):** The system's authority logic activates per-category bounds. For decision categories at S3, the system can execute via API after recommendation generation if magnitude is within bounds, without explicit operator approval. Categories not yet at S3 still require approval.

**S3 → S4:** Bounds widen (e.g., from ±5% to ±10% magnitude). No structural change.

**S4 → S5:** Full dynamic pricing within configured anchors. The Phase 3 spec's vision realized — but earned through evidence.

### 13.2 The Invariant Across Stages

Reasoning chains remain mandatory at every stage. Even at S5, every executed decision has a full reasoning chain in the log. The system never becomes opaque just because authority widens.

### 13.3 Reversibility

Stage progressions can be reversed. If a decision category at S3 starts producing bad outcomes, the operator can demote it back to S2 (or further). Stage state is configuration, not architecture.

---

## §14. Implementation Plan

### 14.1 Sprint Sequencing

**Sprint 1 — API Coverage Extension (Phase 6.1)**
- Extend `lib/pricelabs.ts` with all 11 endpoint wrappers
- Build daily snapshot ingestion for all read endpoints
- Build reservation diff detection
- Build DSO change detection

**Sprint 2 — Daily Pulse Briefing (Phase 6.2)**
- Implement briefing constructor for daily-pulse template
- Wire reasoning chain generator
- Implement notification delivery
- Persist briefings to table

**Sprint 3 — Chat Interface (Phase 6.3)**
- Build chat endpoint with full context loading
- Implement query type classification
- Implement query handlers
- Build DSO observation prompt flow

**Sprint 4 — Decision Capture and Outcome Tracking (Phase 6.4)**
- Implement decision logging from chat and DSO observation
- Implement scheduled outcome observation jobs
- Implement monthly retrospective generation
- Build basic Decisions view in dashboard

**Sprint 5 — Browser Scraping Tier A (Phase 6.5)**
- Stand up scraping framework
- Implement Portfolio Analytics scraper
- Implement Market Dashboards scraper (subscribe to dashboard first)
- Implement CCC and Listing Customizations scrapers
- Wire scraped data into briefings

**Sprint 6 — Listing Health Scraping Tier B (Phase 6.6)**
- Implement Airbnb Host Dashboard scraper
- Implement Vrbo Host Dashboard scraper
- Integrate listing-health metrics into briefings

**Sprint 7 — Event Calendar Pipeline (Phase 6.7)**
- Build Choose Chicago / McCormick scrapers
- Auto-update event_calendar table
- Surface event-readiness in briefings

**Sprint 8 — Dashboard (Phase 6.8)**
- Implement primary views (Today, Calendar, Trajectory, Decisions, Chat)
- Implement secondary views
- Iterate UX

**Sprint 9+ — Stage Progression**
- After 6+ months, review S1→S2 candidates per category
- Build approval-and-execute flow
- Continue gradual progression

### 14.2 Critical-Path Dependencies

- Sprint 1 unblocks everything; Sprint 2 depends on Sprint 1
- Sprint 3 (chat) can run in parallel with Sprint 2 once data plumbing is done
- Sprint 4 (decisions) depends on Sprint 3 (chat is the primary capture interface)
- Sprint 5 (scraping) depends on Sprint 1 (storage layer) but is independent of Sprints 2-4
- Sprint 8 (dashboard) is the final consumer; everything feeds it

### 14.3 Estimated Build Times

Order-of-magnitude for one engineer:
- Sprint 1: 3–5 days
- Sprint 2: 2–4 days
- Sprint 3: 4–7 days
- Sprint 4: 3–5 days
- Sprint 5: 5–10 days (scraping is brittle)
- Sprint 6: 3–5 days
- Sprint 7: 2–4 days
- Sprint 8: 5–10 days

Total: ~30–50 engineering days for full Phase 6 build. Comfortable target: ~6–8 weeks of focused part-time work.

---

## §15. Open Questions

Before Sprint 1 begins:

1. **Confirmation on stack alignment.** The runtime is the existing Next.js + Supabase + `lib/pricelabs.ts` setup. Confirm.

2. **Cron infrastructure.** Vercel cron, or separate scheduler? Affects scrape job hosting in particular (Vercel cron has time limits that may affect long scrapes).

3. **Notification channel.** Email, Slack, in-app, or all? Affects Sprint 2 build.

4. **Approval UI for Stage 2.** Email links, in-app buttons, or chat-based approval? Affects Sprint 4+ when stage progression begins.

5. **Booking.com clarification.** Reservations history confirmation: any realized bookings? Adjusts channel-mix logic.

6. **Dormant Airbnb listing.** Investigate `662725717960110756`; either remove from PriceLabs or document as parked.

7. **Market Dashboards subscription.** $9.99/mo. Subscribe before Sprint 5 begins.

8. **Scraping infrastructure choice.** Claude in Chrome (faster setup, conversational flexibility) vs. Playwright (more reliable headless server-side). Recommendation: Claude in Chrome for v1; revisit if reliability becomes an issue.

9. **Listing-health priority.** Tier B (Airbnb/Vrbo scraping) before or after Tier A (PriceLabs scraping)? Default: Tier A first because it's contained to one platform; Tier B has different fragility profile per platform.

10. **Operator response time SLA.** How long before unhandled escalations re-escalate?

---

*End of Second Brain + Semi-Agent Specification v1.0. Companion documents: Phase 6 Architecture v2 (strategic), Second Brain System Prompt (runtime), Master KB v1.0 (knowledge), thresholds.yaml (calibration).*
