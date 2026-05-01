# Master Revenue Management Knowledge Base
## The Jackpot — Stravon Group LLC

**Version:** 1.0 | **Last Updated:** April 30, 2026 | **Property:** The Jackpot, North Park / Lincoln Square, Chicago

---

## How to Use This Document

This is the canonical source of truth for revenue management of The Jackpot. It serves two readers:
- **You** — as the operator, for strategic decisions and weekly/monthly review
- **The future agent** (Phase 3) — as the input it reasons over

Sections are organized **by use, not by source phase.** When you need to answer "what should I do about X?", the section for X has the answer plus the reasoning. When the agent needs to decide whether to raise prices, the decision-logic section has the executable rules.

Generic revenue management frameworks remain visible (in case the KB ever gets reused for another property or another market); property-specific calibrations are layered as subsections within each topic. Override values live in §11.

The four prior phase documents (Phase 1 audit, Phase 2.1 specs, Phase 2.2 generic research, Phase 2.3 Chicago/property research) remain as the audit trail. This document supersedes them as the operational reference.

---

## §1. Foundations

### 1.1 What Revenue Management Is

The science and art of offering the right product, at the right price, to the right customer, at the right time, on the right channel. For STRs specifically: it's the discipline of matching perishable inventory (unsold nights are permanently lost revenue) against shifting demand to maximize total revenue — not occupancy, not ADR, but the equilibrium between them.

Revenue management is **probabilistic, not deterministic.** Every pricing decision is a bet with three components: upside (revenue gained if it books at the higher price), downside (revenue lost if it goes unbooked), and likelihood (probability of booking). The right answer is rarely the highest price or the lowest — it's the price with the best expected value given current information.

### 1.2 Glossary (Canonical Terms)

The terms below are the only sanctioned names. When the agent or this document uses these words, they mean exactly this.

**ADR** — Revenue ÷ Nights Booked. Pricing power indicator.

**Active Compression Response** — Action triggered when current pacing exceeds forecast or market availability drops rapidly. Raise prices, remove restrictions, eliminate discounts.

**Base Price** — Positioning anchor signaling property tier. Audited every 3–4 weeks.

**Booking Curve** — Cumulative inventory consumption over time, plotted against lead time. Leading indicator of demand.

**Calibrated Judgment** — The art-meets-data dimension of revenue management. (Renamed from "Sweet Spot" to avoid conflict with the rate/occupancy equilibrium concept.)

**Channel-Aware Pricing** — Pricing that differs by channel based on take-rate, audience, and conversion economics.

**Compression** — Market state where supply tightens rapidly, urgency overrides price-shopping, remaining inventory becomes inelastic to price increases. Detected via 2-of-3 signal test (see §6.4).

**Confidence Tier** — One of C0–C4, denoting how much data the agent has and how autonomously it can act (see §8.5).

**Custom Demand Calendar** — Date-by-date behavioral classification replacing generic seasonal labels. Three data layers: Historical, Pacing, External Signals.

**Demand Segment Tag** — Per-date classification: High-Pace 🔥, Normal 📈, Slow ⚠.

**Dynamic Minimum Price** — Variable Cost ÷ (1 − Target Contribution Margin). Seasonally varying floor.

**Lead Time** — Days between booking date and arrival date.

**Length of Stay (LOS) Restriction** — Minimum-night requirement for a date. A *type* of rate fence.

**Occupancy** — Nights Booked ÷ Nights Available × 100.

**Orphan Night** — A 1–2 night gap between confirmed bookings. Cost drives LOS strategy.

**Pacing** — Speed at which future inventory is being consumed vs. benchmarks.

**Pickup** — New bookings gained in a recent rolling window. The momentum.

**Pre-Compression Hold** — Action triggered when forecast indicates compression coming but pacing is still normal. Don't drop price; the date is expected to fill.

**Rate Fence** — Non-price instrument used to differentiate pricing across guest segments. LOS, cancellation tier, advance-purchase, day-of-week restrictions are all rate fences.

**RevPAR** — Occupancy × ADR. Holistic efficiency measure.

**Sweet Spot** — The rate × occupancy equilibrium that maximizes total revenue.

**The Jackpot** — The 14-guest single-family STR in North Park / Lincoln Square, Chicago. The property this KB is calibrated for.

**Three-Part Trade-Off** — Upside / Downside / Likelihood — the lens for every pricing decision.

---

## §2. The Property — The Jackpot

### 2.1 Operating Profile

| Attribute | Value |
|---|---|
| Capacity | 14 guests |
| Type | Single-family home |
| Submarket | North Park / Lincoln Square, Chicago |
| Owner entity | Stravon Group LLC |
| Tier positioning | Upscale |
| Key amenities | Hot tub (year-round revenue driver), [other amenities pending audit] |
| Channels active | Airbnb, Vrbo |
| Channel mix (current) | 70% Airbnb / 30% Vrbo / 0% Booking.com |
| Listing health | Compliant, no suppression, strong reviews |
| Listing live since | November 2025 |
| Owner usage pattern | Weekday self-fill when not booked |

### 2.2 Cost Structure

**Fixed monthly costs:** $5,990/month → **$71,880/year**

| Line | Amount |
|---|---:|
| Mortgage (incl. property tax + insurance escrow) | $5,210 |
| Electric (ComEd) | $250 |
| Gas (avg; ranges $100–$500 seasonal) | $250 |
| Hot tub chemicals | $150 |
| Internet | $90 |
| PriceLabs | $40 |

**Variable per booking:** $540

| Line | Amount |
|---|---:|
| Cleaning | $350 |
| Laundry | $150 |
| Welcome gifts / supplies | $40 |

**Note on gas seasonality:** Winter gas can run +$250 above the average ($500 vs $250). This means winter all-in fixed costs are effectively ~$6,240/month, not $5,990. The agent should reflect this in seasonal break-even calculations rather than using a flat year-round number.

**Hot tub damage offset:** Guests are charged $250 when the hot tub requires unscheduled drain/clean due to misuse. This is pass-through (not your cost) and can be modeled as zero-net.

**Cost lines not included:** Maintenance reserve, furniture/capex amortization, owner draw, income tax. These are real economic costs but sit outside the operational P&L the agent optimizes against. Worth budgeting separately.

### 2.3 Realized Pricing Performance (as of April 30, 2026)

Source: PriceLabs reservation data feed.

| Window | Nights | Revenue | ADR |
|---|---:|---:|---:|
| Past (Nov 2025 – Apr 2026) | 65 | $45,924 | $707 |
| Future booked (May – Jul 2026) | 19 | $24,716 | **$1,301** |
| **Combined** | **84** | **$70,640** | **$841** |

**The trajectory is the headline.** First six months were deliberate underpricing for review velocity and PriceLabs calibration. Realized rates have stepped up almost monthly. Recent forward-booked summer weekends ($1,690–$2,173) confirm market acceptance of the new band.

**Three-month rolling weekend ADR:**

```
Nov 2025  $740  ─┐ Launch / discovery period
Dec 2025  $682  ─┤
Jan 2026  $644  ─┤
Feb 2026  $625  ─┘
Mar 2026  $815  ◄ Inflection — review threshold + algorithm calibration
Apr 2026  $908
May 2026  $944
Jun 2026  $1,128
Jul 2026  $1,460
```

### 2.4 Seasonality Profile

| Season | Months | Weekend ADR | All-Night ADR |
|---|---|---:|---:|
| Peak | Jun – Aug | **$1,811** | $1,786 |
| Spring shoulder | Mar – May | $944 | $855 |
| Fall shoulder | Sep – Nov | $740 | $629 |
| Winter | Dec – Feb | $625 | $588 |

**Summer peak is 3.0× winter trough.** This is a large seasonal swing and reflects Chicago's broader hotel ADR cycle (downtown CBD hotels run a similar amplitude).

### 2.5 Goal Architecture

**$200K stretch / $175K floor (gross revenue, all channels combined).**

Working from confirmed cost structure ($71,880 fixed + $540/booking variable + 12.4% blended OTA fee at current channel mix):

| Path | Avg ADR | Nights | Occupancy | Net after costs |
|---|---:|---:|---:|---:|
| Current run-rate | $841 | ~130 | 36% | ~$10K |
| **$175K floor** | $1,094 | 160 | 44% | ~$32K |
| **$200K stretch** | $1,111 | 180 | 49% | ~$45K |

Net figures above are pre-owner-draw, pre-income-tax, pre-capex. They're the cushion above operating break-even, not take-home.

**Key insight:** Summer carries the year. Winter at $625 weekend ADR / lower occupancy barely clears fixed-cost carry. The $200K goal requires summer overperformance to subsidize winter underperformance, plus shoulder-season optimization to widen the runway.

### 2.6 Use-Case Profile

The Jackpot is fluid across multiple use cases. Mix is preliminary pending more booking history:

- **Peak weekend leisure groups** (likely primary): family reunions, milestone celebrations, bachelor/bachelorette weekends — high group size, weekend, 2–3 night LOS
- **Holiday/winter family stays** (December peak): multi-night, large-group, holiday compressions
- **Summer event-driven** (Lollapalooza, Pride, NASCAR, Air & Water Show): longer LOS, higher ADR tolerance, often booked further out
- **Wedding-guest lodging** (currently dormant via Lets Batch but real underlying demand): summer/fall weekend, mid-to-large groups, planner-influenced

The agent should treat use-case mix as fluid and price by the booking pattern (lead time × LOS × group size × day-of-week) rather than asking "who is this guest" upfront.

### 2.7 Strategic Positioning Statement

The Jackpot is a **scarcity-tier property in a tightening regulatory market within a booming tourism cycle.**

- **14-guest capacity** is a thin-supply tier in Chicago (regulatory caps + high property cost limit new entry into large STRs). This is a structural moat.
- **Hot tub** is a year-round revenue lever, particularly valuable in cold-weather months when most amenity premiums compress.
- **North Side location** is downtown-event overflow capacity — close enough to capture compression spillover, far enough to be a "value alternative" to $400+ Loop hotels.
- **Existing legal status** is a regulatory asset (grandfather protection if Napolitano-style ordinances pass).

Pricing strategy should reflect scarcity, not price-compete with commodity STRs.

---

## §3. The Market — Chicago Context

### 3.1 Macro Tourism Backdrop

Chicago is in a tourism boom that defies the national trend (sourced from Choose Chicago 2025 reports):

- Summer 2025 hotel demand: 3.56M room nights in CBD, +4.3% YoY, all-time record
- Summer 2025 hotel revenue: $949M, all-time record
- Leisure share growing fastest: leisure rooms +11.2% YoY
- 2024 baseline: 55.3M visitors, $20.6B economic impact, 68.2% downtown occupancy, $241.74 ADR
- National trend during same period: hotel demand *down* 0.5%

Chicago's tourism cycle is broadly favorable for high-quality STRs through 2026 and likely 2027. The agent should not treat current pricing power as anomalous — it reflects structural demand, not a temporary spike.

### 3.2 Regulatory Environment

**Operating framework (current):**
- Two STR license categories: Shared Housing Unit (primary residence; 245+ days/year) and Vacation Rental (non-primary residence; higher fee). The two are alternatives, not stackable.
- 6-bedroom maximum to qualify for either category.
- Chicago tax stack: 6% Hotel Accommodations Tax + Vacation Rental and Shared Housing Surcharge + Illinois Hotel Operators' Occupation Tax (effective July 1, 2025). Marketplaces (Airbnb/Vrbo) collect Illinois lodging taxes from Jan 6, 2026.
- Violations: $2,500–$10,000 per offense; license revocation possible.

**The Napolitano Ordinance:** Committee-approved June 2025; full council vote unclear from public reporting. If passed, it would let aldermen ban new STRs in precincts unilaterally with 10% voter signature reversal — but **existing legal rentals are grandfathered.** Trajectory is tightening, not loosening.

**Compliance posture:** A separate compliance review is recommended given the property's hybrid usage pattern (weekday owner stays + weekend rentals). The agent does not make compliance decisions — those sit with the operator and qualified counsel. Loss of legal status would invalidate the entire revenue model, so the agent should flag any guest-behavior pattern (party-style bookings, noise complaints, neighbor-issue reports) as elevated-risk and route to operator review.

### 3.3 Demand Drivers — 2026 Event Calendar

The event calendar is the agent's most important demand input. Major events drive compression beyond what generic seasonality captures.

| Event | Dates | Magnitude | Direct vs. Overflow |
|---|---|---|---|
| **Lollapalooza** | Jul 30 – Aug 2 | EXTREME | Overflow + direct |
| **RSNA Annual Meeting** | Nov 29 – Dec 3 | EXTREME | Overflow |
| **Chicago Marathon** | Oct 9 – 10 | HIGH | Overflow + direct |
| **NASCAR Chicago Street Race** | TBD (typically July) | HIGH | Overflow |
| **IMTS** | Sept 14 – 19 | HIGH | Overflow |
| **Chicago Auto Show** | Feb 6 – 16 | HIGH | Overflow |
| **AHA Scientific Sessions** | Nov 7 – 9 | HIGH | Overflow |
| **Chicago Dental Society Midwinter** | Feb 19 – 21 | MEDIUM | Overflow |
| **ALA Annual Conference** | Jun 25 – 29 | MEDIUM | Overflow |
| **GBTA Convention** | Aug 3 – 6 | MEDIUM | Overflow |
| **AFSCME Biennial** | Aug 17 – 21 | MEDIUM | Overflow |
| **ACS Fall National Meeting** | Aug 23 – 27 | MEDIUM | Overflow |
| **PACK EXPO** | Oct (TBD) | MEDIUM | Overflow |
| **ACEP / APTA** | Oct 5 – 7 | MEDIUM | Overflow |
| **ANCC Magnet** | Oct 28 – 30 | MEDIUM | Overflow |
| **Christkindlmarket** | mid-Nov – Dec | LEISURE-SUSTAINING | Direct |
| **NYE celebrations** | Dec 31 – Jan 1 | HIGH | Direct |

**Recurring weekly drivers (North Side specific):**
- **Cubs home weekends** (Wrigley Field, ~10–15 min): apply 1.3–1.5× weekend multiplier
- **Northwestern home football weekends** (Evanston, ~15 min): apply 1.3–1.5× multiplier; bigger for ranked visiting teams
- **University moments:** move-in, graduation, parents' weekends for Northwestern, Loyola, DePaul

**Holidays:** Memorial Day, July 4 (highly compressed in Chicago — Navy Pier fireworks), Labor Day, Halloween, Thanksgiving, Christmas.

### 3.4 Submarket Positioning

North Park / Lincoln Square is **strategically positioned, not disadvantaged.**

- 8–10 miles from the Loop; 30–45 min by Brown/Red Line/Metra
- ~25 minutes from O'Hare (relevant for fly-in conference attendees)
- Wrigley Field 10–15 min away
- Northwestern Evanston 15 min
- Demographically: residential, family-friendly, accessible to downtown but not in it

The competitive frame is *not* "compete with downtown STRs on price" — it's "offer downtown access at a fraction of downtown hotel cost in a quieter neighborhood with more space and a hot tub."

### 3.5 Channel Landscape

| Channel | Host fee | Guest fee | Take rate (effective) | Audience profile |
|---|---:|---:|---:|---|
| Airbnb (single-fee, current) | 15.5% | 0 | 15.5% | Millennials, Gen Z, solo travelers, urban |
| Airbnb + Super Strict cancel | 17.5% | 0 | 17.5% | Same |
| Vrbo (PMS-connected) | 5% | 6–15% | 5% | Families, 45+, longer-lead, lower cancel |
| Vrbo (pay-per-booking) | 5% + 3% proc | 6–15% | ~8% | Same |
| Direct | Payment proc only | 0 | ~2.9% | Repeat guests, referrals |

**Channel mix implications for The Jackpot:**
- Vrbo's audience profile (families, 45+, larger groups, longer lead, lower cancel) is exactly your property's demographic. Current 70/30 mix has room to shift toward 60/40 or 55/45 favoring Vrbo without losing demand.
- The Vrbo summer-bookings gap (zero forward bookings May–Jul) is a leakage signal worth diagnosing — likely Vrbo asking rates set identically to Airbnb, ignoring channel-specific elasticity.

---

## §4. Data Layer

### 4.1 Primary Data Source: PriceLabs API

PriceLabs is the agent's primary data plane. The API has Claude Code integration already established (per operator) and provides:

- **Reservations:** past + future booked nights, ADR, channel, LOS, lead time
- **Prices:** current asking rate calendar, base price, dynamic adjustments
- **Listing data:** capacity, amenities, status flags
- **Market data:** comparable property pricing, occupancy benchmarks
- **Neighborhood data:** localized supply, demand, ADR percentiles
- **Minimum stay:** current LOS rules

This is the data layer the future agent reasons over. Phase 6/7 will specify the integration architecture (which endpoints feed which decisions, polling cadence, caching strategy, action triggers).

### 4.2 Secondary Sources

**Airbnb dashboard:** views, conversion rates, badge status (Guest Favorite, Superhost), response time/rate, host-cancellation rate. Not all of this is exposed via PriceLabs and may need manual extraction or scraping.

**Vrbo dashboard:** same metrics, separate platform. Same caveats.

**Choose Chicago / Chicago tourism data:** macro context. Quarterly press releases. Not real-time.

**McCormick Place convention calendar:** event schedule. Public.

**City of Chicago Shared Housing Registry (Open Data Portal):** for compliance verification and active listing counts in submarket.

**Manual operator inputs:** owner-stay calendar, hot tub maintenance windows, planned property improvements, seasonal cost variances.

### 4.3 Data Cadence

| Data Type | Update Frequency | Action Trigger |
|---|---|---|
| New bookings / cancellations | Real-time (webhook) or ≤1hr polling | Immediate pacing recalc |
| Asking rate calendar | Daily | Daily price refresh |
| Pacing vs market | Daily | Weekly review aggregation |
| Comp set rates | Daily | Weekly anchor audit |
| Listing health (badges, conversion) | Weekly | Monthly review |
| Macro tourism / regulatory news | Monthly | Quarterly KB update |

---

## §5. Measurement & Diagnostics

### 5.1 Core KPIs with The Jackpot Baselines

| KPI | Formula | Current Baseline | Target |
|---|---|---:|---:|
| ADR (all-night, blended) | Revenue / Nights | $841 | $1,094+ ($175K) / $1,111+ ($200K) |
| ADR (weekend, blended) | Wknd revenue / wknd nights | $987 (recent rolling) | $1,200+ summer / $700+ winter |
| Occupancy | Booked / Available × 100 | 36% (run-rate) | 44–49% |
| RevPAR | Occupancy × ADR | $303 (run-rate) | $480–$546 |
| Net revenue rate | Gross − OTA fees | ~87.6% of gross (blended) | Same; shift mix toward Vrbo to improve |
| Lead time (avg) | Booking date − arrival date | TBD from PriceLabs | Track distribution shape, not just mean |

### 5.2 Booking Curves and Pacing

The agent tracks pacing — the speed of future inventory consumption — for each forward date and date range.

**Pacing measurement:** For each future date D at lookback time T, compare:
- This year's % booked at T-N days out
- Same-date last-year's % booked at T-N days out (where available)
- Market median % booked at T-N days out (PriceLabs market dashboard)

**Pacing position classifications:**

- **Ahead:** This year > last year AND > market median by ≥10 percentage points
- **On-track:** Within ±10 pp of both benchmarks
- **Behind:** This year < last year AND < market median by ≥10 percentage points

**Limitation note:** The Jackpot has only ~6 months of history. YoY pacing comparisons aren't yet available; the agent should rely more heavily on market median benchmarks until November 2026 when the first YoY comparison becomes possible.

### 5.3 Pickup Velocity

Pickup is the rolling rate of net new bookings.

- **24-hour pickup:** new bookings (net of cancellations) in last 24h
- **7-day pickup:** rolling weekly
- **30-day pickup:** rolling monthly

**Acceleration signals:**
- 24h pickup ≥ 1.5× the trailing 14-day daily average → demand acceleration
- Negative pickup over 7+ days → demand softening or cancellation cluster

### 5.4 Compression Detection (2-of-3 Test)

Compression is detected when at least **two of three** signals fire for the same forward date:

1. **Market forward occupancy** at T-minus-N days exceeds the trailing 3-year mean for that lead-time bucket by ≥1.0 SD (or ≥15 percentage points if 3-year history unavailable)
2. **Comp-set availability** has dropped ≥30% in the prior 7 days
3. **Pickup velocity** ≥1.5× the trailing 14-day baseline

**Chicago calibration:** During known event windows (Lolla, RSNA, Marathon, NYE), tighten thresholds by ~20% — Chicago's event-driven compression is more abrupt than typical markets.

When compression detected: trigger Active Compression Response (raise prices per §7 magnitude function, remove LOS restrictions selectively, eliminate active discounts, monitor pickup hourly).

### 5.5 Diagnostic States

When performance lags, diagnose before adjusting price.

- **Visibility Problem** = Low views + Low bookings → algorithmic ranking issue. Action: improve listing health (badges, response, conversion); review competitive pricing relative to comp set.
- **Value Gap** = High views + Low bookings → conversion issue. Action: photos, amenity highlight, description, reviews. Lowering price doesn't fix this.
- **Discount-Dependent Conversion** = Books only at heavy discount → perceived-value gap at full price. Action: brand investment (photos, listing language, badge pursuit) before normalizing to higher rates.
- **Cancellation Cluster** = Multiple recent cancellations → policy too loose or guest-mismatch (party bookings, group too large for non-target audience). Action: tighten cancellation tier and/or pricing fences.

---

## §6. Forecasting & Demand Modeling

### 6.1 Custom Demand Calendar Structure

Replaces generic high/low season labels with date-specific behavioral classification. Three data layers:

**Layer 1 — Historical:** Multi-year occupancy patterns, historical lead times, achievable ADR ceilings per date. *Limited for The Jackpot until 2027 (need full year of YoY).*

**Layer 2 — Pacing:** Real-time forward inventory consumption vs. market and YoY (where available).

**Layer 3 — External Signals:** Event calendar (§3.3), school calendars, weather forecasts, Google Trends, airline accessibility shifts.

Each future date carries a tag: 🔥 High-Pace / 📈 Normal / ⚠ Slow.

### 6.2 Forward Demand Formula

Predicted final occupancy for a future date:

```
forecasted_final_occupancy = current_occupancy + 
  historical_fill_rate_remaining × (1 − current_occupancy)

where:
  historical_fill_rate_remaining = average % of remaining inventory 
    that historically books between this lead time and check-in,
    derived from PriceLabs market data and (when available) 
    own historical data
```

This corrects the source-doc error from the original course material. The "additional fill" is *of remaining inventory*, not absolute percentage points.

**Example:** If current occupancy at T-minus-60 is 51%, and historical fill rate remaining at this lead time is 45%, then forecast = 51% + 45% × (1 − 0.51) = 51% + 22.05% = ~73%.

### 6.3 Lead-Time Regimes

The agent treats lead time as a continuous variable with named regimes:

- **Close-In:** 0–14 days
- **Active-Demand:** 15–30 days
- **Planning-Window:** 31–90 days
- **Far-Out:** 91+ days

Each regime carries different pricing power, different magnitude tolerances, and different cancellation expectations.

### 6.4 Compression Detection — Detail

The 2-of-3 test (§5.4) operationalizes compression. Three additional notes:

- **False-positive cost is asymmetric.** A false positive (compression detected when it isn't) leads to over-pricing and lost bookings. A false negative leads to under-pricing during real compression. For The Jackpot's positioning (scarcity tier with strong recovery from missed dates via summer compression), false negatives are more costly than false positives — bias the test toward sensitivity.
- **Compression is not always citywide.** A specific neighborhood or capacity tier can compress while the macro market is normal. The agent should run the test for the relevant comp set, not just the city aggregate.
- **Pre-Compression Hold ≠ Active Compression Response.** When the forecast indicates compression coming but pacing is still normal, hold price (don't drop in a slow week — the date is expected to fill). When pacing actively accelerates beyond forecast, raise.

### 6.5 Event-Driven Demand

Each event in §3.3 is encoded with three properties:

- **Magnitude:** EXTREME / HIGH / MEDIUM / LEISURE-SUSTAINING
- **Reach:** Citywide / Downtown-only / North Side / Specific neighborhood
- **Timing:** Date range, peak nights, lead time of demand pull

The agent applies event multipliers proactively, starting at the typical compression-formation lead time for that event class:

- **EXTREME events:** apply multiplier starting 90+ days out
- **HIGH events:** 60+ days out
- **MEDIUM events:** 30+ days out
- **Recurring weekly drivers (Cubs/Northwestern):** 14–21 days out, lighter multiplier

### 6.6 Seasonality Model — The Jackpot

Data-anchored to the realized ADR pattern (§2.4):

| Season | Months | Demand Profile | Floor Logic | Ceiling Logic |
|---|---|---|---|---|
| Peak | Jun – Aug | Extreme summer demand + event drivers | Hold high floor; weekday floor matches winter weekend floor | Allow event multipliers up to 2.5–3.0× |
| High Shoulder | Sept – Oct | Conference cycles, Marathon, IMTS in even years | Mid-tier floor; protect anchor | Event-aware multipliers, more conservative |
| Late-Year Compression | Late Nov – Jan 2 | RSNA + holidays + NYE | Keep floor up through NYE | Event multipliers for RSNA + NYE |
| Low (Winter) | Jan – early Mar | Cold, post-holiday lull | Lowest floor of year, but ≥ variable cost | Conservative; don't expect pricing power |
| Spring Shoulder | Mar – May | Improving weather, conference ramp | Mid-tier floor | Modest growth potential |

---

## §7. Decision Logic

### 7.1 The Master Decision Graph

For any future date, the agent walks this graph daily:

```
1. INGEST current state
   → Today's pacing position (Ahead / On-Track / Behind)
   → Days to arrival (regime)
   → Current occupancy
   → Compression signals firing (count 0–3)
   → Active events on or near date
   → Confidence tier (C0–C4)

2. APPLY base layer
   → Determine target occupancy from 75-55-35 framework (§7.2)
   → Compute occupancy gap (target − current)
   → Determine direction (raise / hold / drop)

3. OVERLAY event layer
   → If event date, apply event multiplier (§6.5)
   → Cap at 2.5× generic, 3.0× for Lolla weekend specifically

4. OVERLAY compression layer
   → If 2-of-3 compression test fires, apply compression response
   → Override base direction (always raise during active compression)

5. COMPUTE magnitude (§7.3)
   → adjustment = base_step × signal_multiplier × lead_time_multiplier

6. APPLY anchor bounds (§8.1)
   → Final price within [Min Price, Max Price]
   → If proposed price would breach, clip and flag

7. APPLY confidence gate (§8.5)
   → If C0–C1 and proposed change >15%, route to human review
   → Otherwise, execute via PriceLabs API

8. LOG decision with reasoning chain
   → For audit trail and feedback loop
```

### 7.2 The 75-55-35 Lead-Time Framework

Industry-standard occupancy targets at lead time, with discount/raise direction:

| Days Until Check-In | Occupancy Target | Direction |
|---|---:|---|
| 0–7 days | 75% | Raise if over, drop if under |
| 8–14 days | 55% | Raise if over, drop if under |
| 15–30 days | 35% | Mild raise/drop based on gap |
| 30+ days | 0–10% | Hold or small adjustments |

**Decision logic:**

```
gap = target_occupancy − current_occupancy

if gap > 30%:        action = drop 10–15% (significantly under target)
elif gap > 15%:      action = drop 5–10%
elif gap ∈ [-10%, 15%]:  action = hold
elif gap > -25%:     action = raise 5–10%
else:                action = raise 10–15% (significantly over target)
```

### 7.3 Magnitude Function

The amount of any price change is a composite function:

```
adjustment_percent = base_step × signal_multiplier × lead_time_multiplier

base_step = 10%

signal_multiplier:
  1.0  if 1 demand signal firing
  1.3  if 2 firing
  1.5  if 3 firing (compression)

lead_time_multiplier:
  0.7  if T-minus > 30 days (Far-Out / Planning-Window)
  1.0  if T-minus 14–30 days (Active-Demand)
  1.3  if T-minus < 14 days (Close-In)
```

Resulting operating band: **7% (single signal, far out) to 19.5% (full compression, close-in)**. Source-doc 10–15% range remains the typical case.

### 7.4 Strategic Filters (Apply Before Acting)

Every proposed change should pass four quick tests:

1. **Pricing Power:** Do I have leverage (positive pacing delta, scarcity, compression)?
2. **Risk Assessment:** Cost of holding firm vs. cost of moving? Close-in moves carry more risk both ways.
3. **ADR / Occupancy Trade:** Am I willing to swap occupancy for ADR (or vice versa) on this specific date?
4. **Signal vs. Noise:** Is this a sustained trend (≥7 days) or a one-day anomaly?

Any "no" answer routes to hold rather than act.

### 7.5 Strong Demand Branch (Pickup Increasing)

```
IF pickup increasing for date D:
  IF T-minus ≥ 30 days:
    IF occupancy > 50%:
      → raise 10–15% gradually
    ELSE:
      → raise 5–8%, monitor next 7d
  ELSE IF T-minus < 14 days:
    IF below target occupancy (per 75-55-35):
      → raise 5–10%, keep LOS open
    ELSE:
      → raise 10–15%, restrict short stays
  
  IF demand market-wide:
    → event-class response (multiplier + LOS restriction)
  IF demand listing-specific:
    → underpricing audit, raise cautiously
```

### 7.6 Weak Demand Branch (Pickup Flat or Declining)

```
IF pickup flat or declining for date D:
  IF T-minus ≥ 30 days:
    → HOLD (don't drop yet); investigate value perception
  ELSE IF T-minus 15–30 days:
    → minor reduction (3–5%) or targeted promo
  ELSE IF T-minus < 14 days:
    → drop in 5–10% increments until pickup resumes
    → relax LOS to 1–2 nights
    → consider 1-night premium per §8.3

  IF pricing uncompetitive vs comp set:
    → undercut comp set 5–10%
  IF pricing competitive but stagnant:
    → fix value perception (visibility/listing audit), don't drop further
```

---

## §8. Pricing Architecture

### 8.1 Anchor Pricing (Base / Min / Max)

**Base Price** is the positioning anchor. Audited every 3–4 weeks.

For The Jackpot:
- Base price should anchor at the 75th–90th market percentile reflecting upscale 14-guest positioning
- Currently calibrated through PriceLabs' Base Price Helper using realized data; the rapid ramp from $625 to $1,460 weekend ADR over 6 months is the base price drift in action
- Re-audit recommended every 3–4 weeks as more booking data accrues

**Minimum Price** floor protection.

For The Jackpot:
- **Weekday floor:** $400–$500 (above variable cost of $540, accepting that some weekdays will sit empty given the self-fill pattern)
- **Weekend floor:** $625 (winter trough realized) up to $1,200 (summer floor) seasonally
- Floor is *higher* than mathematical break-even because positioning matters: training the algorithm with $300 weekday bookings contaminates weekend rank

**Maximum Price** prevents algorithmic surge errors.

For The Jackpot:
- Max should cap at **2.5× base** for typical events
- **3.0× allowed for Lollapalooza weekend specifically** (highest-magnitude event of year)
- Manual override required to exceed

### 8.2 Channel-Aware Pricing

Pricing should differ by channel based on take rate, audience, and conversion economics.

**Net-equivalent rate parity:**

For a target $X net to host, asking rate by channel:

```
Airbnb:    asking = X / (1 - 0.155)        # 15.5% take rate
Vrbo PMS:  asking = X / (1 - 0.05)         # 5% take rate
Direct:    asking = X / (1 - 0.029)        # ~2.9% payment processing
```

Net-equivalent at Airbnb $1,000 = Vrbo $885 = Direct $850. Each channel can be priced lower than Airbnb gross while matching net.

**Channel-specific adjustments for The Jackpot:**

- **Vrbo summer markdown (URGENT):** Zero forward bookings May–Jul on Vrbo despite strong off-season performance. Test a 6–10% Vrbo markdown for May–Jul dates to recover audience price expectations. If pickup resumes within 14 days, the markdown is calibrated correctly; if not, widen to 10–12%.
- **Airbnb maintain or push:** Audience absorbs current asking band; recent forward bookings ($1,690–$2,173) confirm. Continue base-price ramp through summer.
- **Direct strategy:** Currently dormant. When activated, price at OTA-net parity (i.e., direct asking ~12% below Airbnb asking) and capture the full fee differential as margin. Don't undercut OTAs more than that — risk of OTA rate-parity penalties.

### 8.3 Rate Fences

Non-price differentiators that segment pricing across guest types.

**LOS Restrictions:**

| Date Tier | Default LOS | Notes |
|---|---|---|
| Peak summer weekends | 3-night minimum | Captures full weekend yield |
| Lolla / RSNA / Marathon / NYE | 4-night minimum | Forces full event-window booking |
| Standard weekend | 2-night minimum | Avoids orphan 1-night gaps |
| Weekday peak season | 2-night minimum | Even weekdays — group-quality filter |
| Weekday off-season | 1-night okay | Owner self-fills the gap anyway |
| Close-in (<14 days) | Drop to 1 night | Salvage gap nights |

**1-night premium by lead time:**

| Days Out | Premium |
|---|---:|
| 14+ | +20–30% |
| 7–14 | +10–20% |
| 3–7 | +0–10% |
| 0–3 | No premium (clear at variable cost+) |

**Cancellation Tier Pricing:**

| Tier | Differential | Notes |
|---|---:|---|
| Fully refundable | Base +5–8% | Compensates ~12% net cancel rate |
| Moderate (default) | Base | Anchor |
| Firm | Base −3–7% | Slight discount to offset reduced top-of-funnel |
| Strict | Base −10–15% | Higher yield-protection but Airbnb adds 2% fee penalty |

**The Jackpot recommended default:** Moderate as primary, Firm for peak event dates (Lolla, RSNA, NYE, Marathon weekends). Avoid Super Strict because of the +2% Airbnb fee penalty.

### 8.4 Orphan Night Logic

| T-minus to gap | Default Action |
|---|---|
| >14 days | Hold LOS restriction; wait for longer demand |
| 7–14 days | Allow 2-night with 15–20% premium |
| 3–7 days | Allow 1–2 night with 5–10% premium |
| 0–3 days | Allow 1-night, no premium, ≥ variable cost floor |

**The Jackpot specific:** Owner self-fills weekday gaps, so the orphan-night cost asymmetry is lower than for a generic property — the cost of a Wednesday gap isn't $0, it's the value of you being at the property anyway. Don't aggressively discount weekday orphans; preserve the rate.

### 8.5 Confidence Tier Framework

The agent's autonomy scales with data sufficiency:

| Tier | Inputs Available | Action Authority |
|---|---|---|
| **C0** Cold-Start | No history | Conservative defaults; flag for human review |
| **C1** Comp-Anchored | Comp set known, market median available | Set base price ±10% market median; flag changes >15% |
| **C2** History-Informed | 3+ months own booking history | Apply own patterns; act within ±15% of base autonomously |
| **C3** Pacing-Calibrated | History + pacing benchmarks | Full dynamic pricing within anchors; compression rules active |
| **C4** Elasticity-Mapped | Per-segment elasticity coefficients | Channel-aware and segment-aware pricing; near full autonomy |

**Current state for The Jackpot: C2 (transitioning to C3).** 6 months of history available; pacing benchmarks become more reliable around month 12. Action authority should reflect this — the agent should not yet take price changes >15% without operator review.

---

## §9. The Jackpot Calibration

This section consolidates property-specific overrides and operational specifics. Most are already embedded in earlier sections; collected here for navigation.

### 9.1 Weekday/Weekend Asymmetric Optimization

**Optimization function for The Jackpot is weekend-yield primary, weekday-yield secondary** — driven by owner self-fill of unbooked weekdays.

Implications:
- **Weekday floor stays high** ($400–$500) even when nights sit empty
- **Don't drop weekday prices to fill** — protects weekend rank from low-rate contamination
- **Summer is the exception:** June–August weekday demand expands; the agent should test weekday rates in summer before assuming the off-season pattern holds

### 9.2 Hot Tub Strategy

Hot tub is a year-round revenue lever with seasonal premium:

| Season | Hot Tub Premium |
|---|---:|
| Winter (Nov–Mar) | +$50–$80/night |
| Shoulder | +$30–$60/night |
| Summer | +$20–$40/night |

**Operational priority:** Hot tub uptime is revenue protection, not just amenity hygiene. A weekend with the hot tub down is materially worse than a weekend with a broken oven. Maintenance windows should be scheduled in lowest-demand weekday gaps.

### 9.3 Channel Optimization Plan

Current 70/30 Airbnb/Vrbo. Optimal target probably 55–65% Airbnb / 35–45% Vrbo.

**Vrbo summer fix (immediate action):**
1. Open PriceLabs Vrbo channel customizations
2. Apply −8% channel markdown for May–Aug 2026 dates
3. Monitor pickup velocity 14 days
4. If pickup recovers, hold; if not, widen to −10–12%

**Vrbo listing optimization (separate workstream):**
- Audit Vrbo listing photos, description, amenity highlights
- Verify competitive positioning at Vrbo audience price band
- Check booking conversion rate compared to Airbnb

### 9.4 Lollapalooza 2026 Pricing Plan (Jul 30 – Aug 2)

Highest-magnitude event of the year. Plan now:

- **Apply event multiplier:** 2.5–3.0× base rate for the 4 nights
- **LOS:** 4-night minimum (force full festival window)
- **Cancellation:** Firm tier
- **Lead-time start:** Aggressive pricing should already be live (90+ days out for EXTREME events)
- **Monitor pickup hourly** as the event approaches; further raises authorized if compression accelerates
- **Expected ADR range:** $2,500–$3,500/night at peak. Realized 2025 forward booking at $2,173 in mid-July is the floor, not the ceiling.

### 9.5 Other Priority 2026 Dates

| Date Range | Event | Multiplier | LOS | Notes |
|---|---|---|---|---|
| Jun 25–28 | ALA Annual | 1.3–1.5× | 3-night | Mid-tier conference |
| Jul 30 – Aug 2 | Lollapalooza | 2.5–3.0× | 4-night | EXTREME |
| Aug 3–6 | GBTA | 1.2–1.4× | 3-night | Business audience |
| Sept 14–19 | IMTS | 1.4–1.7× | 3-night | Major trade show |
| Oct 9–10 | Marathon | 1.5–1.8× | 4-night (Thu start) | High overflow |
| Nov 7–9 | AHA | 1.3–1.5× | 3-night | Medical |
| Nov 29 – Dec 3 | RSNA | 2.0–2.5× | 4-night | EXTREME citywide |
| Dec 31 – Jan 2 | NYE | 1.5–2.0× | 3-night | Direct + overflow |

### 9.6 Capacity Tier Strategy

The Jackpot's 14-guest capacity is a thin-supply tier in Chicago. Strategy:

- **Don't price-compete with 8–10 guest properties** on per-night rate; the capacity tier supports a per-guest premium
- **Target the capacity-driven demand pockets:** family reunions, corporate retreats, milestone celebrations, large bachelorette weekends. These are weekend-concentrated, less price-elastic than commodity STR demand.
- **Group bookings have specific friction:** require trust signals (reviews, response speed), accommodate logistics (parking, large kitchen, hot tub). The Jackpot is well-positioned; preserve this advantage.

---

## §10. Operational Cadence

### 10.1 Daily

- Review last-24-hour bookings, cancellations, gaps
- Drop prices for ≤3-day-out openings (variable cost floor)
- Verify hot tub status; flag any maintenance issues
- Check for compression signals on next 60 days
- Monitor any active event windows for hourly updates

### 10.2 Weekly (Monday/Tuesday)

- Pacing review for next 4 weeks vs. market median + (when available) YoY
- Adjust base/min for properties consistently underperforming
- Check Vrbo pickup vs. Airbnb pickup; flag channel-specific issues
- Review listing health metrics (response rate, badges, conversion)

### 10.3 Bi-Weekly

- A/B tests on base price and LOS parameters
- Comp set scan: rate moves, availability drops, LOS changes
- Vrbo summer markdown effectiveness check (until resolved)

### 10.4 Monthly

- Full performance reports (RevPAR, ALOS, Net Revenue, channel mix)
- Listing audit (photos seasonal-appropriate, description fresh)
- Confirm seasonality model still tracks realized data
- Review the previous month's open-questions list

### 10.5 Quarterly

- Seasonal RevPAR retrospective
- YTD progress vs. $200K goal trajectory
- Forecast reset for next quarter
- Comp set re-selection (drop departed properties, add new)

### 10.6 Annual

- YOY growth (once available — first true YoY will land Nov 2026)
- Expense ratio review (variable cost creep, fixed cost adjustments)
- KB update (this document) and threshold review pass
- Strategic reassessment (regulatory landscape, tier positioning, expansion)

---

## §11. Threshold Review (Consolidated T-1 through T-14)

Every numerical threshold the agent uses, with current value, rationale, and override status. This is the single section to update when calibration shifts.

### Generic Thresholds (Phase 2.2)

**T-1: Compression detection thresholds**
- Current: 1.0 SD or 15 pp deviation; 30% comp-set drop in 7 days; 1.5× pickup acceleration
- Override status: PENDING operator review

**T-2: Price adjustment magnitude function**
- Current: base 10%; signal multiplier 1.0/1.3/1.5; lead-time multiplier 0.7/1.0/1.3
- Operating band: 7%–19.5%
- Override status: PENDING operator review

**T-3: Event price multiplier cap**
- Current: 2.5× base for typical events; 3.0× for Lollapalooza weekend
- Override status: PENDING operator review

**T-4: Cancellation rate operational priors (until property data overrides)**
- Flexible: 15–20% cancel rate
- Moderate: 8–12%
- Firm: 5–8%
- Strict: 3–5%
- Override status: ACTIVE — replace with realized data once 12 months of cancellation history accrues

**T-5: Cancellation policy pricing differentials**
- Refundable: +5–8%, Moderate: base, Firm: −3–7%, Strict: −10–15%
- Override status: PENDING operator review

**T-6: Orphan night decision rule**
- Hold LOS >14 days; allow 2-night at +15–20% premium 7–14 days; +5–10% at 3–7 days; clear at variable cost 0–3 days
- The Jackpot adjustment: weekday orphans owner-filled, less aggressive discounting
- Override status: PENDING operator review

**T-7: 1-night premium by lead time**
- 14+ days: +20–30%; 7–14 days: +10–20%; 3–7 days: +0–10%; 0–3: no premium
- Override status: PENDING operator review

**T-8: 75-55-35 framework gap thresholds**
- gap >30%: drop 10–15%; >15%: drop 5–10%; ±10–15%: hold; >−25%: raise 5–10%; else raise 10–15%
- Override status: PENDING operator review

**T-9: Forward demand formula**
- `forecast = current + fill_rate_remaining × (1 − current)`
- Override status: STRUCTURAL — formula correct; numerical inputs from PriceLabs

**T-10: Optimal occupancy target range**
- Current: 55–70% (revised down for upscale 14-guest profile)
- Override status: PENDING operator review

### Property-Specific Thresholds (Phase 2.3)

**T-11: Weekday minimum price floor**
- Current: $400–$500
- Override status: PENDING operator confirmation; summer test recommended

**T-12: Weekend minimum price floor**
- Current: Winter $625, Spring/Fall $700, Summer $1,200 (mapped to realized seasonal data)
- Override status: PENDING operator review

**T-13: Lollapalooza weekend pricing override**
- Current: Allow up to 3.0× base with 4-night minimum
- Override status: PENDING operator review

**T-14: Hot tub maintenance impact**
- Current: Maintenance scheduled in lowest-demand weekday gaps; downtime = revenue protection priority
- Override status: PENDING operator confirmation on realistic downtime frequency

### New from Phase 2.4

**T-15: Vrbo summer channel markdown**
- Current: −8% for May–Aug 2026 dates (initial test value)
- If pickup resumes within 14 days → hold; if not → widen to −10–12%
- Override status: ACTIVE TEST

---

## §12. Open Limitations

What the agent does NOT know and should NOT pretend to know.

### 12.1 Data-Bounded Limitations

- **No YoY comparisons until November 2026.** Pacing analysis relies on market median benchmarks until first full YoY landmark.
- **No statistically validated property-specific elasticity coefficients.** Generic priors used; calibration improves as data accrues.
- **No confidence intervals on forecasts.** Industry pricing tools produce point estimates. The agent should treat all forecasts as central estimates with implicit uncertainty, not as bounded distributions.
- **No empirical cancellation rate data for The Jackpot.** Industry priors used (T-4); replace as actual data accrues.

### 12.2 Methodology Limitations

- **Cold-start for new comparable scenarios.** When demand drivers change (new event, new regulation, new comp), the agent has no precedent and should flag for operator review rather than extrapolate confidently.
- **No portfolio interaction model.** This KB is single-property; doesn't address inter-property pricing if a second STR is acquired.
- **Compliance decisions are out of scope.** The agent flags risk patterns (party bookings, complaint clusters) but does not interpret regulatory law.

### 12.3 What Requires Human Override

- Any price change >15% if confidence tier ≤ C2
- Any event multiplier >2.5× (except Lolla weekend at 3.0×)
- Any move below variable cost floor
- Any cancellation policy change outside Moderate/Firm
- Any maximum price increase
- Any base price increase >10% in a single audit cycle
- Any decision triggered by a data anomaly (sudden 50%+ comp-set move, multi-day pickup spike >3×)
- All compliance or regulatory questions
- All capital expenditure or amenity decisions

### 12.4 Triggers That Should Always Flag for Operator Review

- Multiple recent host-cancellations (cluster of 3+ in 30 days)
- Booking inquiries with party-style language or red flags
- Search rank drops without obvious cause
- Negative review patterns (clustered themes)
- Hot tub maintenance issues approaching weekend
- Any guest reporting issues that could escalate to neighbor complaints
- Any communication from city / Airbnb compliance / Vrbo trust & safety

---

## §13. Forward Path

### 13.1 Phase 3 — Agent Specification

The KB is the human-readable source of truth. The agent specification will translate decision-relevant content into a machine-readable format optimized for an LLM agent to execute against. Outputs:

- Tool definitions (which API endpoints, which decisions they trigger)
- Decision graph in structured format (if-then logic from §7)
- Threshold table as queryable structure (T-1 through T-15)
- Escalation rules (when to defer to human)
- Action logging schema

### 13.2 Phase 4 — Active Calibration

Once the agent is running (after Phase 3):

- Track agent decisions vs. actual outcomes
- Update thresholds based on realized performance
- Build the learning loop (which forecasts were wrong, which decisions paid off)
- Quarterly KB updates

### 13.3 Phase 5 — Vrbo Optimization Workstream

Separate from main agent work:

- Vrbo listing audit (photos, description, amenity emphasis)
- Vrbo channel-specific pricing test outcomes
- Channel mix re-evaluation against the optimal target

### 13.4 Phase 6 — PriceLabs API Deep Integration

Specification of the full PriceLabs API capability set:

- Reservations endpoint (already in use for ADR report)
- Prices endpoint (read + write — for agent to push price changes)
- Listings endpoint (capacity, status, settings)
- Market data endpoint (comp set context)
- Neighborhood data endpoint (submarket benchmarks)
- Minimum stay endpoint (LOS rules)
- Webhooks (real-time booking notifications)

For each endpoint: which agent decisions consume it, polling cadence, caching strategy, rate limit handling.

### 13.5 Phase 7 — Beyond PriceLabs

If the data layer needs to expand:

- Direct Airbnb API integration (listing health, badges, conversion)
- Direct Vrbo API integration (same)
- Chicago Open Data Portal integration (Active Shared Housing Registrations, comp counts)
- Choose Chicago tourism data feeds (macro context)
- Event calendar integrations (Lolla, McCormick, Cubs, Northwestern schedules — automated update)

### 13.6 Phase 8 — Direct Booking Activation

When/if direct channel becomes meaningful:

- Direct booking site economics modeling
- Repeat-guest funnel
- Email list activation strategy (if/when Lets Batch revisited)
- Wedding-channel re-evaluation (deferred per current operator priority)

---

*End of Master KB v1.0. Audit trail: Phase 1 (audit), Phase 2.1 (specs), Phase 2.2 (generic research), Phase 2.3 (Chicago/property research). Next update: as thresholds get operator review or as new data shifts calibrations.*
