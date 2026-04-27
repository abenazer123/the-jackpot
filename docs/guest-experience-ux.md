# Guest Experience UX — brainstorm + scoping doc

Reference document for the guest-facing experience around the quote, deposit,
demand signals, and negotiation flow. This is not an implementation plan —
it's a structured snapshot of ideas + open questions to iterate on before
Phase A build.

Source: brainstorm session 2026-04-21 between Abe and Claude.
Updated 2026-04-22 with feedback from Abe's design/creative agent — most
revisions strengthened the original design (better tier names, killed the
blur teaser, conditional Shape-Your-Stay step, flipped CTA hierarchy,
mobile progressive disclosure, sticker-shock safety valve).

---

## 1. Context

**What's built and silent:** the booking funnel already computes a full
itemized quote (nightly rates, cleaning fee, tax, per-guest cost, savings
vs Airbnb) the moment dates + email are captured. The JSON is frozen on
the inquiry row in Supabase. See `docs/pricelabs-integration.md` §9 for
the shape.

**What guests see today:** absolutely nothing price-related. The success
screen is a celebration + "Abe will reach out personally." Emails say
"your pricing guide lands in your inbox within minutes" but currently
just restate the inquiry details back to the guest — the quote JSON on
the row goes unused.

**Why that's a problem:** the funnel makes a promise it doesn't keep.
Abe replies personally when he can, but there's a delay window where the
guest is waiting, may be browsing competitor listings, and has no
information to evaluate whether to hold their calendar for Abe. The
strategic opportunity is to use that silent quote to close the loop —
give the guest a real, itemized, credible number up front, framed in a
way that filters for guest quality and drives direct bookings.

---

## 2. Goals & constraints

Abe's operating principles for this UX work:

- **Filter for guest quality over volume.** Price is the first-line
  filter for a 14-guest luxury property (party-house risk). Any UX
  change that widens the funnel to lower-tier buyers is a regression.
- **$900/stay net minimum floor.** Hard line. No path in the UX
  produces a realized booking below this net.
- **Direct bookings are the target channel.** Every narrative element
  should reinforce "book direct" over "go find us on Airbnb."
- **Abe personally closes most bookings.** The UX supports his sales
  process, doesn't replace it. The default CTA path is conversation,
  not commit.
- **Luxury brand positioning.** Design voice is warm, editorial,
  personal (not corporate or aggressive). Never "BOOK NOW" energy.
  Editorial frames, not booking.com shimmer.
- **Never deceive.** Social proof and urgency signals must be backed by
  real data, always. Sophisticated guests cross-reference across
  platforms; fake urgency corrodes trust once caught. This applies even
  to "blurred preview" patterns — they read as SaaS gating, also wrong.

---

## 3. Abe's ideas — structured

### §3.1 Direct-booking savings narrative (Abe's idea)

Show the guest what they're saving by booking direct vs Airbnb / VRBO's
platform fees.

**Data we already have:**
- Airbnb guest service fee ≈ 14.2% → stored as `airbnb_fee_bps=1420` in
  `pricing_config`, available on every Quote as `savedVsAirbnbCents`
- VRBO guest service fee ≈ 10% → `vrbo_fee_bps=1000`, available as
  `savedVsVrboCents`

**Build cost:** Low. Numbers already exist — just render them.

**Recommended:** one badge on the success screen — "Saving $933 vs
Airbnb's guest fees." That's it. Don't build a comparison panel; don't
break out VRBO separately. One line is enough — more reads as
defensive.

**Edge case:** if `utm_source === 'airbnb'`, suppress the badge —
they found us via Airbnb, the comparison is awkward. Suppress
entirely; don't substitute "saved vs VRBO."

---

### §3.2 Demand / popularity signal (Abe's idea — with pushback)

Show the guest that the date is "popular" to create urgency.

**Abe's original framing:** "some sort of demand thing that shows that
date is popular or something, might need to be slightly spoofed in our
favor."

**Hard no on spoofing.** See §7 for the full rationale. Real signals
are already strong enough.

**Real signals we can surface from data we already have:**

| Signal | Source | Example copy |
|---|---|---|
| Peer-booked count | Live Airbnb probe of true peer set (or daily-cron sample) | "4 of 8 comparable Chicago homes are already booked for these dates" |
| PriceLabs demand tier | `raw_data.demand_desc` in listing_prices cache | "High-demand weekend" |
| Booking lead time | `booked_date_STLY` + current days-to-stay | "Homes in this tier typically book 30+ days ahead" |
| Recency of peer bookings | 7-day pickup from `Market KPI` (neighborhood_data) | "3 similar homes near you booked this week" |

**Build cost:** Low-medium. Data exists in cache. Needs a small
analysis function + runtime gate (only show signals that are actually
true for the queried date).

**Display rules (§6 covers in detail):**
- Max 3 badges on the success screen
- Only signals with backing data for the specific date
- Suppress soft signals on soft dates
- Date-match specificity: "these dates" not "this home"

---

### §3.3 Budget collection — "What kind of weekend are you going for?" (Abe's idea, conditional)

Capture the guest's budget so Abe knows their willingness-to-pay before
replying. Implemented as a dedicated step with a value-exchange framing
(package matching) — but only shown for stays where it earns its place.

**Abe's framing:** "we need to collect their budget to begin with …
but collecting this info upfront is difficult and knowing if it's their
true max is also difficult as well."

**Decision: dedicated step (Step 4), conditional render.**

Show only when ANY of these are true:
```
1. nights >= 3 && guests >= 6
2. reason in ['Wedding', 'Bachelor/ette', 'Birthday']
3. ANY night in the requested range has PriceLabs demand_desc
   in {'High Demand', 'Good Demand'}
4. ANY night falls within a known event window
   (NYE, MLK, Memorial Day, July 4, Lolla, Labor Day, Marathon,
    Thanksgiving, Christmas — sourced from a `pricing_events` config)
```

A 2-night couple's quiet-shoulder getaway skips this step entirely.
But a 12-person bachelorette, a Wedding inquiry of any size, a
birthday group, ANY high-demand date, or any event-weekend stay
triggers it — these are the cases where "how should I think about
this number?" is a real question worth slowing down for.

**Step copy (intro):** *"One more thing — what kind of weekend are you
going for?"*

(Not "Shape Your Stay" — too concierge-menu. The new copy sounds like
Abe texting you.)

**Tier cards** (interim generic copy until Abe defines real perks):

| Tier | Range | Description |
|---|---|---|
| **The Stay** | $3-5k | "The house, the hot tub, the weekend. Everything you need, nothing you don't." |
| **The Weekend** | $5-8k | "A little more thought built in. Welcome touches, flexible timing, curated recommendations." |
| **The Takeover** | $8-12k | "The house is yours and I build around you. Chef, bar setup, custom arrangements." |
| **The Whole Thing** | $12k+ | "Tell me what the weekend looks like. I'll make it happen." |

These names sound like Abe — escalation feels natural; "we're doing The
Takeover" is something a real bachelorette group would say out loud.
"We're doing the Elevated package" is not.

**Plus:**
- A free-text "Tell me what you're working with" input (for guests
  whose budget doesn't fit a bucket)
- A de-emphasized "Skip — just send me the quote" link

**Split-payment field, co-located on this same step** (Abe's idea):

```
Will your group split the payment?
  ( ) Yes — send individual payment links
  ( ) No — one person pays
  ( ) Not sure yet

If Yes: Split across [10] people  ← defaults to guest count, editable
```

Captures `split_intent: 'yes' | 'no' | 'maybe'` and `split_count`
(nullable, only if yes). The edit-the-default matters — "10 guests but
only 6 paying" is a real scenario.

**Why split-payment lives on this step (not later):**
- Surfaces a unique selling proposition (Airbnb doesn't offer this)
  before the guest sees the price — sets the stage for "this big total
  is actually $X per person"
- Captures intent data even if the guest skips the budget tier

**Data captured per inquiry**: `budget_bucket`, `budget_other_text`
(nullable), `split_intent`, `split_count` (nullable).

---

### §3.4 Deposit / hold-the-dates (Abe's idea — but secondary CTA, not primary)

Let the guest put down a deposit to hold the dates, pending Abe's
personal reply.

**Abe's framing:** "some sort of deposit/reservation thing."

**Why it matters:**
- Captures real willingness-to-pay (better than any self-reported
  budget)
- Reduces cancellation rate
- Signals seriousness so Abe prioritizes replies

**The deposit is the SECONDARY CTA, not primary.**

First-touch deposits are too aggressive for a single-operator STR
where trust is personal — the visitor just learned the price 2 seconds
ago; asking them to pay $1,500 immediately, before talking to Abe, is
a huge ask. It works for hotels (brand carries trust); doesn't work
for The Jackpot (trust is personal).

**CTA hierarchy on the success screen:**
1. **Primary**: "Message Abe" — preserves the personal brand, lets
   Abe close. Default path is conversation.
2. **Secondary**: "Hold these dates — $1,500 refundable deposit" —
   available for the ~10% of visitors already sold who want to lock
   it in.
3. **Tertiary**: Make-an-offer collapsed link (§3.6).

**Implementation (Phase B):**

`POST /api/deposits` → Stripe Checkout session → webhook updates
inquiry → Abe gets a high-priority notification. Refund policy:
fully refundable for 72h, then 50% non-refundable, then 0% inside
30 days of stay.

**Deposit amount:** flat **$1,500** across all stays for now. We
don't have enough booking volume to know where the breakpoints
should be. Optimize later with data. (Earlier draft proposed
tiered amounts; abandoned per agent feedback.)

---

### §3.5 Split payments with friends (Abe's idea)

Let the lead guest invite their group and split the payment across
members.

**Why this is genuinely differentiating:** Airbnb / VRBO don't offer
this natively. For 14-guest properties, payment collection is real
friction. Removes one of the biggest reasons groups bounce ("I have
to front $5,000 and hope everyone pays me back").

**Why it's expensive to build:** per-person tracking, Stripe Connect
or per-invoice arch, partial-payment-to-confirm logic, delinquent
nudges, refund-on-drop math, lead-guest UI, edge cases. Multi-week.

**Phased path:**
- **C.1 (manual-assisted, 0 code):** Abe uses Stripe Invoices for
  split-pay groups who ask. Measure demand.
- **C.2 (automated lite, ~1 week):** "Invite your group" flow with
  per-member Stripe Invoices via API.
- **C.3 (full, ~2-3 weeks):** automated reminders, refund-on-drop,
  per-member UI.

**Recommended start: Phase C.1.** Watch demand. Only invest in
C.2+ if splits are requested by ≥25% of inquiries.

(Note: the split-payment ASK on Step 4 — see §3.3 — ships in
Phase A and surfaces the feature even before fulfillment exists.
Captures intent data and signals differentiation.)

---

### §3.6 Appeal / make-an-offer flow (Abe's idea — collapsed by default)

Let the guest make their case if the quote is outside their budget,
instead of bouncing.

**This is the lowest-build, highest-signal idea in the set.**

**Implementation: a collapsed link below the CTAs.**

```
Not quite in budget? Let me know what works.    ← collapsed link
```

Tap to expand into a textarea with the prompt:

> *"If the numbers don't line up, tell me what you're working with.
> I'd rather know than lose you. — Abe"*

That last line — "I'd rather know than lose you" — is disarmingly
honest and creates reciprocity. The visitor thinks "this person is
being real with me" and is more likely to share their actual number.

**Why collapsed (not always-visible):**
- Always-visible signals "our prices are negotiable" to every visitor,
  including the ones who would have paid full price. That's revenue
  we're leaving on the table.
- Collapsed: the people who need it find it; the people who don't
  aren't influenced by it.

**Data stored:** `appeal_text` nullable column on `inquiries`. Abe
reviews appeals in his inbox and replies manually.

**Build cost:** low. A textarea + a column + Abe checks his inbox.

---

## 4. Willingness-to-pay framing

The tension at the core of guest budgeting:

| Approach | Pros | Cons |
|---|---|---|
| Upfront budget input (no value exchange) | Independent anchor signal | Feels interrogative; anchors guest low; hurts conversion |
| **Package-matching (value exchange)** | Guest feels they BENEFIT from sharing | Requires real perks per tier eventually |
| Deposit as commit | No guessing — they've paid | Higher barrier; skips explicit data capture |
| Make-an-offer text | Captures real WTP for price-sensitive guests | Only fires for dissatisfied leads |

**Recommended combo:**
1. Package-matching tier on Step 4 (when the conditional fires) —
   primary budget signal
2. Split-payment intent on the same Step 4 — secondary signal about
   group dynamics
3. Deposit as commit signal (Phase B) — strongest signal of all
4. Make-an-offer fallback (§3.6) — captures negotiation floor

**Signal matrix Abe can route by:**

| Behavior | Signal interpretation |
|---|---|
| Deposit paid | Ready to book; prioritize reply |
| Tier ≥ quote, no deposit | Budget-qualified; awaiting Abe's pitch |
| Tier < quote + no appeal | Price-sensitive; likely bounce |
| Appeal text submitted | Negotiation candidate; motivated |
| Skipped Step 4 entirely (allowed) or got conditionally bypassed | Browser; default-priority reply |

---

## 5. Proposed guest flow

End-to-end, stepwise. Two paths now exist due to Step 4 conditional.

### Step 1 — dates + email (unchanged)

Hero bar or mobile peek captures arrival, departure, email. Existing
implementation. Draft POST fires silently in background (already
shipped).

### Step 2 — "Checking" beat — hijacked for education (~2s)

Today this is a 1.5s starburst pulse. We extend it slightly to
~2s and use the additional time to surface real market context:

```
0.0-0.4s  [Starburst pulse]   "Checking availability..."
0.4-0.9s  [Insight card 1]    "High-demand weekend for homes like yours"
0.9-1.4s  [Insight card 2]    "4 comparable Chicago homes booked for these dates"
1.4-1.9s  [TEASER FRAME]      "Your savings"   [empty typographic frames]
1.9-2.0s  [Resolve]           "Your dates are available ✓" → advance
```

(Quote is computing in background during this beat — already shipped.)

**The teaser frame** uses empty typographic frames + gold hairlines —
NOT blurred numbers. Blur signals SaaS-pricing-gate ("we're hiding
because you won't like it"). Empty frames signal editorial
anticipation ("something is being prepared for you specifically").

```
┌───────────────────────────────┐
│  Your savings                 │
│                               │
│  On Airbnb:      ──────       │  ← gold hairline, no number yet
│  Direct to Abe:  ──────       │  ← gold hairline, no number yet
│                               │  
│                  ──────       │  ← gold hairline (= savings line)
│                                │
│  Calculating your quote...    │
└───────────────────────────────┘
```

Headers and labels stay crisp; numbers are simply absent (gold
hairline placeholders). When the success screen loads, the numbers
appear in their final positions — the framing was set up cleanly.

Accessibility: `aria-hidden="true"` on the frame; SR-only announcement
"Calculating your personalized quote."

### Step 3 — form (unchanged)

Captures: name, phone, guests count (1–14), reason chips, venue
(conditional, weddings only). Existing implementation.

### Step 4 — "What kind of weekend are you going for?" (NEW, conditional)

Renders only when ANY of these gates fires (see §3.3 for full list):
- `nights >= 3 && guests >= 6`
- `reason in ['Wedding', 'Bachelor/ette', 'Birthday']`
- ANY night flagged High/Good Demand by PriceLabs
- ANY night falls in a known event window

Otherwise, this step is skipped entirely — Step 3 submit advances
directly to the success reveal.

```
One more thing — what kind of weekend are you going for?

[ The Stay        $3-5k  ]  The house, the hot tub, the weekend.
                            Everything you need, nothing you don't.

[ The Weekend     $5-8k  ]  A little more thought built in.
                            Welcome touches, flexible timing.

[ The Takeover    $8-12k ]  The house is yours and I build
                            around you. Chef, bar setup, more.

[ The Whole Thing $12k+  ]  Tell me what the weekend looks like.
                            I'll make it happen.

💬 Tell me what you're working with [____________]

────────────────────────────────────────

Will your group split the payment?
  ○ Yes — send individual payment links
  ○ No — one person pays  
  ○ Not sure yet

[If Yes:] Split across: [10] people

[Continue →]   [Skip — just send me the quote]
```

### Success screen — the reveal

Mobile + desktop both load with: confirmation header, price reveal,
savings badge, primary + secondary CTAs. Everything else lives behind
tappable expanders.

**Default-visible (mobile + desktop):**

```
┌──────────────────────────────────────────┐
│  ✓ Your dates are available              │
│    May 22-25 · 3 nights · 10 guests      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │  $219                              │  │ ← 56px hero
│  │  per person per night              │  │ ← 14px immediately under
│  │  10 guests · 3 nights              │  │ ← 12px muted
│  │                                    │  │
│  │  ─────────                         │  │
│  │                                    │  │
│  │  $6,572 total for your group       │  │ ← 40px (1.4:1 vs hero)
│  │  $2,190/night                      │  │ ← small supporting line
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  💰 Saving $933 vs Airbnb's guest fees   │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ Message Abe                primary  │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  [ Hold these dates — $1,500 deposit ]   │
│                                                  
│  ─────────────────────────────────────   │
│                                          │
│  ▸ See full breakdown                    │
│  ▸ What I'm seeing for these dates       │
│  ▸ What's included                       │
│                                          │
│  Not quite in budget? Let me know what   │
│  works ▸                                 │
└──────────────────────────────────────────┘
```

**Typography ratio**: 56px / 40px (1.4:1 — not 2:1). Per-person-per-
night leads visually, but total doesn't feel hidden. "10 guests · 3
nights" sits IMMEDIATELY under the hero number with no whitespace
gap — that context line is what makes the small number real.

**Why per-person-PER-NIGHT instead of per-person-total:** smaller
unit, softer landing. $219/person/night reads as "reasonable luxury
rental" — comparable to a hotel-room split with friends. $657/person-
total still requires the brain to compute "for how many nights though?"
and feels heavier. Decompose all the way.

**Expandable sections** (tap to reveal):

- **See full breakdown** → nightly table + cleaning + tax line items
- **What I'm seeing for these dates** → 2-3 demand badges (real data
  only; see §6 for catalog)
- **What's included** → trimmed value stack, only direct-booking
  advantages (NOT property facts they already saw on the page)
- **Not quite in budget?** → make-an-offer textarea (§3.6)

**Edge-case rules for the reveal:**

- **Split-intent = "No, one person pays"** → flip hero: total becomes
  primary, "$219/person/night if you split" becomes secondary
- **Split-intent = "Not sure yet"** → per-person-per-night hero with a
  small toggle: "Prefer total?"
- **Custom split count** (10 guests, 6 paying) → use split count for
  per-person-per-night math: "$365/person/night across 6 payers"
- **Small groups (≤2) where per-person-per-night > $500** → total
  becomes primary automatically. Per-person loses its magic at that
  scale (a couple seeing "$500/person/night" gets no benefit from the
  decomposition; the total is the relevant frame for them).

**Sticker-shock safety valve** — see §11.5.

### Emails

Both guest confirmation and host notification carry a rendered version
of the same quote card. Host email adds glance lines below the
existing "📍 lead came from" banner:

> 💰 **Quoted: $6,572 total** · 3 nights · saved $933 vs Airbnb
> 🎯 **Tier: The Weekend** ($5-8k) · split across 10 guests

---

## 6. Narrative badge principles

Rules for what appears in the "What I'm seeing for these dates" expander
on the success screen:

- **Max 3 badges.** More feels cluttered.
- **Real data only.** No simulated counts, no made-up timers, no
  "X people viewing right now" scripts. See §7.
- **Date-specific.** "4 peer homes booked for **May 22-25**" not
  "4 peer homes booked recently."
- **Honest gating.** If PriceLabs flags the date as "Normal Demand,"
  don't slap a "High Demand" badge on it. If zero peers are booked,
  no peer-scarcity badge.
- **Suppress on weak fit.** A soft-demand shoulder weekend with no
  booked peers gets NO urgency badge. Substitute with trust-building
  badges: "Top 5% of Chicago homes," "190 five-star reviews," etc.

**Section heading**: "What I'm seeing for these dates" — Abe's voice,
not "About your dates" (data-dashboard tone).

**Canonical badge catalog:**

| Badge | Shows when | Copy template |
|---|---|---|
| Save vs Airbnb | Always, unless utm_source=airbnb | (already a default-visible badge — not in the expander) |
| High-demand weekend | `demand_desc` ∈ {High Demand, Good Demand} | "High-demand weekend" |
| Peer scarcity | ≥ 2 of 8 tier peers booked for these dates | "N comparable Chicago homes already booked" |
| Lead-time pressure | days-to-stay < (typical-peer-book-lead − 7) | "Homes in this tier typically book 30+ days ahead" |
| Recent market pickup | 7-day peer pickup > threshold | "N similar homes near you booked this week" |
| Top-tier endorsement | Always (trust) | "Top 5% of Chicago homes on Airbnb" |
| Verified reviews | Always (trust) | "4.97 rating · 190 reviews" |

Rendered badge set per success-screen visit selected by a small
rules engine, not all at once.

---

## 7. Why we won't spoof — and won't blur

Abe raised the idea of "slightly spoofing" demand signals in our favor.
Hard no, and the same logic also rules out blurred-number teasers.

### Don't fabricate signals

1. **Trust collapse when caught.** Sophisticated guests cross-reference
   across Airbnb / VRBO / direct. Fake urgency surfaces immediately.
2. **Review bombs.** "Felt pressured by fake urgency" reviews hurt
   ranking and conversion for months.
3. **Regulatory risk (minor).** FTC and state consumer protection laws
   target false scarcity claims.
4. **It's unnecessary.** Real signals are compelling: actual peer-booked
   counts (4 of 8 for Lolla, 2 of 8 for July 4 — confirmed by live
   probes), PriceLabs demand classifications, lead-time data.
5. **Brand alignment.** The Jackpot is "Abe replies himself." Fake
   urgency is mass-market booking-site energy.

**If a date has weak real signals**, don't fake — substitute with
trust/endorsement badges. The correct response to "this date isn't
hot" is "don't claim it is."

### Don't blur numbers either

Earlier draft proposed a blurred-number "your deal" teaser during the
checking beat. Killed per agent feedback. Same anti-deception logic:

- Blurred pricing has one association in this audience: SaaS pricing
  gates that say "talk to sales." That signals "we're hiding the price
  because you won't like it" — opposite of the transparent personal
  brand we've built.
- Blur + shimmer is booking.com energy. Empty typographic frames are
  editorial energy.

**Replacement**: empty frames with gold hairline placeholders where
numbers will appear. Sets up the comparison structure cleanly without
implying we're concealing anything. See §5 Step 2.

---

## 8. Anchor-and-release budget pattern

Step 4 tier selection captures pre-anchor budget signal (when the step
fires). Make-an-offer captures post-anchor real WTP for guests who
bounce on price.

Both signals coexist: Step 4 tier is the optional pre-anchor; make-an-
offer is the post-anchor real signal. Abe's reply uses whichever is
more informative.

For the simple-stay path (where Step 4 doesn't render), make-an-offer
is the only budget signal — and that's fine. Short-getaway booker
either accepts the quote or makes an offer. Either way, real data.

---

## 9. Phased build path

### Phase A — Quote presentation + budget step + make-an-offer (low build)

Ship the quote to the guest without payments or heavy infrastructure.

Scope:
- Render quote card on success screen with the new typography
  hierarchy (56/40 ratio, per-person hero)
- Empty-frame teaser during the Step 2 animation
- Conditional Step 4 ("What kind of weekend are you going for?")
  with tier cards + free-text + skip + split-payment field
- Render quote card in guest + host emails (extract shared renderer
  to `src/lib/email/quoteBlock.ts`)
- Direct-savings badge default-visible
- "What I'm seeing for these dates" expander with up to 3 real demand
  badges (gated)
- "What's included" expander (trimmed value stack)
- "See full breakdown" expander
- Make-an-offer collapsed link → expands into textarea
- Sticker-shock safety valve (see §11.5)
- Mobile progressive disclosure pattern
- Two CTAs: Message Abe (primary) + Hold these dates (secondary).
  In Phase A the deposit button is **visually rendered as a styled
  button but functionally inert** — clicking it shows an inline
  confirmation: *"Want to lock these dates? Tell Abe and he'll send
  you a payment link."* Click POSTs a `deposit_link_requested = true`
  flag to the inquiry row + sends Abe a higher-priority email. Phase B
  replaces the inert handler with real Stripe Checkout.

Files affected:
- `src/components/brand/BookingFunnelSteps.tsx` (new step + success
  screen restructure + conditional logic)
- `src/components/brand/BookingFunnelSteps.module.css` (new styles)
- `src/lib/email/quoteBlock.ts` (new shared renderer)
- `src/lib/email/guestConfirmation.ts` (use quote block)
- `src/lib/email/hostNotification.ts` (use quote block + glance lines)
- `src/app/api/inquiries/route.ts` (accept budget_bucket /
  budget_other_text / split_intent / split_count / appeal_text fields)
- `docs/supabase-migration.sql` (add the 5 new nullable columns to
  inquiries)
- PostHog instrumentation: separate funnel events for the conditional
  Step 4 path so we can compare conversion across the two paths

Build time estimate: 2-3 days end-to-end.

### Phase B — Deposit / hold-the-dates (medium build)

Scope:
- Stripe account setup + webhook signing secret
- `POST /api/deposits` endpoint that creates a Stripe Checkout session
- Stripe webhook handler that marks the inquiry as "deposit_held"
- "Hold these dates" CTA wires up to the session
- Return-from-Stripe success state
- Refund policy surfaced in a collapsible section
- Email updates to reflect deposit status
- High-priority Abe notification for deposits

Build time estimate: 3-5 days.

### Phase C — Split payments (high build)

Staged: C.1 manual via Stripe Invoices → C.2 automated lite → C.3 full.

---

## 10. Open questions

**Resolved (per agent feedback or recent decisions):**

- ~~Budget placement~~ → dedicated conditional Step 4
- ~~Demand signals to ship first~~ → both peer-booked + demand_desc,
  with display rules
- ~~Breakdown detail~~ → collapsed under "See full breakdown" link
- ~~Price gating~~ → always visible on success screen
- ~~Copy voice~~ → personal first-person Abe voice throughout
- ~~Edge-case declined demand~~ → trust badges fill the slot
- ~~Airbnb-sourced guests~~ → suppress savings badge entirely
- ~~Deposit refund window~~ → 72h fully refundable
- ~~Blur teaser style~~ → killed; empty frames replace blur
- ~~Teaser card label~~ → "Your savings"
- ~~Real-time inquiry count~~ → don't (violates no-spoof rule)
- ~~Per-night average on reveal~~ → include as small supporting line
- ~~Dynamic vs flat deposit~~ → flat $1,500
- ~~Tier names~~ → The Stay / The Weekend / The Takeover / The Whole Thing

**Resolved (additional batch, 2026-04-22):**

- ~~Step 4 thresholds~~ → expanded gate (4 conditions: nights+guests, reason
  including Birthday, demand-tag on any night, event window on any night)
- ~~Sticker-shock threshold~~ → $300/person/**night** (not per stay)
- ~~Hold-deposit Phase A behavior~~ → visible (rendered as a styled button)
  but functionally inert in Phase A; clicking it shows a small inline
  confirmation "Tell Abe to send you a payment link" that posts to the
  inquiry as a flag
- ~~Mobile expander~~ → custom JS smooth-slide (editorial feel justifies
  the small maintenance overhead)
- ~~Metrics baseline~~ → ship Phase A to all traffic; measure week-over-week
  deltas (no A/B at our traffic volume)

**Nothing currently open.** Phase A scope (§15) is build-ready.

---

## 11. Success metrics to watch post-Phase-A

- **Inquiry → deposit conversion rate** (when Phase B lands)
- **Make-an-offer submission rate** (higher = pricing too aggressive)
- **Direct-book vs Airbnb/VRBO split** over time
- **Tier-bucket vs quote-total distribution** (are guests landing in
  our band?)
- **Step 4 path vs simple path conversion delta** (does the
  conditional step help or hurt?)
- **Sticker-shock CTA engagement** (how often does "Suggest alternative
  dates" get tapped?)
- **Abe's reply time** (should stay same or improve with better-
  qualified inquiries)
- **Price-shock bounce rate** — bounce at success within 5s

---

## 11.5. Sticker-shock safety valve (NEW — agent's contribution)

The reveal is designed for the happy path. But what about the visitor
who sees a per-person-per-night rate that lands above a typical
luxury-rental anchor and thinks "that's a lot"?

Without intervention: excitement → reveal → deflation → scroll past
two CTAs they'll never tap → maybe find the make-an-offer field →
probably just close the sheet.

**The safety valve**: a contextual line that ONLY shows when the
**per-person-per-night** rate exceeds a threshold (initial:
**$300/person/night**, tunable via `pricing_config.alt_dates_threshold_cents`).

Math: trigger when `(perGuestCents / nights) >= 30000`. For a
10-guest, 3-night stay at $6,572 total, per-guest-per-night is $219 —
under the threshold, no nudge. For the same group with a $10,000 stay
quote (peak July weekend), per-guest-per-night is $333 — over the
threshold, nudge fires.

**Placement**: directly under the price card, above the CTAs.

**Copy:**

> *"Peak pricing for these dates. If your group has flexibility,
> weeknight stays or shoulder weekends often run 30-40% less. Want me
> to suggest some alternative dates?"*
>
> [Yes, suggest dates]

**Behavior on tap of "Yes, suggest dates":**

- Submits a flag on the inquiry row (`alt_dates_requested = true`)
- Triggers a higher-priority email to Abe — "this guest may be flexible,
  reach out with shoulder/weekday options"
- Shows confirmation: "Got it — Abe will reach out with options that
  fit your group."

**Why this matters:**
- Turns a sticker-shock bounce into a conversation
- Honest: we're not hiding the price or apologizing — we're saying
  "this is what these dates cost, but I can help you find something
  that works"
- Captures revenue we'd otherwise lose entirely (a $4,000 shoulder
  booking is infinitely better than a $0 bounce)
- Reinforces the personal brand — Abe finds them dates, not the
  algorithm

**Threshold tuning**: $300/person/night is the starting point —
roughly the upper edge of "comfortable group-rental" pricing per
person. Should be revisited with real data after 30 days. If we see
the nudge firing too often (>30% of inquiries) raise the threshold;
too rarely (<5%) lower it.

---

## 12. Open risks

1. **Price-shock bounces.** Showing a number may cause more drop-off
   than the current "Abe will reach out" flow. Mitigation: §11.5
   safety valve + warm framing + always-available make-an-offer.
2. **Tier anchoring suppressing revenue.** If guest picks "$5-8k" and
   quote is $7k, they lock in at $7k mentally — but might have paid
   $9k with better package framing. Mitigation: don't surface the
   bucket in Abe's reply copy; let Abe pitch up if appropriate.
3. **Conditional Step 4 confusion.** Some guests will get the step,
   others won't, based on dates/guests/reason. PostHog needs distinct
   events to measure. Mitigation: distinct funnel labels for the two
   paths.
4. **Deposit aggression.** Even as secondary, the deposit button might
   feel off-brand for The Jackpot. Mitigation: visually de-emphasize
   (text-button styling, not solid CTA) until Phase B proves out demand.
5. **Split-payment edge cases.** Phase A captures intent only. When
   fulfillment ships in Phase C, expect: refusals, re-splits, refund
   requests after partial payment. Mitigation: phase manually first.
6. **Demand signal over-claiming.** Even real signals can feel gimmicky
   if overdone. Mitigation: 3-badge max, aggressive display gates.
7. **Empty-frame teaser execution risk.** Done badly, gold hairlines
   look like a loading state from an unfinished prototype. Mitigation:
   the design agent owns the visual execution; needs a polished mock
   before we build.
8. **Abe's time savings don't materialize.** If the UX draws MORE
   inquiries (because the site feels more sophisticated), volume goes
   up. Mitigation: measure and re-evaluate after 30 days.

---

## 13. What's NOT in this doc

- Specific design/visual mockups (separate creative exercise — design
  agent owns)
- Final copy wording (iterate during Phase A build; current drafts in
  this doc are placeholders)
- Real package perks per tier (Abe's separate operational exercise —
  chef partner, bartender source, photographer, etc.). Tier copy in
  §3.3 is interim aspirational language until perks are defined.
- PostHog event instrumentation plan in detail (covered during
  implementation)
- A/B test framework (defer until Phase A is in prod)

---

## 14. Next step

Abe reviews this doc + the 5 still-open questions in §10. Once
settled, we scope Phase A as an implementation plan (separate plan
mode session) and build.

---

## 15. Phase A scope (build-ready outline)

This is the executable summary of what Phase A entails. Ready to be
the input to a separate implementation plan once Abe approves the
remaining open questions in §10.

### New components

- `<ShapeYourStayStep>` — conditional Step 4. Tier cards (4) +
  free-text input + skip link + split-payment Y/N + conditional
  numeric input for split count.
- `<QuoteRevealCard>` — the per-person hero + total + supporting line.
  Used on success screen and rendered to HTML for emails (shared
  source).
- `<TeaserFrameCard>` — empty typographic frames with gold hairlines,
  shown during Step 2 animation (~1.5-1.9s frame slot).
- `<InsightCard>` — single-insight card for the Step 2 animation
  (rendered 2-3 times in sequence).
- `<DemandBadges>` — rules-engine driven; renders 0-3 real demand
  badges based on data gates.
- `<ValueStack>` — trimmed; only direct-booking advantages.
- `<MakeAnOffer>` — collapsed link → textarea + send button.
- `<StickerShockNudge>` — conditional render when
  `(perGuestCents / nights / 100) >= alt_dates_threshold` (default
  $300/person/night).
- `<MobileExpander>` — generic tappable section for mobile progressive
  disclosure. **Custom JS smooth-slide animation** (not native
  `<details>`) — editorial feel justifies the small maintenance cost.

### Schema changes

```sql
alter table public.inquiries
  add column if not exists budget_bucket text
    check (budget_bucket in ('the_stay','the_weekend','the_takeover','the_whole_thing','other','skip')),
  add column if not exists budget_other_text text,
  add column if not exists split_intent text
    check (split_intent in ('yes','no','maybe')),
  add column if not exists split_count int check (split_count >= 1),
  add column if not exists appeal_text text,
  add column if not exists alt_dates_requested boolean not null default false,
  add column if not exists deposit_link_requested boolean not null default false;
```

Plus a `pricing_events` reference table for the Step 4 conditional
event-window check:

```sql
create table if not exists public.pricing_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  recurring_yearly boolean not null default true,
  active      boolean not null default true
);
-- seed: NYE, MLK weekend, Memorial Day, July 4, Lolla,
-- Labor Day, Marathon, Thanksgiving, Christmas
```

### `pricing_config` additions

- `alt_dates_threshold_cents` (default 30000 = $300 per person per night)
- `deposit_amount_cents` (default 150000 = $1,500)

### Routes / API

- `POST /api/inquiries` — accept new fields; surface `quote` in response
  for the success screen to render
- `POST /api/inquiries/[id]/alt-dates` — flag inquiry, trigger Abe alert
  (or fold into existing inquiries route via a new mode)
- `POST /api/inquiries/[id]/appeal` — accept appeal_text (or fold into
  finalize)

### Email templates

- `src/lib/email/quoteBlock.ts` — shared renderer used by both
  guest confirmation and host notification
- `src/lib/email/guestConfirmation.ts` — replace existing copy with
  rendered quote card + the 3 expanders rendered as inline sections
  (no JS in email)
- `src/lib/email/hostNotification.ts` — add quote glance line +
  tier/budget glance line + alt-dates flag if fired

### PostHog instrumentation

New events:
- `funnel_step_4_shown` (conditional render fired)
- `funnel_step_4_skipped`
- `tier_selected` (with tier value)
- `split_intent_selected` (with value)
- `quote_revealed` (with totalCents, perGuestCents, savedVsAirbnbCents)
- `make_an_offer_expanded`
- `make_an_offer_submitted`
- `alt_dates_nudge_shown` (per-person-per-night above threshold)
- `alt_dates_nudge_clicked`
- `deposit_button_clicked` (Phase A: triggers payment-link request flow)
- `deposit_link_requested` (server confirmed)
- `expander_opened` (with section name)

### Verification

End-to-end manual tests:
1. Short-getaway path: 2 guests, 2 nights, "Getaway" → Step 4 SKIPPED
   → success reveal direct
2. Bachelorette path: 8 guests, 3 nights, "Bachelor/ette" → Step 4
   FIRES → tier + split captured → success reveal includes per-person
   hero
3. Wedding path: any night count, "Wedding" → Step 4 FIRES regardless
4. Sticker-shock path: pick dates with high per-person rate → confirm
   nudge appears; tap "Suggest alternative dates" → confirm Abe gets
   the high-priority email
5. Make-an-offer path: tap collapsed link → expand → submit → confirm
   `appeal_text` saved, Abe gets email
6. Email rendering: send a test inquiry through prod → confirm quote
   card renders in Gmail / iOS Mail / Outlook
7. Mobile progressive disclosure: open success screen on iPhone →
   confirm only the 4 default-visible sections render above the fold
8. PostHog: confirm all 10 new events fire with correct properties
