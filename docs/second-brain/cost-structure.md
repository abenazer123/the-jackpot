# The Jackpot — Cost Structure & Operating Baseline

**Property:** The Jackpot (Stravon Group LLC) | **Last updated:** 2026-05-01
**Source:** Master KB §2.2 + operator audit
**Future config target:** `cost_structure.yaml` (per Phase 6 v2 §6.4)

---

## 0. Purpose

This document is the canonical record of every cost, fee, and
financial flow that touches the operation of The Jackpot.

Three things it does:

1. Lists what we **know** today (fixed, variable, observed) with
   current values.
2. Lists what we **need to start tracking** (categories that are
   real costs but currently uncaptured — repairs, capex, annual
   fees, etc.).
3. Names the **non-expense flows** we shouldn't conflate with
   costs — pass-throughs, revenue offsets, taxes collected on
   behalf of others.

When the Second Brain begins quoting margin, break-even,
or cushion-above-cost figures, the numbers come from here. When
operator inputs an actual that diverges from the baseline, that
divergence is the signal. This document is the baseline.

---

## 1. Cost taxonomy

Three top-level buckets. Every dollar that leaves the operation
falls into exactly one.

```
A. Recurring fixed costs        (carry the property; insensitive to occupancy)
   A1. Monthly recurring        (mortgage, utilities, software, etc.)
   A2. Annual recurring         (license fees, insurance renewals, etc.)

B. Variable costs               (proportional to bookings or revenue)
   B1. Per-booking turn costs   (cleaning, laundry, supplies)
   B2. Channel fees              (Airbnb take rate, Vrbo take rate, etc.)
   B3. Payment processing       (direct bookings)

C. Irregular outflows           (real costs but not predictable)
   C1. Repairs                  (plumber, electrician, handyman)
   C2. Capex / replacements     (furniture, appliances, mattress, hot tub)
   C3. Compliance / professional (legal, accounting, license overages)
   C4. Marketing / promo         (paid placement if/when activated)
```

**A separate "shadow" category** that we model but don't actually
spend cash on:

```
D. Reserves & non-cash allocations
   D1. Maintenance reserve      (% of gross revenue set aside for C1+C2)
   D2. Capex amortization       (annual cost of long-lived assets)
   D3. Owner draw                (operator's compensation; not in operational P&L)
   D4. Income tax                (federal + IL state on net income; not operational)
```

D-bucket items are not operational expenses — they're financial
modeling overlays. The Master KB §2.2 explicitly excludes them
from the operational P&L the agent optimizes against. We model
them so net-of-everything math is honest, but we don't include
them in cash-cost-per-night calculations.

---

## 2. A. Recurring fixed costs

### A1. Monthly recurring (current baseline)

These run regardless of bookings.

| Category | Vendor | Current monthly avg | Frequency | Variability | Notes |
|---|---|---:|---|---|---|
| Mortgage (PITI) | Bank | $5,210 | monthly | flat | Includes property tax + insurance escrow |
| Electric | ComEd | $250 | monthly | seasonal | Higher in summer (AC) and winter (heating) |
| Gas | utility | $250 | monthly | **highly seasonal** | Range $100–$500. Winter (Nov–Mar) adds **+$250** to baseline → effective $500/mo winter |
| Hot tub chemicals | supplier | $150 | monthly | steady | Year-round, slight winter uplift |
| Internet | ISP | $90 | monthly | flat | Guest-required; cannot reduce |
| PriceLabs | PriceLabs | $40 | monthly | flat | Pricing engine subscription |
| **Subtotal — A1 baseline** | | **$5,990** | | | |
| Winter gas uplift (Nov–Mar) | utility | +$250 | seasonal | | Effective fixed ~**$6,240** Nov–Mar |

**Annualized fixed:** $5,990 × 12 + $250 × 5 (winter months) = **$73,130/year**

**Currently unaccounted in fixed (should be added):**

| Category | Estimated monthly | Frequency | Notes |
|---|---:|---|---|
| Domain renewal (`thejackpotchi.com`) | ~$1.25 | annual ~$15 | One-time annual; amortized monthly |
| Vercel hosting | TBD | monthly | Hobby tier likely $0; Pro $20/mo if needed |
| Supabase | TBD | monthly | Free tier likely $0; Pro $25/mo |
| Resend (email) | TBD | monthly | Free tier likely $0 |
| Domain email forwarding | TBD | monthly | If using Google Workspace, ~$6/user |
| Phone (business line) | TBD | monthly | If separate from personal |

**Action for operator:** confirm which of the above are active
costs and at what tier; add to A1 baseline.

### A2. Annual recurring (currently uncaptured)

Real costs that hit once a year — should be amortized into
monthly tracking so they don't surprise.

| Category | Estimated annual | Notes |
|---|---:|---|
| Chicago STR license fee | TBD | Two categories: Shared Housing Unit (primary residence ≥245 days) or Vacation Rental (non-primary; higher fee). Confirm category and renewal date. |
| Chicago/IL business filings | TBD | Annual report fee for Stravon Group LLC (~$75 IL annual report) |
| General liability insurance | TBD | If separate from mortgage escrow; otherwise inside A1 mortgage line |
| Umbrella liability policy | TBD | Optional but recommended for STR exposure |
| Accounting / tax prep | TBD | Year-end CPA fee; varies by complexity |
| Legal review (compliance) | TBD | One-off retainer or per-incident |

**Action for operator:** identify which of these apply, quote
each, divide by 12 for monthly amortization view.

---

## 3. B. Variable costs

### B1. Per-booking turn costs (current baseline)

| Category | Vendor | Per-booking | Variability | Notes |
|---|---|---:|---|---|
| Cleaning | cleaner | $350 | flat per turn | Standard turnover |
| Laundry | laundry service | $150 | flat per turn | Linens + towels |
| Welcome gifts / supplies | various | $40 | flat per turn | Restocking consumables |
| **Subtotal — B1** | | **$540** | | per turn |

**Implication:** at 84 bookings/year (current trajectory),
B1 = $45,360/year.

**Currently unaccounted variable (should be added):**

| Category | Estimated per-booking | Notes |
|---|---:|---|
| Linen depreciation / replacement | $5–10 | Sheets, towels wear out; amortize replacement |
| Hot tub minor consumables | $5–10 | Above the $150/mo chemicals — filter changes etc. that accelerate with use |
| Trash / recycling overage | TBD | If utility charges over-fill |
| Restock items (toilet paper, paper towels, soap, etc.) | TBD | May currently roll into the $40 supplies line |

### B2. Channel fees (deducted from gross — already tracked via reservations)

These show up *inside* the booking record as the gap between
what the guest pays and what we receive. Currently captured via
PriceLabs `reservation_data` (`total_cost` vs. `rental_revenue`).

| Channel | Take rate | Notes |
|---|---:|---|
| Airbnb (Moderate cancel) | 15.5% | Default tier |
| Airbnb (Super Strict cancel) | 17.5% | +2% penalty; we avoid this tier per KB §8.3 |
| Vrbo (PMS-connected) | 5% | Lower take; channel mix lever |
| Vrbo (pay-per-booking) | 5% + 3% processing = ~8% | Used when not PMS-connected |
| Direct (when activated) | ~2.9% | Stripe/payment processor only |

**Important:** these are NOT in monthly fixed costs. They're
realized at the booking level. The Second Brain computes
realized net-of-fee revenue from `(rental_revenue − cleaning_fees) × (1 − channel_take_rate)`.

### B3. Payment processing

For direct bookings (Phase 8 — not yet active):
- Stripe / equivalent: ~2.9% + $0.30 per transaction
- Already encoded in `pricing_config.airbnb_fee_bps` etc. for the
  net-equivalent rate-parity logic in KB §8.2

---

## 4. C. Irregular outflows (currently uncaptured)

These are real cash costs but unpredictable in timing and amount.
The right way to track is per-incident with a category tag.

### C1. Repairs

Things that break and need fixing immediately.

| Category | Notes |
|---|---|
| Plumbing | Clogs, leaks, fixture failures |
| Electrical | Outlets, switches, breaker issues |
| HVAC | Filter changes, service calls, system repair |
| Appliances | Dishwasher, washer/dryer, fridge, oven |
| Hot tub repairs | Above chemicals; pump, heater, jets |
| Pest control | One-off treatments |
| Snow removal | Chicago winter — likely needed Nov–Mar |
| Lawn / landscaping | Mowing, leaf clearing, gutter cleaning |
| Window / carpet cleaning | Deep cleans beyond turn cleaning |

**Tracking recommendation:** dated entries with vendor,
description, amount, and tagged category. No pre-estimate; track
actuals.

### C2. Capex / replacements

Long-lived purchases that should arguably be amortized rather
than expensed in the month they happen.

| Category | Typical lifespan | Notes |
|---|---|---|
| Furniture (sofas, beds, dining) | 5–10 years | Largest capex category |
| Mattresses | 5 years | 5-bed home → ~1 mattress/year if rotated |
| TVs / electronics | 5 years | Theater room is heavy use |
| Hot tub itself | 10–15 years | Major capex when replaced |
| Appliances | 8–12 years | Stagger replacements |
| Linens (full set replacement) | 2–3 years | Towels, sheets, comforters |
| Outdoor (fire pit, patio furniture) | 5–7 years | Weather exposure shortens |
| Game room equipment | 5–10 years | Pool table, arcade, etc. |
| Kitchen equipment | 5–10 years | Cookware, dishes, glassware |

**Tracking recommendation:** dated entries with item,
purchase price, expected lifespan, and a derived monthly
amortization. The Second Brain can use the amortization for
"true cost per night" analysis.

### C3. Compliance / professional services

| Category | Frequency | Notes |
|---|---|---|
| Legal review (compliance) | As needed | Napolitano ordinance, license renewal, complaints |
| Accounting / tax prep | Annual | LLC pass-through filings |
| LLC annual report | Annual | IL ~$75 |
| License renewal fees | Annual | Chicago STR registration |
| City of Chicago violations / fines | Hopefully zero | $2,500–$10,000/offense per KB §3.2 |

### C4. Marketing / promo (currently zero)

Not yet activated, but worth tracking the category from day one
so the spend impact on margin is visible when it begins.

| Category | Notes |
|---|---|
| Paid Airbnb promotion | Sponsored listing slots |
| Direct booking marketing | Google Ads, Instagram, etc. (Phase 8) |
| Lets Batch (or similar planner platforms) | Bachelorette/wedding lead gen |
| Photography (re-shoot) | Periodic content refresh |
| Listing optimization tools | If subscribed |

---

## 5. D. Reserves & non-cash allocations (modeled, not spent)

### D1. Maintenance reserve

Industry-standard for STRs: **5–10% of gross revenue** set aside
for C1 (repairs) and C2 (capex). Not actually transferred to a
separate account in most cases — modeled as a deduction from
gross to compute "true" cash margin.

**The Jackpot @ $200K stretch goal:** $10K–$20K/year reserve
allocation. The KB §2.5 net figures don't include this; they
say so explicitly.

### D2. Capex amortization

Sum of annualized cost across all C2 items. If total furniture
replacement cost is $40K with 8-year average life, that's
$5K/year ($420/mo) allocated even when no purchase happens that
month.

### D3. Owner draw

Operator's compensation. Sits outside the operational P&L. Net
revenue after costs (but before reserve, capex amortization, and
income tax) is the cushion the owner can draw from.

### D4. Income tax

Federal + Illinois pass-through tax on net income flows to
Stravon Group LLC's tax return, not the operational P&L.
Roughly 30–40% of net income depending on deductions and
operator's other income.

---

## 6. Non-expense flows worth being explicit about

### 6.1 Pass-through revenue

| Item | Direction | Net to operation |
|---|---|---|
| Cleaning fees collected from guest | Revenue | Should approximately offset B1 cleaning ($350); track actuals |
| Hot tub damage charges ($250 to guest when unscheduled drain/clean is needed) | Revenue offset | Pass-through; offsets the chemical/labor cost of the unscheduled clean |
| Hotel taxes collected from guest | Revenue (pass-through) | Remitted to Chicago / IL; not operator income |

**Rule:** these flow through `total_cost` on the reservation but
should not be counted as net revenue OR as expenses. They cancel
on both sides.

### 6.2 Revenue offsets

| Item | Effect |
|---|---|
| Refunds to guests | Reduces realized revenue |
| Discounts (PriceLabs LOS, weekly, monthly) | Already baked into asking rate; no separate accounting |
| Cancellation refunds | Per cancellation policy; impact varies |
| Chargebacks | Rare but possible; payment processor takes back funds |

### 6.3 Taxes

Chicago tax stack (per KB §3.2):
- Chicago Hotel Accommodations Tax: **6%**
- Vacation Rental and Shared Housing Surcharge: **4%**
- Illinois Hotel Operators' Occupation Tax (effective Jul 1, 2025): **6%**
- Combined effective rate per the system config: **17.37%**

Since Jan 6, 2026, marketplaces (Airbnb, Vrbo) collect IL lodging
tax automatically. Direct bookings (Phase 8) require manual
collection + remittance. This is a **compliance task**, not an
operational expense.

---

## 7. Tracking cadence (recommended)

| Category | Cadence | Mechanism |
|---|---|---|
| A1 monthly fixed | Monthly | Auto-pay confirmation; capture actuals against baseline |
| A2 annual fixed | Annual at renewal | Pre-scheduled reminder; capture and amortize |
| B1 per-booking | Per booking | Tag by `reservation_id` so cost-per-night is exact |
| B2 channel fees | Per booking | Auto-derive from `total_cost − rental_revenue` in PriceLabs reservation data |
| C1 repairs | Per incident | Dated entry with category, vendor, amount |
| C2 capex | Per purchase | Dated entry + lifespan; system derives monthly amortization |
| C3 compliance | Per incident or annual | Dated entry |
| C4 marketing | Per spend | Dated entry; track ROI when attributable to bookings |

---

## 8. Eventual data model (Phase 6.1 / 6.4 alignment)

When the expense tracker becomes a real data layer (Supabase
table + UI), the structure should be:

```sql
-- Static category definitions (the baseline values from this doc)
CREATE TABLE expense_categories (
  category_id TEXT PRIMARY KEY,        -- 'mortgage', 'electric', 'cleaning_per_turn', etc.
  bucket TEXT NOT NULL,                -- 'A1' | 'A2' | 'B1' | 'B2' | 'B3' | 'C1' | 'C2' | 'C3' | 'C4' | 'D1' | 'D2'
  display_name TEXT NOT NULL,
  vendor TEXT,
  baseline_amount_cents INT,           -- canonical baseline for variance detection
  frequency TEXT,                      -- 'monthly' | 'annual' | 'per_booking' | 'per_incident'
  seasonality_notes TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE
);

-- Actual entries (what we paid, when)
CREATE TABLE expense_entries (
  entry_id BIGSERIAL PRIMARY KEY,
  category_id TEXT REFERENCES expense_categories(category_id),
  entry_date DATE NOT NULL,            -- date money left the account
  period_month DATE,                   -- for monthly recurring; YYYY-MM-01
  amount_cents INT NOT NULL,
  vendor TEXT,
  description TEXT,
  reservation_id TEXT,                 -- for B1 per-booking entries
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Capex with amortization
CREATE TABLE capex_items (
  item_id BIGSERIAL PRIMARY KEY,
  purchase_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount_cents INT NOT NULL,
  lifespan_months INT NOT NULL,        -- e.g. 60 for 5-year furniture
  category TEXT,                       -- 'furniture' | 'appliance' | 'mattress' | 'electronics' | 'hot_tub' | etc.
  monthly_amortization_cents INT GENERATED ALWAYS AS (amount_cents / lifespan_months) STORED,
  notes TEXT
);
```

This isn't being built today — but the doc above is the blueprint
for it. When Phase 6.4 (decision capture) ships, expense entries
become another tracked surface.

---

## 9. Open questions for operator

Before this baseline gets locked in, please confirm/fill:

1. **A1 software lines** — Vercel, Supabase, Resend, domain
   email, business phone — which are active and at what cost?
2. **A2 annual fixed** — Chicago STR license category and
   annual fee? LLC annual report cost? Insurance separate from
   mortgage escrow? CPA fee for tax prep?
3. **B1 supplies breakdown** — does the $40/turn welcome gifts
   line cover all consumables (toilet paper, paper towels, soap,
   coffee, etc.) or are some restocked separately?
4. **B1 linen amortization** — when did you last fully replace
   linens, and what was the spend? (Lets us back into a
   per-booking allocation.)
5. **C1 historical repairs** — any major repair spend in the
   first 6 months of operation? (Establishes the typical
   frequency/amount for the reserve calculation.)
6. **C2 capex inventory** — what's the original purchase cost of
   the major furniture/appliances? Can be rough; helps build the
   amortization picture.
7. **D1 reserve preference** — do you want the Second Brain to
   model 5%, 7.5%, or 10% maintenance reserve when computing
   "true" margin?
8. **Owner usage cost** — when you self-fill weekday gaps, is
   there an opportunity cost (foregone weekday revenue) we
   should model, or treat as zero-cost personal use?

---

## 10. What's next

**Today:** this document is the baseline. Operator review +
fill the gaps in §9.

**Phase 6.1 (data plumbing):** materialize the schema in §8 in
Supabase. Seed `expense_categories` from this document. Wire
B2 (channel fees) to derive automatically from
`reservation_data`.

**Phase 6.4 (decision tracking):** add expense entry as a chat
intent ("logged $180 for HVAC service today, vendor was X") so
operator can capture C1/C2/C3 as they happen.

**Phase 6.8 (dashboard):** monthly P&L view with actual vs.
baseline variance, capex amortization, and reserve allocation
overlays.
