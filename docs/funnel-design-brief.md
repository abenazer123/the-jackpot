# Booking Funnel — Design Brief for Polish & Redesign

> Companion document for design audit. Pair this with the screenshots
> Abe is capturing manually. Together they should give a design agent
> enough context to propose targeted polish, redesign individual states,
> or critique the experience end-to-end without ever touching the repo.

---

## Purpose

The Jackpot is a luxury 14-guest group home in Chicago. The booking
funnel is the highest-value surface on the site — it's how a coordinator
goes from "interesting Instagram link" to "I sent the price to my group
chat." This brief documents:

1. **The strategic frame** that drives every UI decision
2. **The brand system** — non-negotiable design rules
3. **The architecture** — how the funnel is composed across surfaces
4. **Each step in detail** — copy, conditional logic, animation, code
   refs, and the *why* behind every choice
5. **Recent decisions** — what we just shipped and the rationale
6. **Known gaps** — what's deliberately deferred and why

If something in the design feels off after reading this brief, that's
a real signal — it means our intent and the execution have drifted.
Flag it.

---

## Section 1 — The strategic frame

**The coordinator is the sales channel, not the customer.**

Every visitor to the funnel is planning on behalf of a group of 7–14
people (bride + her people, family reunion, work retreat, milestone
birthday). The visitor isn't booking *for themselves* — they're
*selling the trip to their group* and need ammo to do it.

This means every artifact (page, email, button) gets judged against one
question:

> *"Would Rossiter feel more confident sending this to her group chat?"*

Things that PASS this test:
- A clear per-person price ("$121/person/night, $362 for the weekend")
- A property hero photo with all 14 sleeping spots visible
- A line she can paste verbatim ("Saving $719 by booking direct")
- A direct line to a real human who replies fast

Things that FAIL this test (and we should be careful about):
- "Make an offer" / appeal flows — useful to her, useless to group chat
- Generic "luxury hospitality experience" copy — doesn't help her sell
- Anything that requires authentication / account creation before
  the group sees it

This frame influences nearly every decision in this brief.

### Strategic context — research findings that drive the design

(Excerpted from `docs/pricing-strategy.md`. Not exhaustive — just the
points that shaped the funnel UI.)

- **Don't gate the price.** For bookings under $8k, never hide the
  number. Showing the exact price tested as the highest-converting move.
  Caveats like "final pricing may vary" read as evasive.
- **Personalize the CTA.** "Message Abe" outperforms generic CTAs by
  42-202%. Real first name, used when context (Abe's photo + bio) has
  already been established earlier on the page.
- **Foot-in-the-door escalation.** Each micro-commitment increases
  conversion at the final step. We use this in the Shape Your Stay
  step and in the per-step funnel structure.
- **Specific reasons feel honest.** "Lollapalooza takes Grant Park
  this weekend" outperforms "peak pricing for these dates" because
  generic phrasing reads as surge-pricing evasion.
- **Per-person framing wins for coordinators.** Total is what they need
  to budget; per-person is what they paste into the group chat.

---

## Section 2 — Brand system (non-negotiable rules)

These are hard rules. Anything that violates them needs to be flagged.

> Source of truth: `/brand/docs/design-system.md` and `/brand/tokens/brand.css`.

### Color

- **Text:** warm olive `#7a6030` (`--jp-text-primary`). **NEVER** black,
  `#333`, or any cool gray.
- **Accent / display:** gold `#d4a930` (`--jp-gold`), gold-deep
  `#c49025` (`--jp-gold-deep`), peach, sage. These are display/large-text
  ONLY — they fail WCAG AA for body copy.
- **Surfaces:** linen / off-white tones (`--jp-linen` `#faf6ef`,
  `--jp-bg-primary`). **NEVER** dark backgrounds.
- **Borders / shadows:** warm olive at low opacity
  (e.g. `rgba(122, 96, 48, 0.14)`). **NEVER** cool gray shadows.
- **No blue, no silver, no pure white.** The brand is always warm.

### Typography

- **Display:** Cormorant Garamond (italic at 500 weight is the signature
  treatment). Used for: headings, hero numbers, italic flourish copy
  ("you found something special"), the price hero.
- **Body / function:** Outfit. Used for: form fields, CTAs, secondary
  meta, eyebrows.
- **Eyebrows:** ALL CAPS, 9-10px, letter-spacing 2.4px, gold-deep color.
  Used to signal "this is a section label."
- **Never swap them.** Cormorant for vibe, Outfit for function.

### Spacing & shape

- Border radius: rarely sharp corners. Buttons + cards = `--jp-radius-md`
  (12px), pills + bottom sheets = `--jp-radius-full`.
- Animations: subtle, 160-320ms ease curves. Nothing snappy.
- Gold gradients (gold → peach) are the "moment" treatment — used
  sparingly on primary CTAs and submit buttons.

### Tokens reference

- CSS variables: `/brand/tokens/brand.css` — imported at app root
- TypeScript: `/brand/tokens/tokens.ts`
- Tailwind: tokens mapped via `@theme inline` in `globals.css`
  (e.g. `text-jp-gold`, `bg-jp-linen`, `font-display`, `font-body`)

---

## Section 3 — Funnel architecture

```
┌─────────────────────────────────────────────────────┐
│  ENTRY SURFACES                                     │
│   • HeroBookingBar  (top of homepage, always)       │
│   • StickyBookingBar (peek tab + sticky bar)        │
│     - peek mounts on scroll past hero               │
│     - opens funnel via tap                          │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  SHELLS (one or the other based on viewport)        │
│   • BookingPricingModal  (desktop, ≥768px)          │
│   • BookingBottomSheet   (mobile, ≤767px)           │
│                                                     │
│  Both wrap the same <BookingFunnelSteps/> child     │
│  via native <dialog> for free focus-trap, ESC, etc. │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  BookingFunnelSteps — 4 steps + success             │
│                                                     │
│   Step 1: collect   → date pickers + email          │
│   Step 2: checking  → 4 beats (pulse → reveal)      │
│   Step 3: form      → name, phone, guests, occasion │
│   Step 4: shape     → conditional Shape Your Stay   │
│   Success:                                          │
│     - QuoteReveal      (price computed)             │
│     - No-quote fallback (PriceLabs unavailable)     │
└─────────────────────────────────────────────────────┘
```

### Files at a glance

| Concern | Path |
|---|---|
| Hero entry | `src/components/brand/HeroBookingBar.tsx` |
| Sticky / peek entry | `src/components/brand/StickyBookingBar.tsx` |
| Desktop shell | `src/components/brand/BookingPricingModal.tsx` |
| Mobile shell | `src/components/brand/BookingBottomSheet.tsx` |
| Steps / beats / quote | `src/components/brand/BookingFunnelSteps.tsx` |
| Steps CSS | `src/components/brand/BookingFunnelSteps.module.css` |
| Date field | `src/components/brand/DateField.tsx` |
| Calendar | `src/components/brand/Calendar.tsx` + `.module.css` |
| Funnel draft (localStorage) | `src/lib/funnel-draft.ts` |
| Chicago events lookup | `src/lib/chicagoEvents.ts` |
| Pricing types | `src/lib/pricing/types.ts` |
| Inquiry submit | `src/app/api/inquiries/route.ts` |
| Guest email | `src/lib/email/guestConfirmation.ts` |
| Host email | `src/lib/email/hostNotification.ts` |

---

## Section 4 — Entry surfaces

### Hero booking bar (`HeroBookingBar.tsx`)

Top of homepage. Three fields stacked on mobile, side-by-side on
desktop:

- **Arrival** date pill (opens Calendar popover)
- **Departure** date pill (opens Calendar popover)
- **Email** text input

Submit button: **"Check availability"** (or **"Continue where you left
off →"** if the guest has a draft saved). Below the button: a
`HostPresence` row showing "Abe was online 2m ago" with a green dot.

Pricing note above the fields: "From $620/night · 2-night minimum."

**Conditional logic:**
- On mount, `readDraft()` populates fields from localStorage.
- If all three fields prefilled, `resumed=true` flips the CTA to
  "Continue where you left off →".
- Picking arrival auto-opens departure calendar (150ms delay) AND
  clears stale departure if it's now before `arrival + 2 nights`.
- On submit, the appropriate shell (modal or bottom sheet by viewport)
  opens at Step 2 (checking) since dates + email are already filled.

**Why these exact fields:** dates and email are the minimum information
to compute a quote. Name/phone/etc. happen later. This keeps the
"barrier to first action" tiny.

**Critical UX detail — the auto-open:** picking arrival immediately
auto-opens the departure picker on the right month (`min` =
`arrival + MIN_NIGHTS`). Without this, picking an arrival 6 months out
would show today's month with everything disabled — forcing 5 chevron
clicks to reach the first valid date. Bug we just fixed in this batch.

### Sticky booking bar / peek (`StickyBookingBar.tsx`)

After scrolling past the hero, a peek tab slides in from the bottom
(mobile) or attaches to the top (desktop). Tap opens the funnel at
**Step 1 (collect)** because nothing has been collected yet.

The peek displays:
- "Abe was online" presence dot
- "Check dates for pricing"
- "See the price guide" CTA

**Why a peek vs. just a sticky CTA:** the peek gives the visitor a sense
of what's coming ("price guide," "Abe is online") before they commit to
opening the funnel. Lower-friction than a hard CTA.

---

## Section 5 — The two shells

### `BookingPricingModal.tsx` (desktop)

Native `<dialog>` element. Centered card, ~480px wide, warm linen
background, soft gold-tinted shadow. Backdrop blur (warm-tone, not gray).

- Animates in: 220ms cardIn (translateY + opacity)
- Close button: top-right, icon only, hover state goes gold
- Children: `<BookingFunnelSteps/>` mounted only when `open=true`
  (deliberately — see "Recent decisions" below)

### `BookingBottomSheet.tsx` (mobile)

Same pattern as the modal but styled as a bottom sheet that slides up
from the viewport bottom. Drag handle at the top (cosmetic, not
functional — no swipe-to-dismiss yet).

- Animates in: bottom-anchored slide
- Close: tap backdrop, ESC, or close button
- Children: `<BookingFunnelSteps/>` mounted only when `open=true`

Both shells are mutually exclusive — `HeroBookingBar` and
`StickyBookingBar` use `useEffect` + `matchMedia("(max-width: 767px)")`
to render exactly ONE of these per breakpoint. (Until recently both
were always mounted — fixed this batch.)

---

## Section 6 — Step 1: Collect

Identical to the hero booking bar but inside the modal/sheet shell.
Shown when the visitor enters via the sticky peek (which doesn't
prefill anything).

Heading: **"Let's check your dates."** (italic Cormorant)

Sub-headline: removed in current copy.

Same `DateField` + email input pattern as hero. Submit button text
changes based on what's filled.

**Skip logic:** if the funnel is opened with arrival, departure, AND
email already provided (e.g. from the hero), Step 1 is skipped entirely
— the funnel mounts at Step 2.

---

## Section 7 — Step 2: Checking beats

The "thinking" sequence between Step 1 submission and Step 3 form.
4 beats, ~3.5 seconds total, designed as a *considered cadence* —
not a loading spinner.

```
  Beat 1 — Pulse
  "Checking availability…"   (gold starburst pulses 2x)

  Beat 2 — Insight
  Italic Cormorant 1-line, e.g.
  "Pulling rates and the calendar for these nights."

  Beat 3 — Teaser
  Empty-frame card with placeholder rows:
   PER-PERSON       ─────
   GROUP TOTAL      ─────
  (shimmer hairlines on each value)

  Beat 4 — Reveal
  Gold "checkmark" with a glow.
  "Your stay is confirmed available"
  Range copy: "Jun 19 → Jun 22 · 3 nights"
```

**Timing:**
- Insight at 900ms
- Teaser at 1800ms
- Resolve at 2900ms
- Advance to Step 3 at 4100ms

**Why the cadence is this length:** earlier we had a 2.5s total
playout — too fast to register, read as a flicker. We stretched it to
~4 seconds to give the visitor time to actually *read* each beat.

**Animation philosophy:**
- The 4 beats render as sibling layers inside a `.beatStack` (absolute
  positioning) and cross-fade between each other (parent-layer opacity
  transitions).
- *Inside* the active beat layer, per-element entrance animations also
  fire — the insight slides in with a translateY, the teaser card
  enters with a fade-up, etc. This is keyed off `.beatActive .X`
  selectors so animations restart each time a layer becomes active.
- Inactive layers stay quiet (no animation, no transform).

**Why this matters strategically:** the visitor needs to feel that the
system is "working for them." A static loading spinner would be the
wrong move. The beats earn the price by performing consideration.

**Reduced-motion fallback:** all animations gated by
`@media (prefers-reduced-motion: reduce)` go to `animation: none`. The
beats still cycle but without movement.

**Code:**

```tsx
// Roughly the JSX structure
<div className={styles.beatStack}>
  <div className={`${styles.beatLayer} ${beat === "pulse" ? styles.beatActive : ""}`}>
    <div className={styles.pulseWrap}><Starburst .../></div>
    <p className={styles.checkingText}>Checking availability…</p>
  </div>
  <div className={`${styles.beatLayer} ${beat === "insight" ? styles.beatActive : ""}`}>
    <div className={styles.insightCard}>
      <p className={styles.insightText}>Pulling rates and the calendar…</p>
    </div>
  </div>
  <div className={`${styles.beatLayer} ${beat === "teaser" ? styles.beatActive : ""}`}>
    {/* empty-frame teaser card */}
  </div>
  <div className={`${styles.beatLayer} ${beat === "resolve" ? styles.beatActive : ""}`}>
    {/* checkmark + reveal range */}
  </div>
</div>
```

---

## Section 8 — Step 3: Form

The "real form" step. Collects name, phone, guest count, and an
occasion chip.

Heading: **"A few details for your pricing guide"** (italic Cormorant)

Fields:
- **Name** (text input in pill-shaped container)
- **Phone** (tel input)
- **Guests** (native `<select>` styled to match the pills, with a custom
  SVG chevron overlaid)

Occasion chips (radio group, ALL CAPS eyebrow + chips below):
> Birthday · Anniversary · Wedding · Bachelor/ette · Family trip · Work
> retreat · Getaway · Other

If "Other" selected, a free-text "venue/notes" field appears.

Submit: **"Send my pricing guide"** (gold gradient pill, full-width)

Below submit:
- A subtle consent line ("By submitting you agree to receive…")
- Any submission error (red, italic-ish, brief)

**Conditional logic:**
- The form is required to be valid before submit enables.
- A draft POST has already fired during Step 2 (so by the time the
  guest reaches Step 3, we have a draft inquiry id and a quote
  already computed in many cases — submitting just finalizes).
- After submit, advances to either Step 4 (Shape) or Success
  depending on the gate.

**Strategic note:** chips are deliberately specific (Wedding,
Bachelor/ette etc) because the chosen chip changes downstream
behavior. Wedding/bach/birthday trip the Shape Your Stay gate;
"Other" doesn't.

---

## Section 9 — Step 4: Shape Your Stay (conditional)

Only renders when ANY of these are true:
- `nights >= 3 AND guests >= 6`
- Reason in {wedding, bachelor/ette, birthday}
- Dates fall in a high-demand window (server-checked)

Heading: **"One more thing — what kind of weekend are you going for?"**
(italic Cormorant)

Sub-headline: "So I can build the right weekend."

The form has two parts:

### Part A — Tier picker (radio group, "tierGroup")

Three or four cards, each showing a budget bracket and a one-line
blurb. Examples (currently placeholders):

| Tier | Range | Blurb |
|---|---|---|
| The Essentials | $X–$Y | One-liner |
| The Upgrade | $X–$Y | One-liner |
| The Takeover | $X–$Y | One-liner |
| The Whole Thing | $X–$Y | One-liner |

Active tier gets a 3px solid gold left edge (pull-quote treatment),
linen-mid background, gold border. The card is a real `<button>` so
keyboard navigation works.

### Part B — Split-pay question

Eyebrow "ONE MORE THING" + two yes/no cards:

> Are you splitting payment with the group?
> — Yes, splitting → asks for `splitCount`
> — Just me → flips `totalLeads` framing on the quote screen

### Skip option

A subtle text link below: **"Skip — just send me the quote"** —
preserves the foot-in-the-door pattern (you get the data if she's
willing) without making it a hard gate.

**Why this step exists:** research-supported foot-in-the-door pattern.
Each micro-commitment increases conversion at the final step. We get
budget signal AND split-pay intent that lets us tailor the quote
display.

**Strategic note:** picking a high tier ("The Takeover", "The Whole
Thing") flips a flag that *suppresses* the alt-dates nudge on the
quote screen — if the guest already self-selected into a high-budget
tier, suggesting "weeknights are 30-40% cheaper" reads as
patronizing.

---

## Section 10 — Success: Quote Reveal

The most important screen in the funnel. This is what the coordinator
looks at, decides about, and shares to the group chat. Read this
section carefully.

### Layout (top to bottom)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  $342           ← per-person/night, 56px Cormorant  │
│  per person per night                               │
│  7 guests · 3 nights                                │
│  ───────────                                        │
│  $7,183                                             │
│  total for your group       ← 36px Cormorant       │
│  $2,394/night                                       │
│                                                     │
│  ✓ You're saving $1,020 by booking direct           │
│  vs. 7 hotel rooms at $250/night × 3 = $5,250       │
│  (only renders when hotel total > quote × 1.20)    │
│                                                     │
│  [Optional] Premium-dates nudge:                    │
│   "These are premium dates — Lollapalooza takes     │
│    Grant Park that weekend." (italic Cormorant)     │
│   OR fallback: weeknight/shoulder-weekend offer     │
│   with "Yes, suggest dates" inline link button.     │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ I'm interested              ← gold gradient │    │
│  └─────────────────────────────────────────────┘    │
│  A real reply from Abe — usually within the hour.   │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ Hold these dates — $1,500 refundable deposit│    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ────────────────────────────                       │
│  ▸ The details                                      │
│   (expander, contains tabs: Breakdown / Included)   │
│  ────────────────────────────                       │
│  ▸ If the numbers don't line up, I'd rather hear    │
│    from you than lose you. — Abe                    │
│   (expander, italic Cormorant, contains an appeal   │
│    text form)                                       │
│  ────────────────────────────                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### The price hierarchy (per-person leads)

For a coordinator audience:
- **Hero number = per-person/night** (`.quoteHero`, 56px italic Cormorant)
- **Secondary number = total** (`.quoteSecondary`, 36px italic Cormorant)
- Both have demoted `$` glyph (60% size, top-aligned) so digits
  dominate.

There's also a `totalLeads=true` branch that flips this — used when
"just me" is selected on the split-pay question or per-person rate is
extremely high. In that branch, total becomes the hero and per-person
becomes secondary.

**Why per-person leads:** the coordinator doesn't text "$7,183" to the
group chat. They text "$342/person/night, $1,026 each for the
weekend." Per-person is the number that gets 11 yeses.

### CTA stack — recent rework worth noting

```tsx
<button onClick={handleInterest} disabled={interestSent}>
  {interestSent ? "Got it — Abe will be in touch" : "I'm interested"}
</button>
<p className={styles.ctaSubhead}>
  A real reply from Abe — usually within the hour.
</p>
<button onClick={onDepositRequest} disabled={depositRequested}>
  {depositRequested
    ? "Got it — I'll send a payment link"
    : "Hold these dates — $1,500 refundable deposit"}
</button>
```

- Primary "I'm interested" fires a PostHog event (`primary_cta_clicked`)
  with the quote details, then flips the button label to "Got it —
  Abe will be in touch" for 1.5 seconds, then closes the modal.
  Inquiry email already fired upstream — this button is the
  acknowledgement, not the send.
- Subhead lives outside the button so the label stays short. Italic
  Cormorant, 13px, secondary text color, tight letter-spacing.
- Deposit CTA is the secondary action — explicitly framed as
  "refundable" + "hold" (defuse commitment anxiety).

### Hotel anchor (comparison line)

Renders below the savings line ONLY when:
```ts
hotelTotalCents > totalCents * 1.20  // 20% advantage threshold
```

Copy: `vs. {guests} hotel rooms at $250/night × {nights} nights = ${total}`

For Naina's 7-person stay, hotel math = $5,250, quote = $7,183 → hotel
is CHEAPER, line stays hidden (correct — only show when it flatters
us). For a 14-person stay, hotel math = $10,500 → far above the quote
→ line renders.

### Premium-dates nudge

Two variants:

**Event-specific** (when stay overlaps a known Chicago event):
> *"These are premium dates — Lollapalooza takes Grant Park that
> weekend and the whole city books up."*

(No alternative-dates offer — for event weekends, alternatives
defeat the purpose.)

**Generic fallback** (premium pricing, no event match):
> *"These are premium dates — weeknight stays and shoulder weekends
> often run 30–40% less. Want me to suggest alternatives?"*
>
> [Yes, suggest dates] → fires `alt_dates_requested=true`, the
> system surfaces it to Abe, and the screen flips to a confirmation:
> *"Got it — I'll reach out with options that fit your group."*

**Gate:** only fires when `perPersonNight >= $300` AND budget tier is
NOT "the_takeover" or "the_whole_thing" (high-tier guests already
know it's expensive — suggesting cheaper feels patronizing).

**Event sources:** `src/lib/chicagoEvents.ts` — static lookup of 10
high-demand windows (Lollapalooza, Marathon, NASCAR, Air & Water Show,
Memorial Day, Labor Day, July 4, NYE, St. Patrick's, graduation
season). Order matters — most-specific first wins.

### "The details" expander

Single drawer with two tabs (Breakdown / What's included). Replaces
the older two-stacked-expanders design.

- **Breakdown tab:** dashed-line nightly breakdown (one line per
  night), cleaning fee on its own dashed line, taxes if applicable,
  bold total at bottom.
- **What's included tab:** value-stack list with gold ✓ glyphs:
  *No platform fees · Split-pay across the group · Direct line to
  Abe · Flexible check-in*

Tab swap fades the panel content (140ms cross-fade) — keyed remount
of `.tabPanel` div.

**Expander mechanic:** controlled `<button aria-expanded>` (not
native `<details>`) so we can smooth-slide on open/close. The panel
animates `max-height` from 0 to measured `scrollHeight`, then after
the open transition completes (320ms + 40ms safety) we set
`max-height: none` so internal layout shifts (textarea growth, tab
swaps) don't get clipped.

### "Personal note" expander (italic Cormorant)

> *"If the numbers don't line up, I'd rather hear from you than lose
> you. — Abe"*

Italic Cormorant header — visually different from the functional
"The details" expander. When opened, reveals a textarea + small
submit button:

> "Tell me what works for your group — budget, dates, anything. I
> read every one."
>
> [textarea]
>
> [Send to Abe]

After submit: confirmation message, textarea hidden.

**Strategic intent:** the premium-dates nudge handles the dates
conversation; this expander handles the *budget* conversation
(without requiring the visitor to pick a tier on Step 4). Bachelorette
groups especially have a delicate "this is more than we expected" moment
— this gives them a graceful exit that keeps Abe in the loop.

### Accordion behavior

Both expanders share a single-open accordion: opening one closes the
other. Prevents stacked open content from drowning out the quote card
itself.

---

## Section 11 — No-quote success fallback

When PriceLabs returns "unavailable" for the picked dates (block,
booked, transient API error), the funnel still finalizes the inquiry
but skips the QuoteReveal. Instead:

> *"I'll send your personalized quote to **{email}** within the day."*
>
> [In the meantime, keep exploring →]

**Known issue:** the auto-confirmation email currently promises *"your
personalized pricing guide lands in your inbox within minutes."* But
on the no-quote path, no follow-up email fires — Abe handles it
manually. So the email makes a promise the system doesn't keep.
Documented in "Known gaps."

---

## Section 12 — Cross-cutting decisions

### Calendar (`Calendar.tsx`)

Brand-styled month-grid popover, portal-rendered into `document.body`
or the open `<dialog>` (so it joins the top layer above the modal
backdrop).

- **Initial month** prefers `value || min || today` — so if `value` is
  empty, it falls back to `min` (e.g. arrival+2 nights for departure).
- **Range-hover bar** when picking departure: cells between arrival
  and the cell under the cursor get a soft gold tint with an outlined
  arrival anchor and a pill-shaped hover end cap. Box-shadow extends
  the tint across the 2px grid gap so it reads as a continuous bar.
- **Disabled state:** cells before `min` are dimmed and not clickable.
- **Mobile:** below 900px the calendar pins as a fixed bottom sheet
  via media query — overrides the desktop trigger-anchored
  positioning.

### Funnel draft persistence (`funnel-draft.ts`)

Every field the visitor fills (dates, email, name, phone, guests,
reason) writes to `localStorage` via `writeDraft({...})`. Read on mount
in HeroBookingBar. Cleared on successful finalize.

**Why:** returning visitors get a "Continue where you left off →" CTA
instead of an empty form. The funnel feels like it remembers them
even if they bounced and came back days later.

**Edge case:** picking a new arrival that makes the existing departure
invalid (departure < arrival + MIN_NIGHTS) clears departure (state
+ draft) so the auto-opened picker lands on the right month.

### Animations (philosophy)

- Default duration: 160-220ms ease curves (`var(--jp-transition)`
  resolves to `200ms ease`).
- Step transitions: 300ms `stepEnter` (translateY + opacity).
- Beat cross-fade: 280ms opacity (parent layer) + per-element entrance
  animations on the active layer.
- Tab swap inside details: 140ms `tabFadeIn` (keyed remount).
- Expander panel: 320ms `max-height` ease.
- Reduced motion: all `animation` rules become `animation: none` under
  `prefers-reduced-motion: reduce`.

### Accessibility notes

- All interactive elements are real `<button>`s (we replaced native
  `<details>` with controlled buttons specifically to support a11y +
  smooth animation).
- `aria-expanded` on every expander summary; `aria-controls` linking
  to the panel's `id`.
- Tabs use `role="tab"` / `role="tabpanel"` / `role="tablist"`.
- Calendar dates use `aria-label="YYYY-MM-DD"` for screen readers.
- Focus rings are visible (gold 2px outline with 2px offset).
- Reduced motion fully supported.

### Mobile vs. desktop

The shells are different (centered modal vs. bottom sheet) but the
**funnel content inside is identical**. Mobile-specific tweaks:
- `.row2` flips from `1fr 1fr` grid to single column at ≤640px
- `.checking` min-height drops from 260 → 220px
- Calendar pins as bottom sheet at ≤900px

### State management

- React local `useState` everywhere — no Redux, no Zustand, no
  context for funnel state.
- Cross-surface persistence via `localStorage` (`funnel-draft.ts`).
- API state (quote, inquiry id) lives in the funnel's local state
  during the single visit.

---

## Section 13 — Recent decisions (this batch)

For context on what just shipped and why, in case the design agent
sees something that looks "new" or under-polished.

### CTA rename + subhead
- Was: "Message Abe" (button), no subhead.
- Now: "I'm interested" (button) + italic subhead "A real reply from
  Abe — usually within the hour."
- Why: research showed time-promise CTAs lift conversion 200%+. Visitor
  on a quote screen is past "interested" mentally, but the button
  language makes the commitment feel active. Subhead delivers the
  promise without making the button label long.

### CTA acknowledgement state
- Was: button did nothing on click (inquiry email had already fired
  upstream).
- Now: click flips label to "Got it — Abe will be in touch", fires
  PostHog `primary_cta_clicked`, closes modal after 1.5s.
- Why: "I'm interested" reads as an active commitment — empty onClick
  was misleading. Now the click visibly does something.

### Hotel-room comparison anchor
- New copy line below the Airbnb savings line.
- Gates: only when `hotelTotalCents > totalCents * 1.20` (20%
  advantage). Hides for small groups where comparison would be
  unflattering.
- Why: "vs. 14 hotel rooms at $250/night = $10,500" reframes a $5k
  group quote as a savings story for the coordinator's group chat.

### Event-specific premium-dates nudge
- New file: `src/lib/chicagoEvents.ts` — 10 known Chicago events.
- Replaces generic "peak pricing" copy with specific reason ("Lolla
  takes Grant Park that weekend").
- Suppresses the alternative-dates offer for event weekends (those
  groups can't shift).
- Why: research found generic phrasing reads as evasion. Specific
  reasons read as honest.

### Calendar fixes
- Departure picker auto-opens on the right month (was: opens on
  today's month, requiring chevron clicks).
- Range-hover bar for departure picker shows the stay length forming.
- Stale departure clears when arrival moves it out of range.

### Expander mechanic rebuild
- Replaced native `<details>` with controlled `<button>` + animated
  `<div>`. Native couldn't smooth-slide on open/close.
- Single-open accordion behavior across the success-screen expanders.
- Tab swap inside "The details" gets a soft cross-fade.
- Panel `max-height` releases to "none" after open animation
  completes — handles textarea growth without clipping.

### Mobile-bottom-sheet wiring for hero
- Was: hero CTA always opened the centered desktop modal, even on
  mobile.
- Now: hero CTA opens the proper `BookingBottomSheet` on mobile.
- Why: consistency with the sticky bar (which already did this).

### Funnel-only-mounts-when-open
- Was: both modal and bottom sheet always mounted their
  `<BookingFunnelSteps/>` child, leading to two funnel instances in
  the DOM at once.
- Now: each shell renders the child only when `open=true`.
- Why: a11y (screen readers traversed both), analytics (events fired
  twice), perf (two beat-orchestrator timeouts).

### Step 2 cadence stretch
- Was: 2.5s total — read as a flicker.
- Now: ~4.1s total, beats hold long enough to actually read.
- Why: the beats are supposed to be "considered cadence," not a
  loading spinner.

---

## Section 14 — Known gaps and deferred work

The design agent should know these EXIST so they don't propose
solutions for problems we already know about.

### "Send this to your group" — DEFERRED
The single highest-leverage feature we don't have. Research-driven
strategic frame says the coordinator's hardest job is selling the
trip to her group of 11. We need a public, share-friendly artifact
designed for the group chat (not a funnel page). Mechanic still
TBD — could be a roster + "I'm in" social-proof page, a split-pay
landing, or a "save your bed" interactive floor plan. Owner (Abe)
wants this to be a "win people one by one" experience.

### Email redesign for forwarding — DEFERRED
Current confirmation email is a receipt. Should be a forwardable pitch
document with property photos, per-person math, sleeping arrangements,
and the share link. Plumbing change required (email currently doesn't
receive the `Quote` payload). Aware. Backlog.

### No-quote email path — KNOWN BUG
Auto-confirmation says "your personalized pricing guide lands in your
inbox within minutes" regardless of whether the quote computed. On the
no-quote path, no follow-up email fires. The promise is broken. Need
to either remove that line or add a no-quote-specific email.

### Event date verification
Lollapalooza, NASCAR Street Race, and Air & Water Show 2026 dates in
`chicagoEvents.ts` are estimates from recent-years patterns. They need
verification against official announcements before each event season.

### Per-person price gate calibration
Premium-dates nudge fires at `perPersonNight >= $300`. Threshold may
be too low for high-end groups, too high for budget groups. Worth
revisiting with funnel data.

### Step 4 tier blurbs and ranges
Currently placeholder copy. Real per-tier perks (private chef
arrangements, transportation packages, decor add-ons, etc.) need to
be locked in. Not a design issue per se, but the empty tiers feel
under-developed.

### Cleaning fee transparency
The $475 cleaning fee currently appears only in the breakdown. Some
guests are surprised. Worth considering whether to surface it in the
quote card itself.

### "Hold these dates" deposit flow
The button fires `onDepositRequest` which sets a flag the server
sees. Currently does NOT trigger an actual Stripe / payment-link send
— Abe sends the link manually. The flow should eventually be
self-service.

---

## Section 15 — Code reference index

For when the design agent wants to dig into specific behavior:

| Question | Where to look |
|---|---|
| How do beats progress? | `BookingFunnelSteps.tsx` ~line 320 (the `useEffect` with `tInsight/tTeaser/tResolve/tAdvance`) |
| How does the Expander animate? | `BookingFunnelSteps.tsx` `function Expander({ ... })` ~line 1220 |
| What CTA event do we fire? | `BookingFunnelSteps.tsx` `handleInterest` ~line 1360 |
| How is the hotel anchor gated? | `BookingFunnelSteps.tsx` `showHotelAnchor` constant ~line 1340 |
| How does the event nudge match? | `src/lib/chicagoEvents.ts` `eventForDates` |
| How does the calendar pick initial month? | `Calendar.tsx` ~line 75 (the `initial` IIFE) |
| What does the API actually do? | `src/app/api/inquiries/route.ts` (draft + finalize handlers) |
| What's in the email today? | `src/lib/email/guestConfirmation.ts` |

---

## Section 16 — What I want from the design agent

Concrete asks, in priority order:

1. **Audit each canonical state against this brief.** Where does the
   execution drift from the intent? Be specific — file path, line range,
   suggested change.
2. **Identify polish opportunities** that would lift coordinator
   confidence to forward-to-group-chat. Examples that would qualify:
   typography hierarchy on the quote card, micro-animation timing,
   empty/loading state quality, focus-state visibility.
3. **Flag accessibility issues** I haven't already documented.
4. **Critique the strategic frame** if the execution suggests we've
   misread the visitor. ("Coordinator-as-sales-channel" assumes a
   particular user shape — does the funnel actually serve her?)
5. **Propose a redesign** of any state that's clearly under-considered
   (Step 4 tier picker is a likely candidate — currently placeholder).
6. **Don't propose** the "Send to your group" feature or the email
   redesign — those are owned and deferred.

When you find something worth changing, structure the proposal as:
- **What you observed** (state, screenshot ref, file:line)
- **Why it doesn't serve the strategic frame** (or what brand rule it
  breaks)
- **A concrete proposal** (revised copy, new layout, animation tweak)
- **What success would look like**

Keep proposals tight. I'd rather have 5 sharp critiques than 25
suggestions.
