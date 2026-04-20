# PriceLabs Integration — Pricing Guide Delivery

Implementation plan. Nothing here is built yet. Goal is to make this plan easy to critique before any code lands.

---

## 1. Context

Every guest who submits the booking funnel today receives a confirmation email that says:

> "We got your request. Your personalized pricing guide lands in your inbox within minutes — Abe replies himself."

…and then we send nothing. Abe replies manually when he can. That's the gap. We've advertised itemized pricing "within minutes" (live copy in `BookingFunnelSteps.tsx`: "We'll build you a personal pricing guide — itemized, accurate, within minutes.") and we should deliver on it.

**The source of truth for nightly rates is PriceLabs.** Abe uses PriceLabs to price both Airbnb (listing `1517776645045787467`) and VRBO. He has no PMS. The Jackpot site is direct-booking, so the rate we quote should be the PriceLabs-set rate **without** the Airbnb/VRBO host service fee (3% host, 14.2% guest) and that becomes the "book direct, skip ~$X in platform fees" narrative.

**Success criteria:**
- Every inquiry submission produces a concrete, itemized quote displayed in the guest confirmation email within 30 seconds of submit.
- Host notification email shows the quote on the same glance line as the lead so Abe can reply from his phone without opening a calculator.
- Abe can change cleaning fee, tax rates, min stay, and discount % from Supabase directly (not code deploys).

---

## 2. PriceLabs API — research findings

### 2.1 What's publicly documented

Customer API landing page: https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api. Key facts:

- **Authentication**: API key generated in `Account Settings → API Details`. Sent as an HTTP header (header name not disclosed on the public KB — SwaggerHub / Postman are behind a login wall. Confirm name — likely `X-API-Key`. Store as `PRICELABS_API_KEY`).
- **Cost**: $1/listing/month surcharge for every listing syncing during a billing cycle. For The Jackpot (1 listing) that's $12/yr.
- **Official spec**: SwaggerHub (`app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3`) + Postman collection (`documenter.getpostman.com/view/507656/SVSEurQC`). Both require a login to view raw endpoint details. Abe should open them and paste the exact paths + schemas into a follow-up before we write the client.

### 2.2 Endpoints referenced in public help articles (confirmed to exist, details need verification)

| Endpoint (label) | Likely purpose | What we need from it |
| --- | --- | --- |
| `GET /listings` | List all listings under the account | Confirm the numeric PriceLabs listing id for The Jackpot (distinct from the Airbnb 1517…467 listing id). One-time lookup, store as env/config. |
| `GET /listing_prices` (a.k.a. "prices for listings" in the Postman collection — path `rup0ha0`) | Return daily recommended prices for one or more listings over a date range | **Primary endpoint.** Daily rate per date, likely includes min-stay per date and potentially "last_price_updated_at" fields. |
| `GET /reservations` | Read reservations ingested by PriceLabs | Not needed for the quote, but potentially useful for blocking booked dates on the calendar later. Out of scope. |
| `POST/PUT /overrides` (referenced in Make.com integration blurbs) | Push price overrides | Not needed — we read, we don't write. |
| `GET /neighborhood_data` | Market comps / STR analytics | Not needed for the pricing guide. |
| Revenue Estimator API (separate product, `hello.pricelabs.co/revenue-estimator-api-widget/`) | Free-standing property projection tool | Not applicable — we already have the listing. |

### 2.3 Length-of-stay (LOS) pricing — how PriceLabs models it

From `help.pricelabs.co/portal/en/kb/articles/length-of-stay-pricing`:

- LOS pricing is a **tiered percentage adjustment** on nightly rate. Example in their docs: "7+ nights = 10% off, 14+ nights = 15% off".
- Rule: adjustments use "greater than or equal to" logic and are applied **after all other customizations**.
- PriceLabs does NOT return LOS-adjusted prices to every partner PMS (explicitly noted that OwnerRez doesn't receive them). **Open question: does the Customer API's `GET /listing_prices` include LOS tiers, or only the base nightly rate?** If base-only, we replicate LOS math ourselves using the tiers Abe has configured in PriceLabs (manual mirror in our `discounts` table).

### 2.4 Rate limits

**Not publicly documented.** Public KB + blog launch post don't state numbers. PriceLabs' intended usage pattern is clearly "daily pull, not per-request" (consistent with their $1/listing/month pricing model — it's a sync price, not a per-call price). Plan: pull once per day via cron + cache in Supabase; `/api/estimate` reads from cache, never from PriceLabs directly, so guest-facing requests never touch the external API.

### 2.5 Failure mode

**PriceLabs returns 730 days of calendar by default** (from the integration KB: "a minimum of 730 days"). Past that window, expect empty or stale data. We only let guests pick dates within the cached window anyway; past-window requests get a graceful "we'll follow up manually" fallback.

### 2.6 What we don't know yet (confirm by looking at Postman/Swagger directly)

1. Exact base URL (e.g. `https://api.pricelabs.co/v1/…` — need to confirm).
2. Exact auth header name.
3. Exact `GET /listing_prices` query param names (`listing_id` vs `listing_ids`, `date_start` vs `from` vs `start_date`).
4. Whether the response is keyed by date (object) or an array of `{date, price, min_stay}` objects.
5. Whether guest-count or check-in day pricing deltas are returned, or only per-date base prices.
6. Whether availability (booked/blocked dates) is returned alongside prices.

All six are cheap to discover — one `curl` against the real API with Abe's key settles them. The rest of this plan assumes the **per-date array** shape and the **base-nightly + min-stay** fields because that is PriceLabs' consistent public vocabulary. Fallbacks are listed in §10.

---

## 3. Chicago STR tax stack (2026 rates)

Guests are buying a short-term rental (<30 nights), which in Chicago is treated as a shared-housing / vacation-rental unit, not a hotel. Applicable taxes, additive:

| Tax | Rate | Applies to | Source |
| --- | --- | --- | --- |
| Chicago Hotel Accommodations Tax (7520) | **4.50%** | gross rent + cleaning fee | [chicago.gov hotel-accommodations-tax](https://www.chicago.gov/city/en/depts/fin/supp_info/revenue/tax_list/hotel_accommodationstax.html) |
| Chicago Shared Housing Surcharge | **4.00%** | gross rent + cleaning fee | [chicago.gov new-vacation-rental-surcharge PDF (2018)](https://www.chicago.gov/content/dam/city/depts/rev/supp_info/TaxPublicationsandReports/NewVacationRentalandSharedHousingSurcharge2018.pdf) |
| Chicago Domestic Violence Surcharge | **2.00%** | gross rent + cleaning fee | same PDF; Civic Federation breakdown |
| **Subtotal — City of Chicago** | **10.50%** | | |
| Cook County Hotel Accommodations Tax | **1.00%** | gross rent + cleaning fee | [cookcountyil.gov/service/hotel-tax](https://www.cookcountyil.gov/service/hotel-tax) |
| Illinois Hotel Operators' Occupation Tax (HOOT — expanded to STR 1/1/2026 via SB1749) | **6.00% × 94% = 5.64%** effective | gross rent + cleaning fee | [tax.illinois.gov/research/publications/bulletins/fy-2025-28.html](https://tax.illinois.gov/research/publications/bulletins/fy-2025-28.html), [Avalara summary](https://www.avalara.com/mylodgetax/en/blog/2025/06/illinois-expands-hotel-occupation-tax-to-include-short-term-rentals.html) |
| Illinois Municipal / Metro-Pier / other state hotel taxes assessed in Chicago | **~0.23%** small; see Civic Fed. | gross rent | [Civic Federation — composite rate](https://www.civicfed.org/civic-federation/blog/how-composite-effective-hotel-tax-rate-calculated-chicago) |
| **Effective total — Chicago STR** | **~17.37%** | | Civic Federation cites ~17.4% for hotel composite; STR composite is nearly identical as of 2026 because of the HOOT expansion |

**Simplification for the quote:** display a single line item **"Taxes (Chicago STR, ~17.37%)"** with a tooltip that expands to the breakdown above. Itemizing all five lines is noisy and invites line-item objections. Abe's host email gets the one-line version only.

**Worth flagging in the plan:** the tax base is **rent + cleaning fee**. Our math must include cleaning fee in the taxable base, not tax it separately.

**Tax collection model:** On Airbnb/VRBO, the platforms remit. For **direct** bookings through thejackpotchi.com, Abe is the Operator and is legally responsible for collecting & remitting to the City (via Chicago's hotel tax filings) and State. The site must therefore (a) collect the correct amount at booking and (b) surface what's tax vs rent so Abe's books balance. **Abe needs to confirm his registration status with Chicago Dept of Finance + Illinois DOR before we quote tax-inclusive prices.** This is a prerequisite, not a code concern.

---

## 4. Customary STR fees for a 14-guest luxury Chicago property

Research + comps:

| Line item | Standard for 14-guest luxury Chicago STR | Recommendation for The Jackpot | Rationale |
| --- | --- | --- | --- |
| Cleaning fee | $300–$600 (AirDNA / StayFi cite $300–$500 for "large/luxury"; Chicago turnover services run $175+ for larger homes) | **$475 flat**, configurable in `pricing_config` | Covers 14-person turn (linen, deep clean). Below the point of objection but fairly priced vs comps. |
| Pet fee | Varies; $75–$150 | **Not applicable — The Jackpot is not pet-friendly.** Don't surface the line. | Keep config field but default to 0 and hide. |
| Early check-in / late check-out | Usually ad-hoc | **Not surfaced in the quote.** Handle in Abe's reply. | Adds clutter for a pre-booking email. |
| Damage waiver / accidental damage protection | Some luxury STRs charge $40–$80 | **Defer.** | Nice-to-have. Don't make the first quote look fee-heavy. |
| Extra-guest fee (over X guests) | Common for STRs with tiered capacity | **Not applicable — we quote flat to 14, always.** | The Jackpot's product is the whole house. |
| Event fee | Common for event-friendly listings (e.g., $500 for an event night) | **Not in v1.** Flag to Abe as a possible v2 config. | Wedding / bachelorette/reunion leads might warrant this; but manual pricing override covers edge cases for now. |
| Security deposit / authorization hold | Typical; $500–$2000 hold | **Mention in email, don't itemize in total.** "$1,000 authorization hold (refunded after check-out)". | Sets expectation without inflating the headline number. |
| Host service fee | **$0** on direct booking — this is the pitch | **Explicitly called out** in quote as the "book direct" savings bullet | Airbnb guest fee is ~14.2%; for a $5k stay that's ~$710 saved. Narrative gold. |

---

## 5. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          VERCEL CRON (daily 03:00 CT)              │
│  /api/cron/pricelabs-sync  → protected by CRON_SECRET header       │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  GET /listing_prices (730-day range)
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                     PriceLabs Customer API                         │
│              Base URL: https://api.pricelabs.co/...                │
│                   Header: X-API-Key: ${PRICELABS_API_KEY}          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  730 days × {date, price, min_stay}
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Supabase — `listing_prices`                     │
│         Upserted on (listing_id, stay_date).  Read-only elsewhere. │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
         ┌─────────────────────┴──────────────────────┐
         │                                            │
         ▼                                            ▼
┌──────────────────────┐                  ┌─────────────────────────┐
│  POST /api/estimate  │                  │  POST /api/inquiries    │
│  (dates + guests)    │                  │  (existing route)       │
│  → computeQuote()    │                  │  → computeQuote()       │
│  → returns Quote     │                  │  → passes to emails     │
└──────────────────────┘                  └─────────────────────────┘
         │                                            │
         ▼                                            ▼
    Funnel UI (step 2)                    Guest + Host email bodies
```

Single `computeQuote(arrival, departure, guests)` helper reads from `listing_prices` + `pricing_config` + `discounts` and is reused by both the estimate endpoint and the inquiries route. No duplicated math.

---

## 6. Database schema

Full migration to append to `docs/supabase-migration.sql`:

```sql
-- =============================================================
-- PriceLabs integration tables (added 2026-04-16)
-- =============================================================

-- Single row per (listing, date). Populated by the nightly cron.
-- Rate is the PriceLabs recommended nightly price in USD.
create table if not exists public.listing_prices (
  listing_id        text not null,
  stay_date         date not null,
  rate_cents        int  not null check (rate_cents >= 0),
  min_stay          int  not null default 2 check (min_stay >= 1),
  source            text not null default 'pricelabs',
  fetched_at        timestamptz not null default now(),
  primary key (listing_id, stay_date)
);
create index if not exists listing_prices_stay_date_idx
  on public.listing_prices (stay_date);

-- Key/value config, one row per key. Keeps numeric rates editable
-- from Supabase without a code deploy. All amounts in cents where
-- relevant; percentages stored as bps (basis points) for integer safety.
create table if not exists public.pricing_config (
  key               text primary key,
  value_text        text,
  value_number      numeric,   -- for bps (e.g. 1737 = 17.37%) or dollar amounts
  description       text not null,
  updated_at        timestamptz not null default now()
);

-- Seed rows. Safe to re-run (idempotent via ON CONFLICT DO NOTHING
-- if an operator needs to reset; actual updates happen via UPDATE).
insert into public.pricing_config (key, value_number, description) values
  ('cleaning_fee_cents',         47500, 'Flat cleaning fee in cents. $475.'),
  ('tax_rate_bps',                1737, 'Effective Chicago STR tax in basis points (17.37%).'),
  ('min_stay_floor',                 2, 'Absolute minimum nights we will quote, regardless of PriceLabs min_stay.'),
  ('max_guests',                    14, 'Max guests we quote for.'),
  ('listing_id',  'PRICELABS_LISTING_ID_TBD', 'PriceLabs internal listing id for The Jackpot. Populate after first /listings call.'),
  ('airbnb_fee_bps',              1420, 'Airbnb guest service fee (~14.2%). Used for "saved vs Airbnb" narrative only.'),
  ('vrbo_fee_bps',                1000, 'VRBO guest service fee (~10%). Narrative only.')
on conflict (key) do nothing;

-- Discount rules. Each row is one rule. Applied at quote time by
-- computeQuote(). Multiple rules can apply to a single stay —
-- see §9 for the resolution algorithm.
create table if not exists public.discounts (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('los', 'occasion', 'code', 'date_window')),
  label             text not null,           -- human-readable, e.g. "Weekly 10% off"
  -- LOS: minimum number of nights for this tier
  min_nights        int,
  -- Occasion: matches inquiries.reason verbatim (Birthday, Wedding, …)
  occasion          text,
  -- Code: guest-facing promo code (null for non-code rules)
  code              text unique,
  -- Date window this rule is valid for the STAY dates (both inclusive)
  stay_start        date,
  stay_end          date,
  -- Date window this rule is bookable during (both inclusive)
  valid_from        date,
  valid_to          date,
  -- Percentage off as basis points (1000 = 10%)
  percent_off_bps   int check (percent_off_bps between 0 and 5000),
  -- Optional flat dollar off; use percent_off_bps OR amount_off_cents
  amount_off_cents  int check (amount_off_cents >= 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists discounts_kind_active_idx
  on public.discounts (kind) where active;
create unique index if not exists discounts_code_unique
  on public.discounts (lower(code)) where code is not null;

-- Extend inquiries with the captured quote snapshot + budget bucket.
-- Storing the full quote JSON at submit time means reprints of the
-- email months later still match what the guest saw.
alter table public.inquiries
  add column if not exists budget_bucket  text
    check (budget_bucket in ('under_3k','3k_5k','5k_8k','8k_12k','12k_plus')),
  add column if not exists quote_snapshot jsonb,
  add column if not exists quote_total_cents int;
```

**Why separate `listing_prices` instead of caching in-memory:**
- Vercel is serverless. No persistent memory between invocations.
- Supabase read is ~20ms and free.
- Gives Abe visibility: he can query the table to see what PriceLabs said on any date, which helps him debug surprise quotes.

**Why `value_text` AND `value_number` in `pricing_config`:** lets us mix `listing_id` (text) with numeric rates in one table. Cheap and clear.

---

## 7. Cron job spec

### 7.1 Vercel Cron config

Add to `vercel.json` at project root (currently absent — this creates it):

```json
{
  "crons": [
    {
      "path": "/api/cron/pricelabs-sync",
      "schedule": "0 8 * * *"
    }
  ]
}
```

- Schedule: `0 8 * * *` = 08:00 UTC = 03:00 America/Chicago year-round (the CT offset swings, but 03:00–04:00 local is fine — nobody's booking then).
- Vercel Cron on the Hobby plan: 1 daily cron. Pro: 40. The Jackpot is on Pro already (deploy proof). Confirm before merging.

### 7.2 Endpoint: `POST /api/cron/pricelabs-sync`

```ts
// src/app/api/cron/pricelabs-sync/route.ts
// Runtime: nodejs (we need env + supabase-js)
// Auth: header "Authorization: Bearer ${CRON_SECRET}". Vercel Cron
// injects this automatically when CRON_SECRET is set in env.

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET.
  // 2. Fetch from PriceLabs:
  //      GET https://api.pricelabs.co/v1/listing_prices
  //          ?listing_id=${PRICELABS_LISTING_ID}
  //          &date_from=${today}
  //          &date_to=${today + 730d}
  //      Header: X-API-Key: ${PRICELABS_API_KEY}
  //    (Confirm exact path + param names from Postman/Swagger before
  //     writing the fetch.)
  // 3. Parse response → array of {date, price, min_stay}.
  // 4. Upsert into listing_prices on (listing_id, stay_date).
  //    Use Supabase's `upsert(..., { onConflict: 'listing_id,stay_date' })`.
  // 5. Log a one-line summary: "[cron] synced 730 days, min=$420
  //    max=$1850 median=$680".
  // 6. On any error: return 500, log, and send a Resend email to
  //    NOTIFY_EMAIL with the error (so Abe knows to fix before
  //    guests get stale prices).
}
```

### 7.3 Rate limits + error handling

- **No documented rate limits.** 1 request/day is well within anything reasonable.
- **Retry:** single retry with exponential backoff (1s, then give up). Don't retry in a loop — a broken sync should alert Abe, not mask itself.
- **Staleness alert:** if the newest `fetched_at` in `listing_prices` is > 48h old at quote-time, `computeQuote` logs a warning and the host email gains a banner: `⚠ Prices are >48h stale. PriceLabs sync may be broken.`
- **PriceLabs 429 behavior:** unknown. If observed, fall through to using existing cached data (quote still works) and retry next cron cycle.

---

## 8. Trigger logic — when do we show the estimate?

**Three options considered:**

### 8a. Inline in Step 1 of BookingFunnelSteps (as soon as dates + email are captured)

- **Pro:** highest perceived value. Guest sees a real number before submitting a phone number.
- **Con:** burns the number anonymously. Abe loses the "send me your details first" gate. Also: the dates-picked event happens before email in some entry points (the desktop top bar) — so we'd either gate on email always, or show a stranger the price.
- **Con:** the Step 2 "checking" beat currently carries the pacing. Injecting a price there disrupts the copy ("Your dates are available") with a dollar figure mid-animation.

### 8b. After step 3 submit — show quote on the success screen AND in the email ← **RECOMMENDED**

- **Pro:** guest has already committed (name, phone, reason). Quote is the reward for completing the form.
- **Pro:** matches the promise ("Your personalized pricing guide lands in your inbox within minutes") while also giving immediate gratification — success screen says "Here's your quote — also sent to your inbox."
- **Pro:** only one computeQuote call, done server-side in `/api/inquiries` right after the Supabase insert. Result is returned in the POST response + embedded in both emails.
- **Pro:** if PriceLabs is down, we silently fall back to "Abe will reply with your personal quote in the morning" — and the funnel still succeeds.
- **Con:** slightly more work on the success screen (currently a pure celebration state with one link).

### 8c. Only in the confirmation email

- **Pro:** zero UI change.
- **Con:** we've already shown success; coming back to inbox is an extra step. Also: loses the real-time dopamine hit that makes this change worth the build.

**Recommendation: 8b.** Compute once in `/api/inquiries`, embed in:
1. The 200 response → success screen expands to show the itemized quote
2. `sendGuestConfirmation` email (replaces current "guide is on its way" copy)
3. `sendHostNotification` email (single glance line: `💰 Quoted: $5,842 total · 3 nights · $475 cleaning · 17.37% tax`)

No inline number in Step 1/2. Preserves the animated pacing and the trust arc.

---

## 9. `/api/estimate` endpoint design

Exposes `computeQuote()` as its own route so Abe can optionally add a calendar-preview widget later without rewriting. In v1 it's called from the client only for user-driven re-computes (e.g., if they change guest count on the success screen — out of scope for v1 but the endpoint exists).

### 9.1 Request

```
POST /api/estimate
Content-Type: application/json

{
  "arrival":   "2026-07-04",      // YYYY-MM-DD, required
  "departure": "2026-07-07",      // YYYY-MM-DD, required, > arrival
  "guests":    8,                 // 1..14, required
  "occasion":  "Wedding",         // optional — enables occasion discounts
  "code":      "ABE25"            // optional promo code
}
```

### 9.2 Response (200)

```ts
interface Quote {
  currency: "USD";
  arrival: string;              // ISO
  departure: string;            // ISO
  nights: number;
  guests: number;
  /** Per-night breakdown so the email can render a mini-table. */
  nightly: Array<{ date: string; rateCents: number }>;
  /** Sum of nightly.rateCents before any discount. */
  subtotalCents: number;
  /** Applied discount(s). Only the winning rule(s) per §9.4. */
  discounts: Array<{
    kind: "los" | "occasion" | "code" | "date_window";
    label: string;
    amountCents: number;        // signed negative
  }>;
  /** subtotal + cleaning - discounts. The base for tax. */
  preTaxCents: number;
  cleaningCents: number;
  taxRateBps: number;           // e.g. 1737
  taxCents: number;
  totalCents: number;
  perGuestCents: number;        // totalCents / guests, rounded
  /** Narrative helpers. */
  savedVsAirbnbCents: number;   // totalCents * airbnb_fee_bps
  savedVsVrboCents: number;
  /** Staleness + confidence. */
  pricesAsOf: string;           // ISO timestamp of cron sync
  stale: boolean;               // fetched_at > 48h
}
```

### 9.3 Error responses

- `400` — bad dates, guests out of range, departure ≤ arrival, nights < min_stay_floor.
- `404` — requested date range not cached (dates outside the 730-day window). Response body includes `{ error: "out_of_window", fallback: "manual_quote" }`. Funnel still submits the inquiry and email copy degrades to "Abe will send you a personal quote within 24h."
- `409` — min-stay violation (requested nights < max(per-date min_stay) for the range). Response includes `{ error: "min_stay", required: 3 }` so the UI can nudge.
- `500` — cache empty (first-run situation). Same fallback copy as 404.

### 9.4 Caching

Don't cache. Every call does fresh Supabase reads — it's <50ms end-to-end. Adding a Redis layer here is gold-plating; Supabase queries on `(listing_id, stay_date)` index are effectively free at our volume.

### 9.5 Discount resolution algorithm

Pseudocode for `computeQuote`:

```ts
// 1. Pull nightly rates from listing_prices (listing_id, stay_date IN [arrival..departure-1]).
//    If any missing → return 404 out_of_window.
// 2. Check min_stay: nights >= max(min_stay per night) else 409.
// 3. subtotalCents = sum(nightly.rateCents).
// 4. Gather candidate discounts:
//       - LOS: all discounts where kind='los' AND active AND nights >= min_nights
//              → pick the one with highest percent_off_bps (tiers don't stack).
//       - Occasion: discounts where kind='occasion' AND active AND
//                   occasion = inquiry.occasion AND stay in [stay_start..stay_end]
//       - Code: exact match (case-insensitive) AND valid_from ≤ today ≤ valid_to
//               AND stay_start ≤ arrival AND stay_end ≥ departure
//       - Date window: stay overlaps [stay_start..stay_end]
// 5. Combine rule: NON-STACKABLE across kinds by default — pick the single
//    discount across all candidates with the largest amountCents. This is
//    simpler to explain to guests ("your 10% weekly discount applied")
//    than stacked math.
//    CODE rule: if an explicit promo code matches, it overrides the best
//    automatic discount even when it's smaller (guest intent > system choice).
// 6. cleaningCents = pricing_config.cleaning_fee_cents.
// 7. preTaxCents = subtotalCents - |discount| + cleaningCents.
// 8. taxCents = round(preTaxCents * tax_rate_bps / 10000).
// 9. totalCents = preTaxCents + taxCents.
// 10. perGuestCents = round(totalCents / guests).
```

### 9.6 LOS discounts from PriceLabs vs our own

Per §2.3, PriceLabs applies LOS as a % multiplier on the daily rate *before* returning. If the Customer API includes those adjustments, we're already consuming them — our `discounts` table should then hold **non-LOS** rules only (occasion, code, date_window).

If the Customer API returns base-only rates (likely — it's a recommendation API, not a renderer), we mirror Abe's PriceLabs LOS tiers into `discounts` ourselves:

| PriceLabs tier | Row in `discounts` |
| --- | --- |
| 7+ nights = 10% off | `kind=los, min_nights=7, percent_off_bps=1000, label='Weekly 10% off'` |
| 14+ nights = 15% off | `kind=los, min_nights=14, percent_off_bps=1500, label='Bi-weekly 15% off'` |
| 30+ nights = 25% off | `kind=los, min_nights=30, percent_off_bps=2500, label='Monthly 25% off'` |

**Open: which is it?** Confirm by inspecting one real PriceLabs response. If the rate for `date=2026-07-04, stay_length=7` is lower than `date=2026-07-04, stay_length=2`, it's LOS-aware. (The endpoint likely doesn't even take a stay_length param and always returns base — but verify.)

---

## 10. Edge cases & failure modes

| Scenario | Behavior |
| --- | --- |
| PriceLabs API down during cron | Keep stale `listing_prices`. Send Abe an alert email. Quote still computes on cache. |
| PriceLabs API down during guest submit | Irrelevant — guest submit never hits PriceLabs, only Supabase cache. |
| Cache empty (first deploy, cron hasn't run yet) | `/api/estimate` returns 500 fallback; emails degrade to "Abe replies personally with your quote within 24h." Funnel still succeeds. |
| Some nights missing from cache (730-day window edge, or one date failed to upsert) | Treat as out_of_window (404). Don't silently quote a partial stay. |
| Guest picks `departure ≤ arrival` | 400 from both `/api/estimate` and `/api/inquiries` (already validated). |
| Guest picks nights < PriceLabs min_stay | 409 with `required` nights; funnel UI shows "A 3-night minimum applies for those dates". |
| Guests > 14 | Client prevents (select max 14). Server double-checks and rejects. |
| Dates outside 730-day window | 404 fallback. Funnel submit still works; quote omitted from emails; host email gains a line "⚠ Dates are > 2 years out; manual quote needed." |
| Cron hasn't run in > 48h | Quote still returns but `stale=true`. Host email header shows warning. Guest email is unchanged (don't air our laundry). |
| Guest supplies promo code that doesn't exist / expired | Silently ignore and apply best automatic discount. Don't error — a typo shouldn't kill the inquiry. Log it. |
| Discount > rate (negative subtotal) | `Math.max(0, …)` clamp. Won't happen with sane config, but guard. |
| Cleaning fee changes mid-sync | `quote_snapshot` jsonb on `inquiries` means the email matches what we quoted even if config changed later. |
| Inquiry comes from Airbnb/VRBO (via UTM) | Quote still generates, but guest email skips the "saved vs Airbnb" line — they already paid platform fees, don't rub it in. Gate on `attribution.utm_source === 'airbnb'`. |

---

## 11. Email changes

### 11.1 Guest confirmation (`src/lib/email/guestConfirmation.ts`)

Replace the "guide is on its way" block with a rendered quote block. Keep the letter voice. Rough copy:

> **Thanks, {firstName}.**
> Here's your personalized quote. Everything itemized — no platform fees, no surprises at checkout.
>
> **Dates:** Jul 4 → Jul 7 · 3 nights
> **Guests:** 8
> **The house, nightly:** $1,840 + $2,100 + $1,750 = **$5,690**
> **Weekly discount (−10%):** −$569
> **Cleaning fee:** $475
> **Chicago STR tax (17.37%):** $976
> **Total:** **$6,572** · that's $822/guest
>
> *You'd pay ~$933 more on Airbnb in guest service fees alone.*
>
> I'll reach out personally within the day — happy to walk through dates, hold the house, or tweak the package for your occasion.
> — Abe

HTML implementation stays inline-style-only (email client safe). Mini-table uses the same `faf6ef` background block that already exists for the Dates/Guests/Occasion strip.

**Fallback copy** (when quote unavailable — cron failed, out of window):

> Thanks, {firstName}. I'll send a custom quote within the day — the dates you picked need a hand-calculated rate. Keep an eye on your inbox.
> — Abe

### 11.2 Host notification (`src/lib/email/hostNotification.ts`)

Abe's preference is glance-line summary over tables. Matches his direction on the existing "📍 This lead came from: Batch" banner. Add one more line:

> 💰 **Quoted: $6,572 total** · 3 nights · $475 clean · 17.37% tax · saved $933 vs Airbnb

Rendered as a full-width row beneath the existing "📍 lead came from:" banner, same `fbf6ef` chip styling. Only rendered when the quote was successfully computed. When absent, no banner — Abe knows to follow up manually.

### 11.3 New email template file

Extract the quote renderer into its own file:

```
src/lib/email/quoteBlock.ts
  renderQuoteHtml(q: Quote): string
  renderQuoteGlanceLine(q: Quote): string
```

Used by both host + guest templates. Keeps duplication down.

---

## 12. Budget capture field

Add to Step 3 of `BookingFunnelSteps` under the "What are you celebrating?" chips. 5 buckets, radio chip row mirroring the reason chips:

| Bucket | Display | `budget_bucket` value |
| --- | --- | --- |
| 1 | `Under $3k` | `under_3k` |
| 2 | `$3–5k` | `3k_5k` |
| 3 | `$5–8k` | `5k_8k` |
| 4 | `$8–12k` | `8k_12k` |
| 5 | `$12k+` | `12k_plus` |

**Optional field** — explicit "skip" chip or leaveable blank, because anchoring matters and some leads will lie downward. Copy above chips: *"What are you thinking for the stay? (Optional — helps me tailor the options)"*

Host notification email surfaces this right below the quote line:

> 💰 **Quoted: $6,572** · saved $933 vs Airbnb
> 🎯 **Budget: $5–8k** *(under quote — lead with value or discount)*

The qualitative tag after the budget (`under quote` / `at quote` / `above quote` / `well above`) is computed from `totalCents` vs the bucket midpoint. This is where the real sales signal lives — Abe opens the email, reads one line, knows whether to push the deluxe package or lead with a discount.

---

## 13. Files touched vs untouched

### Would touch
- `docs/supabase-migration.sql` — append the three new tables + `inquiries` columns from §6.
- `vercel.json` — new file at project root (currently absent) with the cron entry.
- `src/lib/pricelabs.ts` — new. PriceLabs client: `fetchListingPrices()`, `syncPrices()`.
- `src/lib/pricing/computeQuote.ts` — new. Core quote computation.
- `src/lib/pricing/types.ts` — new. `Quote` interface (exported for email templates + API response).
- `src/app/api/cron/pricelabs-sync/route.ts` — new. The cron handler.
- `src/app/api/estimate/route.ts` — new. POST endpoint.
- `src/app/api/inquiries/route.ts` — modify. Call `computeQuote` right after Supabase insert (before emails). Store `quote_snapshot` + `quote_total_cents` on the inquiry row. Pass quote to both emails.
- `src/lib/email/types.ts` — add `Quote` to `InquiryPayload` as optional field.
- `src/lib/email/quoteBlock.ts` — new. Shared HTML renderers.
- `src/lib/email/guestConfirmation.ts` — modify to render quote block.
- `src/lib/email/hostNotification.ts` — modify to add quote glance line + budget line.
- `src/components/brand/BookingFunnelSteps.tsx` — modify:
    - Add budget chip group in Step 3.
    - Thread `quote` from `/api/inquiries` response into a new expanded success screen.
- `src/components/brand/BookingFunnelSteps.module.css` — add quote-table styles.

### Untouched
- PostHog provider / UTM provider / occasion provider / calendar components — no changes.
- Supabase client — no changes.
- All brand tokens — no changes.
- Hero / sticky bar / bottom sheet — no changes to their APIs. Funnel change is contained to step 3 + success.

---

## 14. Out of scope (explicit defers)

- **In-page Stripe checkout / reservation.** We still collect leads; Abe still closes in DM/email. That's the brand.
- **Multi-property scaling.** `listing_id` in the schema supports it, but we quote one listing.
- **Automated discount code emails / abandoned-cart flows.** Out of scope.
- **Real-time availability blocking** (hiding dates where PriceLabs says "booked" on Airbnb/VRBO). The funnel today shows every date as "available" because Abe resolves conflicts in his follow-up. Keep that.
- **Dynamic upsells** (early check-in surcharge, late check-out, event fees).
- **Per-guest pricing** (rates that scale with 4 vs 14 guests). Not how The Jackpot is priced.
- **Calendar-embedded price preview** (showing the nightly rate on each date in the date picker). Nice-to-have v2; the endpoint supports it.
- **Abe admin UI.** Abe edits `pricing_config` + `discounts` directly in Supabase. Table Editor is his admin.

---

## 15. Open questions for the critiquing agent

1. **Auth header name.** Confirm from Postman/Swagger whether it's `X-API-Key`, `Authorization: Bearer …`, or `X-Pricelabs-Api-Key`. (Don't guess.)
2. **Endpoint path + params.** What is the real path for "prices for listings"? Is it `GET /listing_prices?listing_id=…&from=…&to=…` or `POST /listings/prices` with a body?
3. **LOS-aware or base-only?** Does the response already include LOS discounts, or does it return base rates only?
4. **Availability in the response.** Does the response include a `booked` / `available` flag per date? If yes, we can eventually block known-unavailable dates at the calendar level (out of scope v1, but good to know).
5. **Psychological price endings.** Round total up to $X99? Round cleaning fee to $475 or $499? Gut says yes for quoted total-display only (keep raw math precise internally). Confirm.
6. **Tax display.** One line "Taxes (~17.37%)" vs itemized five lines. Plan recommends one line with tooltip. Confirm.
7. **"Saved vs Airbnb" line.** Always show, or only when inquiry UTM ≠ airbnb? Plan says gate on UTM.
8. **Cleaning fee — $475 number.** Plan's guess based on comps. Abe, is this right? This drives every quote.
9. **Tax rate — 17.37%.** Civic Federation's composite number for 2026 + HOOT expansion. Abe must verify against his actual remittance obligations before we display tax-inclusive prices. If Abe isn't yet registered to collect, we might need a different presentation ("Taxes collected and remitted by Airbnb" is not true for direct bookings).
10. **Discount stacking.** Plan recommends non-stackable (best-wins) for simplicity. LOS + occasion + code: is there ever a case Abe wants them to stack?
11. **Budget buckets.** Are these the right 5 tiers? Should the top one be `$15k+` instead? What's the actual stay range?
12. **Funnel UI — show the full quote inline on success or collapsed "tap to see breakdown"?** Plan shows full. Mobile real estate is tight; could warrant collapsed + expand.
13. **What if PriceLabs rate is absurdly low (e.g., $50/night during a slow shoulder)?** Should we set a `min_nightly_cents` floor in `pricing_config` to guard against accidentally quoting $200 for a 3-night stay? Recommended: yes, $400/night floor.
14. **Currency.** USD-only for now. Flag for future.
15. **Deposit / authorization hold.** Surface in the email copy? Plan says yes, at the bottom, not in the total.
16. **Quote expiration.** Prices are dynamic — if Abe replies 3 days later, the PriceLabs rate may have shifted. Should the guest email say "Quote valid 48 hours"? Plan says yes. Confirm the window.

---

## 16. Verification plan

### 16.1 Pre-merge (local + staging)

1. **PriceLabs client unit test.** Mock the API response. `computeQuote` test suite covers:
    - 2-night stay, no discounts, weekday
    - 7-night stay, weekly discount applied
    - Stay spanning July 4 weekend (high rates)
    - Dates outside window → 404
    - `nights < min_stay` → 409
    - Missing cleaning_fee config → explicit error, not `NaN`
    - Discount amount > subtotal → clamped to 0
2. **Supabase migration.** Run against a staging project, seed `pricing_config`, `discounts` with the canonical rows. Verify `listing_prices` upsert on `(listing_id, stay_date)` conflict behaves as expected.
3. **Cron endpoint.** Local manual hit with `curl -H "Authorization: Bearer $CRON_SECRET"`. Verify 730 rows upserted, count matches, no TZ drift on dates.
4. **/api/estimate.** curl with a known date range, assert JSON shape matches `Quote` interface.
5. **/api/inquiries.** Existing test (if any) extended; otherwise manual browser flow. Submit → inspect response → confirm `quote` payload present → check both emails in Resend dashboard → verify snapshot saved in Supabase.
6. **Fallback paths.**
    - Drop `listing_prices` table → submit → confirm fallback email copy, no crash.
    - Set `fetched_at` to 3 days ago → confirm host email shows staleness warning.
    - Submit dates 3 years out → confirm out-of-window fallback.
7. **Email rendering.** Preview in Gmail, Outlook web, iOS Mail. The quote table is the risky piece; nested `<table>` with inline styles only.
8. **TypeScript + lint.** `npm run lint` and `tsc --noEmit` both clean.

### 16.2 Post-deploy (prod)

1. Manually trigger `/api/cron/pricelabs-sync` once, verify `listing_prices` populated.
2. Submit a real test inquiry with abe+test@…com. Confirm quote arrives, matches expected math, both emails render.
3. Let the daily cron run for 3 days. Verify `fetched_at` updates; check logs for any PriceLabs 429/5xx.
4. Spot-check the math against a manual Airbnb quote for the same dates. The direct-booking total should be lower than the Airbnb total (because the guest fee is gone).
5. After first real guest inquiry lands, have Abe read the host email at his actual reading speed. The quote glance line is the one that either saves or wastes him time — it's the metric.

### 16.3 Smoke tests to schedule

- Daily: `listing_prices.fetched_at` max → alert if > 36h old.
- Weekly: compare PriceLabs cached median rate to Airbnb search price for the same week. Big drift = the cron's pulling wrong listing or Abe's PriceLabs customizations changed.

---

## Appendix — source citations

- PriceLabs Customer API: https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api
- PriceLabs Building an Integration: https://help.pricelabs.co/portal/en/kb/articles/building-an-integration-with-pricelabs
- PriceLabs Customer API for WordPress/Wix: https://help.pricelabs.co/portal/en/kb/articles/how-to-use-pricelabs-customer-api-to-send-the-prices-to-wordpress-wix-website
- PriceLabs LOS pricing: https://help.pricelabs.co/portal/en/kb/articles/length-of-stay-pricing
- PriceLabs Postman collection (auth-walled): https://documenter.getpostman.com/view/507656/SVSEurQC + https://www.postman.com/security-geoscientist-28133657/pricelabs/documentation/yu0l484/pricelabs-api
- PriceLabs Open API launch: https://hello.pricelabs.co/blog/pricelabs-launches-open-api/
- Chicago Hotel Accommodations Tax (7520, 7520S, 7520T): https://www.chicago.gov/city/en/depts/fin/supp_info/revenue/tax_list/hotel_accommodationstax.html
- Chicago Vacation Rental & Shared Housing Surcharge (2018 notice PDF): https://www.chicago.gov/content/dam/city/depts/rev/supp_info/TaxPublicationsandReports/NewVacationRentalandSharedHousingSurcharge2018.pdf
- Cook County Hotel Tax: https://www.cookcountyil.gov/service/hotel-tax
- Illinois Hotel Operators' Occupation Tax: https://tax.illinois.gov/research/taxinformation/excise/hotel.html
- Illinois FY 2025-28 bulletin (STR expansion): https://tax.illinois.gov/research/publications/bulletins/fy-2025-28.html
- Avalara summary (IL STR HOOT): https://www.avalara.com/mylodgetax/en/blog/2025/06/illinois-expands-hotel-occupation-tax-to-include-short-term-rentals.html
- Civic Federation — Composite Chicago hotel rate: https://www.civicfed.org/civic-federation/blog/how-composite-effective-hotel-tax-rate-calculated-chicago
- Airbnb Illinois occupancy tax collection: https://www.airbnb.com/help/article/2303
- Cleaning fee comps: https://stayfi.com/glossary/average-cleaning-fee/ , https://www.airdna.co/blog/airbnb-cleaning-fees-what-hosts-need-to-know , https://sundaycleaner.com/airbnb-cleaning-service/
