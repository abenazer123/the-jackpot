# The Jackpot — Pricing Strategy

Reference document for The Jackpot's dynamic pricing approach. Captures the
peer set, calibration data, recommended tier card, and event overrides.

Source of findings: analysis session 2026-04-21 using PriceLabs Customer
API + live Airbnb peer probes.

---

## 1. Property profile

| | |
|---|---|
| Listing | The Jackpot \| Hot Tub · Cinema · Bar · Sleeps 14 |
| Location | NW Chicago, Portage Park area (lat 41.963, lng −87.7264) |
| Capacity | 14 guests, 5 bedrooms, 6 beds, 2 baths |
| Amenities | Hot tub, theater/cinema, game room, fire pit, bar, sun room, garage |
| Hosting started | November 2025 (~5 months of data as of April 2026) |
| Channels | Airbnb (primary), VRBO, Booking.com, direct via thejackpotchi.com |
| Dynamic pricing engine | PriceLabs (listing id `1517776645045787467` on Airbnb) |

---

## 2. Net-floor math ($900 minimum acceptable net per stay)

The Jackpot's operational floor: Abe won't accept a booking that nets less
than $900 after all costs.

For a **2-night stay** on direct booking (no platform fee):

| Line | Amount |
|---|---|
| Gross rent (nightly × 2) | variable |
| + Cleaning fee charged to guest | $350–$375 |
| − Cleaning cost Abe pays | $350 |
| − Stripe/processing ~2.9% on total collected | |
| − Chicago STR tax (pass-through, not Abe's money) | 17.37% of (rent+cleaning) |
| = **Net to Abe** | must be ≥ $900 |

Solving for minimum gross rent: **~$810 for a 2-night stay ≈ $405/night.**
Current PriceLabs recommendations are well above this floor on every date
we've checked, so the floor is non-binding in practice. Only matters for
last-minute shoulder-season fill decisions.

**`pricing_config.min_nightly_cents` (currently 40000 = $400) should stay
where it is.** Don't go lower.

---

## 3. True peer set (8 confirmed, use these in PriceLabs Neighborhood)

After evaluating 18 candidate listings, these 8 are the real peer set —
same tier of property (luxury, amenity-rich, 12+ guest capacity,
design-forward, pro operators).

| # | Listing | Guests / BR / Beds / BA | Neighborhood | Why it's a peer |
|---|---|---|---|---|
| 1 | [ALOHA Tropical Penthouse](https://www.airbnb.com/rooms/19412268) | 14 / 4 / 7 / 2 | Wicker Park | Designer, Time Out Chicago feature, @bangtel brand, 212 reviews 4.9, soaking tub + jetted tub + rain shower |
| 2 | [Grand Kimball Lodge](https://www.airbnb.com/rooms/40780053) | 21 / 6 / 14 / 4 | Logan Square | Architectural Digest "21 Best Chicago Airbnbs", sauna, Top 10% of homes, 7-year Superhost |
| 3 | [Jacuzzi\|Movie Theater\|Arcade\|Gym](https://www.airbnb.com/rooms/1513381821115490541) | 16+ / 5 / 8 / 3 | **Portage Park (your neighborhood)** | Hot tub + theater + arcade + gym + game room, remodeled luxury, same location tier |
| 4 | [Lovely 6Bd w/ Game Room & Bar](https://www.airbnb.com/rooms/982799645715267248) | 16+ / 6 / 9 / 3 | Chicago | Game room (3 tables + popcorn) + built-in bar + cocktail lounge, CBS Staycation Series feature, 80 reviews 4.98 |
| 5 | [United Center Compound](https://www.airbnb.com/rooms/1212272687383953405) | 16+ / 4 / 8 / 3.5 | Near United Center | Hot tub + sauna + rooftop + city skyline view, mid-century design, TheDreamRentals (pro operator), 84 reviews 4.88 |
| 6 | [Belmont Pleasures](https://www.airbnb.com/rooms/940563795661048271) | 12 / 3 / 8 / 2.5 | Belmont area | Private hot tub + arcade gaming room, 166 reviews 4.92 |
| 7 | [Neon Dream in River West](https://www.airbnb.com/rooms/871556379122079264) | 16+ / 4 / 8 / 2.5 | River West | Design-forward (neon fireplace, pool table), **Top 5% of homes**, 106 reviews 5.0, 8-year Superhost |
| 8 | [Walk to Cubs Games, Game Rooms](https://www.airbnb.com/rooms/1293872018692874793) | 16+ / 6 / 8 / 3 | Wrigleyville | "Disco Cowboy" brand, game rooms (air hockey, ping pong), designer bathroom, 9-year Superhost |

**Marginals to consider** (not strong peers but closer than the rejects):
- [5BR/3BA/3TVs/parking for 13 people](https://www.airbnb.com/rooms/1095813018290305771) — 13g, NW Chicago, but no luxury amenity stack
- [Lux Chicago SFH 6 Br](https://www.airbnb.com/rooms/1614358428426534287) — 14g, designer kitchen, only 3 reviews (new)

---

## 4. Rejected comps (from original PriceLabs selection)

Remove these 8 — they were dragging the percentile curve downward and
making PriceLabs recommend prices ~30-60% below what the real luxury
market is charging.

| Listing | Reason |
|---|---|
| [NorthSide Chicago duplex](https://www.airbnb.com/rooms/695652663607624015) | 12g apartment/duplex, kitchen/wifi/parking only — basic rental |
| [Cozy Irving Park 5BR](https://www.airbnb.com/rooms/847393611138706973) | 10g family home, basic amenity list despite "luxury" in copy |
| [Sunny & Spacious 5Bd "Kid Friendly"](https://www.airbnb.com/rooms/717735802037241047) | 11g, family/kid-friendly framing, no amenity stack |
| [Gorgeous 5BR Logan Square](https://www.airbnb.com/rooms/45329300) | 10g, only 5 beds, different neighborhood + tier |
| [Spacious 5-BR next to transit](https://www.airbnb.com/rooms/13493868) | Logan Square apartment, 11g, 2 baths, basic |
| [5BR Home Logan Square Sleeps 10](https://www.airbnb.com/rooms/1497218893494367671) | 10g, 4 reviews, basic "yard & parking" |
| [Luxury Home Near Wrigley](https://www.airbnb.com/rooms/15216226) | 10g, 14 amenities, no reviews — "luxury" is title-only |
| [Walkers Paradise Logan Square](https://www.airbnb.com/rooms/675337213312155298) | Logan Square apartment, 10g, basic mid-tier |

---

## 5. Peer-hunt pattern (for future comp discovery)

When adding more peers, look for all five signals:

1. **Capacity ≥ 12 guests** (ideally 14+)
2. **At least one distinctive amenity**: hot tub, sauna, theater, game room, pool table, arcade, built-in bar, rooftop
3. **Design-forward**: designer interiors, bold aesthetic, or press feature (Time Out, Architectural Digest, Tribune, CBS)
4. **Professional operator**: Superhost 3+ years OR brand presence (Instagram, multi-property operator, co-host team)
5. **Review strength**: 4.85+ rating with 30+ reviews, OR Top 5%/Guest Favorite badge

All 8 confirmed peers hit at least 4 of 5.

---

## 6. Calibration data — 3 weekends, all 8 peers

Live Airbnb-displayed rates pulled 2026-04-21. Values are per-night unless
noted. "BOOKED" means the listing's calendar showed the date as
unavailable.

### Peak holiday — Fri Jul 3 → Sun Jul 5, 2026 (2 nights)

| Listing | Status | $/night |
|---|---|---|
| ALOHA Tropical | Available (9% discount: $2,689 from $2,951) | **$1,344** |
| Disco Cowboy | 3-night min ($5,205) | **$1,735** |
| **The Jackpot** | Available ($3,934) | **$1,967** |
| Lovely 6Bd w/ Bar | Available ($4,134) | **$2,067** |
| United Center | Available ($4,650) | **$2,325** |
| Grand Kimball | 3-night min ($7,450) | **$2,483** |
| Neon Dream | Available ($5,136) | **$2,568** |
| Portage Park | **BOOKED** | — |
| Belmont Pleasures | **BOOKED** | — |

Available peer median: **~$2,196/night**. Jackpot at $1,967 sits at ~p40.

### Peak event — Fri Jul 31 → Sun Aug 2, 2026 (Lollapalooza, 2 nights)

| Listing | Status | $/night |
|---|---|---|
| Portage Park | 3-night min ($5,153) | **$1,718** |
| **The Jackpot** | 3-night min ($8,498) | **$2,833** |
| Disco Cowboy | 3-night min ($9,154) | **$3,051** |
| Lovely 6Bd w/ Bar | Available ($6,969) | **$3,485** |
| United Center | Available ($10,317) | **$5,159** |
| ALOHA Tropical | **BOOKED** | — |
| Grand Kimball | **BOOKED** | — |
| Belmont Pleasures | **BOOKED** | — |
| Neon Dream | **BOOKED** | — |

Available peer median: **~$3,268/night**. Jackpot at $2,833 sits at ~p35.
**4 of 8 peers are already booked ~3 months ahead of Lolla.**

### Shoulder — Fri Sep 18 → Sun Sep 20, 2026 (non-event fall, 2 nights)

| Listing | $/night |
|---|---|
| Belmont Pleasures | $799 (outlier low) |
| Wrigleyville Art Deco Duplex | $1,280 |
| Chic Lincoln Park Townhome | $1,473 |
| ALOHA Tropical | $1,944 |
| ALOHA 2.0 | $2,057 |
| **The Jackpot** (3N: $6,570) | **$2,190** |
| Neon Dream | $2,214 |

Available peer median (excluding Belmont outlier): **~$1,945**. Jackpot at $2,190 sits at **~p55** — slightly above peer median. Note Sep 18–20 isn't a true soft shoulder (wedding season + pre-Marathon); a genuine November shoulder probe is still pending.

---

## 7. The key finding — event premium inversion

Comparing Jackpot's own prices across the three weekends:

| Weekend type | Jackpot $/night | vs Jackpot shoulder |
|---|---|---|
| Shoulder (Sep 18–20) | $2,190 | baseline |
| **Peak holiday (Jul 4)** | **$1,967** | **−10% (inverted)** |
| Peak event (Lolla) | $2,833 | +29% |

**The Jackpot is currently pricing July 4 weekend BELOW a random
shoulder weekend.** Peers' Lolla-over-July 4 multipliers are +69% to
+122%. Jackpot's is +44%. The algorithm is under-applying event
premiums across the board, and July 4 specifically is broken (priced
lower than shoulder).

Combined with the 2–4 booked peers on each peak weekend, the evidence
is: **Jackpot has $200–$800/night of headroom on peak weekends** that
it's not capturing.

---

## 8. Recommended tier card

Four tiers mapped to the calibration data:

| Tier | Example dates | Target gross $/night | Rationale |
|---|---|---|---|
| **Shoulder weekday** | Non-event Mon–Thu (Feb, early Nov, mid-week autumn) | $800–$1,200 | Low demand; lean on LOS discounts + weekly rates |
| **Regular weekend** | Non-event Fri/Sat (most of May, June weekdays, random fall) | $1,400–$2,000 | At peer median (~p50) |
| **Peak weekend** | Major holidays (July 4, Memorial Day, Labor Day), Chicago Marathon, major concert nights | $2,500–$3,500 | At peer p60–p75; covers the "good guest" filter |
| **Event / Holiday** | NYE (Dec 30–Jan 2), Lollapalooza, Thanksgiving week | $3,000–$5,000 | Near peer p75–p90; luxury-tier events support this |

All tiers stay well above the $405/night net-floor minimum. Tier jumps
between peak and event capture the "city demand spike" signal that
peers exploit and Jackpot currently misses.

---

## 9. Event calendar — date-specific PriceLabs overrides

**Updated 2026-04-22 after the scheduled re-run cross-check.** All three
proposed overrides from yesterday are now obsolete — PriceLabs lifted
its recommended rates +18-58% across every event date overnight (driven
by Abe raising base/min prices and PriceLabs' nightly ML refresh), and
each event now sits at or above the floor we'd have pinned.

### Before/after table — PL recommended avg $/N (cache)

| Event | 2026-04-21 (before) | 2026-04-22 (now) | Δ% | Demand tag now | **Original plan → Action** |
|---|---|---|---|---|---|
| July 4 weekend (Jul 2-5) | $1,622 (Sat $1,782) | **$2,398 (Sat $2,760)** | **+48%** | Still "Good Demand" ⚠️ | Pin $2,600 → ⚪ **Skip** (PL Sat now $2,760, above target) |
| Lollapalooza (Jul 30-Aug 2) | $2,725 (Sat $2,864) | **$3,376 (Sat $3,410)** | **+24%** | "High Demand" + Sun upgraded "Good"→"High" ✓ | Pin $3,500 → ⚪ **Skip** (PL Sat $3,410, $90 short of $3,500 — within noise) |
| Memorial Day (May 22-25) | $1,577 (Sat $2,013) | **$1,910 (Sat $2,416)** | **+21%** | Fri upgraded "Good"→"High" ✓ | Pin $2,200 → ⚪ **Skip** (PL Sat $2,416, above target) |
| Labor Day (Sep 4-7) | $2,475 (Sat $2,955) | **$2,928 (Sat $3,486)** | +18% | "High Demand" | (already skipping) |
| Chicago Marathon (Oct 9-11) | $2,891 (Sat $3,004) | **$3,412 (Sat $3,540)** | +18% | "High Demand" | (already skipping) |
| Thanksgiving (Nov 25-28) | $2,070 | (booked) | — | — | (sold) |
| NYE (Dec 29 - Jan 2) | $1,289-$1,389 | (booked) | — | — | (sold) |

### What this means

- **All 3 planned overrides (July 4, Lolla, Memorial Day) are no longer
  necessary.** PL is now recommending at or above each one organically.
  Skip them. Pinning floors equal to or below PL's current recommendation
  would have zero benefit and potentially cap the algorithm.
- **2 demand-tag upgrades** auto-corrected: Memorial Day Friday and Lolla
  Sunday both moved from "Good Demand" → "High Demand" overnight.
- **One regression worth flagging**: July 4 Saturday is STILL tagged "Good
  Demand" despite the +55% rate lift. The demand classifier didn't
  upgrade even though the price did. Likely the comp-swap effect we
  hoped for never propagated (see §12 — `Data Source: Nearby Listings`
  unchanged).

### Net change to action items

- Drop all three event overrides from the immediate todo
- Keep monitoring the daily cache via the cron (sync now runs every 4h)
- Revisit Christmas + MLK windows when they enter the 540-day cache
  horizon
- Investigate why the comp swap didn't propagate to neighborhood_data
  (likely a dashboard-side toggle Abe still needs to flip)

### How PriceLabs' demand data is derived (why the cross-check matters)

Every demand-flavored signal from PriceLabs — `demand_desc`, recommended
`price`, `uncustomized_price`, event-aware premiums — is **partially
derived from your neighborhood comp set.** Until the comp swap, that
pool was 350 "Nearby Listings" heavily weighted toward basic 5BRs that
don't exhibit the same demand curves as 14-guest luxury amenity
properties. City-wide event detection (NYE, Lolla) is more robust

### How PriceLabs' demand data is derived (why the cross-check matters)

Every demand-flavored signal from PriceLabs — `demand_desc`, recommended
`price`, `uncustomized_price`, event-aware premiums — is **partially
derived from your neighborhood comp set.** Until the comp swap, that
pool was 350 "Nearby Listings" heavily weighted toward basic 5BRs that
don't exhibit the same demand curves as 14-guest luxury amenity
properties. City-wide event detection (NYE, Lolla) is more robust
because it's driven by aggregate booking pace across Chicago — but the
*magnitude* of the rate response is still modulated by what comp-set
listings charge.

**After the new comp set propagates (24–48h), expect two shifts:**
1. **`demand_desc` for July 4 may upgrade** from "Good" → "High" as
   the new peers reflect true luxury demand behavior.
2. **Recommended `price` should lift 15–30% on peak dates** because
   neighborhood percentiles will shift upward.

That's why we must re-run this cross-check in §12. If July 4's
recommended rate jumps to $2,300+/night on its own, the $2,600
override becomes less critical. If it stays flat, the override is
doing real work.

---

## 10. Minimum-stay strategy

- **Default**: 2-night minimum year-round (matches current setup).
- **Event weekends**: 3-night minimum (every peer that sold out for Lolla
  had a 3-night min). This does two things:
  1. Raises revenue per booking on high-demand dates.
  2. Filters out single-night "party only" groups — which is exactly
     the risk profile you want to avoid at a 14-guest luxury property.
- **Weekly / monthly discounts**: keep PriceLabs' LOS-pricing tier at
  the default. Current config shows `los_pricing: null` in the API — no
  tiers set. That's fine for v1; revisit after 6 months of booking
  data to see if 7+ night stays are common enough to warrant a discount.

---

## 11. Guest-quality-via-price principle

Industry data (Airbnb incident reports, Vrbo operator surveys) supports
a correlation between nightly rate tier and guest-behavior risk. For a
14-guest Chicago property — which reads as "potential party house" to
an algorithm — pricing is the first-line filter for guest quality.

**Target positioning: p60–p75 of true peer set.**
- Below p50 = you attract the budget cohort, higher incident risk.
- Above p90 = vacancy risk, especially in shoulder.
- p60–p75 = "can comfortably afford this, so probably respects it."

The 3-weekend data shows Jackpot currently sitting at ~p40 on peak
weekends. The event-override changes in §9 move you into p60–p75.

---

## 12. Scheduled re-run — completed 2026-04-22

The 24h re-run executed on 2026-04-22. Findings:

**Recommended-rate lift across every event date (+18% to +58%).** Driven
by Abe raising base/min in PriceLabs + PriceLabs' overnight ML refresh.
Full before/after table is in §9 above. Net effect: **all 3 originally
planned overrides are now obsolete** because PL is recommending at or
above each one organically.

**Demand classifier upgrades (partial):**
- ✓ Memorial Day Friday: "Good Demand" → "High Demand"
- ✓ Lolla Sunday: "Good Demand" → "High Demand"
- ⚠️ **July 4 Saturday is STILL "Good Demand"** despite the +55% rate
  lift — the demand classifier didn't auto-correct the way the rate did

**`neighborhood_data` source flag unchanged**: still reads `"Nearby
Listings"` after the comp swap. Same 59 Cat-5 listings in the pool.
Percentiles barely moved (+0-3%). Conclusion: the comp swap did NOT
propagate as a data-source change — Abe likely added favorites without
flipping the data-source mode toggle. This is a Neighborhood tab
setting (not in the API surface) that needs to be set to "Use my
selected listings" — see §15 for the follow-up.

**Summary Base Price p50 (Cat 5)**: $594 → $600 (+1%). Expected shift
to ~$1,500+ did not happen — confirms the comp set isn't actually
driving neighborhood_data calculations.

---

## 13. Action items (in order)

**Updated 2026-04-22 after the scheduled re-run.** The originally
"immediate" overrides are now superseded — PriceLabs lifted recommended
rates organically. Refocused list:

**Immediate:**

1. **Fix the comp-set data source in PriceLabs**: in the Neighborhood
   tab, switch the data-source mode from "Nearby Listings" to "Use my
   selected listings" (or equivalent). The favorites you set on
   2026-04-21 are stored but aren't actually feeding `neighborhood_data`
   — that's why the source flag never flipped. Once flipped, the next
   neighborhood_data refresh should reflect the 8 real peers (expected
   p50 jump from $600 to $1,500+).
2. **Update `pricing_config.cleaning_fee_cents`** in Supabase from 47500
   (placeholder) to the actual charged amount. Tell me $350 or $375 and
   I'll run: `UPDATE pricing_config SET value_number = 35000, updated_at = now() WHERE key = 'cleaning_fee_cents';`

**Scheduled re-run (after Step 1 above):**

3. **Re-run the §12 cross-check 24h after flipping the data-source
   mode.** This time we expect neighborhood_data percentiles to shift
   meaningfully + the July 4 demand classifier to (hopefully) upgrade
   from "Good Demand" to "High Demand".

**Skipped overrides (PL is now recommending at/above each):**

- ~~Pin July 4 weekend $2,600~~ → PL now $2,760 Sat (above target)
- ~~Pin Lolla $3,500~~ → PL now $3,410 Sat (within $90; noise)
- ~~Pin Memorial Day $2,200~~ → PL now $2,416 Sat (above target)
- Labor Day, Marathon: already above target; no override needed

**Backlog (next session or later):**

7. **Probe a true dead-shoulder weekend** (e.g., Nov 13–15 2026) to confirm Jackpot's shoulder pricing is healthy. Sep 18–20 was likely wedding season, not true soft demand.
8. **Post-mortem on Thanksgiving + NYE bookings**: both sold at ~$2,070 and ~$1,389/N respectively. Tracking these in `reservations` (once that table exists) will help quantify how much revenue was left on the table.

---

## 14. Open questions for next session

- **True shoulder baseline**: confirm Nov 13–15 or similar dead-shoulder
  peer rates to validate that Jackpot's shoulder positioning is right.
- **Booking pace**: once we have 10+ inquiries or bookings in our own
  `reservations` table (via PriceLabs `/reservation_data` endpoint —
  not yet integrated), compare Jackpot's booking-window distribution
  to industry norms.
- **STLY comparisons unavailable until Nov 2026** (one full year of
  hosting). Until then, peer-based benchmarking is the best signal.
- **Event override effectiveness**: 30 days after applying the overrides
  in §9, re-run the 3-weekend probe to see if peak weekends actually
  booked at the higher rates.
- **Dashboard vs ad-hoc workflow**: re-open the pricing cockpit scoping
  discussion (stored in conversation history as the dashboard plan) once
  Abe has lived with the overrides for a few weeks and knows which
  questions he asks most often.
