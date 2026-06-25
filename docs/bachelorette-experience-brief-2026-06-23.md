# The Jackpot — new bachelorette journey: current state + where we want thinking

Date: 2026-06-23
Audience: an external Claude browser agent helping us think about the
**bachelorette page specifically**. This doc is self-contained, you do not
need prior context. It describes the experience we have built so far (the
new journey, the UI, how it works) and ends with the open questions we
want help on.

Companion doc: `docs/bachelorette-hero-brief-2026-06-21.md` (the hero
design brief). This one is the broader journey + current state.

---

## 1. What The Jackpot is
A luxury short-term-rental home in Chicago (sleeps 14, 5 BR, 3 BA, hot
tub/spa, cinema, game room/bar, fire pit, supper club). We are pivoting to
**direct booking** and selling an **all-inclusive bachelorette weekend**,
not a nightly-rate house. Bachelorette is ~77% of inquiry demand and is
the whole brand positioning. The strategic moat: we own the home AND
curate the experiences around it, so we compete on togetherness +
per-person value + curation, never on nightly price.

Brand is warm and light: gold, linen, warm olive. Display font Cormorant
Garamond, functional font Outfit. Hard rules: no black, no cool colors
(no blue/gray/silver), warm/light always, no dashes of any kind in copy.

---

## 2. The new journey (end to end)

### Step 1 — Marketing traffic lands on `/batch`
"Batch" is a paid lead channel (~$430/mo, ~43% of leads, currently
0-conversion, the reason for this whole funnel). Their traffic hits
`/batch?utm_source=batch`. UTM is captured and persisted (localStorage,
30 days).

### Step 2 — The occasion screen (`/batch`)
A single deliberate question before anything else. This screen is a
**deep warm near-black "reveal moment"** (a documented exception to the
otherwise warm/light brand). It asks **"What is the occasion?"** with the
sub "One tap and we'll tailor everything to it."

Layout is one column, **1 → 2 → 2 → 2 → 1**, one shape language, three
weights:
- **Bachelorette** — full-width gold gradient hero card (dominant).
- Three pairs of crisp gold-hairline cards: Birthday / Bachelor, then
  Group trip / Getaway, then Reunion / Just a good time.
- **Something else** — quiet full-width footer that opens a free-text
  input.

Sharp 8px corners, gold hairline outlines on near-black (jewelry-box
feel). A staged entrance animation plays on load (wordmark types out
large and docks to a header, the body rises into place).

Tracking: `occasion_screen_viewed` on mount, `occasion_selected` on tap,
written to a Supabase `landing_event` table (deduped by an anon cookie,
internal test traffic flagged). This is how we will measure bounce per
occasion.

### Step 3 — Tapping Bachelorette: the confetti send-off
Tapping Bachelorette fires a **confetti fountain**: a burst erupts from
one point at center, fills the screen, sticks ~0.5s, then the dark
backing fades to reveal the page behind while the confetti cascades off
the top. It then routes to **`/bachelorette`**. (Every other occasion
does a quick fade and routes to `/chat?occasion=<value>` instead.)

### Step 4 — The bachelorette page (`/bachelorette`) — THIS IS THE FOCUS
A dedicated page with a bespoke **rose-gold hero** that flows straight
into the Olivia chat card. Desktop is a 60/40 split (content left, photo
column right); mobile stacks (content, then a feature photo).

Current hero contents (left column):
- Kicker: "The Chicago bachelorette"
- The Jackpot wordmark
- Italic tagline: "Her last weekend single, the whole crew under one roof."
- Stat strip: 14 sleeps · 5 BR · 3 BA · 5.0 ★ 47
- Value line: "Sleeps 14 · less per person than a block of hotel rooms"
- The embedded **Olivia chat card** (see step 5)

Right column: a photo carousel led by the spa and supper club (then
parlor/bar, cinema, fireside).

Palette: a **scoped rose-gold theme** (rose/coral/blush + gold/peach),
applied so the shared chat components inherit rose accents without being
re-skinned. The hero ships **static** (the confetti is the entrance; our
motion budget is reserved for a future sticky scroll-reveal).

### Step 5 — The Olivia chat card (entry)
A compact card: "Olivia" (host persona, "Active 2 min ago"), a one-line
opener, three commitment-ordered chips, and an "ask anything" free-text
input:
1. **Check dates & price** — "Get a real number in 30 seconds"
2. **Send this to my group** — "No commitment. Just the link plus photos."
3. **Reserve now, nothing due** — "Hold your dates, no payment today"

Tapping a chip (or sending text) opens the full conversation, carrying
the intent and `occasion=bachelorette`.

### Step 6 — The full conversation (`/chat/session`)
A full-screen conversational inquiry with "Olivia" (an LLM agent harness).
The flow: pick dates (inline calendar) → availability check → group size
+ occasion (occasion is **pre-seeded to bachelorette**, so this is
skipped) → contact capture (name/email/phone) → a short "qualify beat"
(where they are in the hunt, who decides, budget per person) → a **staged
price reveal** (header → the dream + photos → value pillars → reviews →
the number → breakdown) → then either **reserve** (hold the dates,
nothing due now, schedule a call with Abe) or **share** (mint a group link
to a /trip page).

Key product rules baked in:
- **Reserve now, nothing due** is the core anti-drop-off mechanic.
- **Olivia never negotiates or hard-quotes**; she diagnoses budget +
  occasion, explains value (per-person, per-night), and defers the price
  decision to Abe.
- Value framing and which reviews show are **tailored by occasion**
  (bachelorette pulls bachelorette-relevant proof).
- The whole thread is **rose-gold themed** for the bachelorette flow.

---

## 3. How it works (technical, brief)
- Routes: `/batch` (occasion screen) → `/bachelorette` (hero + chat card)
  → `/chat/session` (full thread). Non-bachelorette occasions →
  `/chat?occasion=<value>`.
- The occasion is threaded through the URL and pre-seeds the chat thread's
  occasion state; "back" from the thread returns to `/bachelorette`.
- The rose-gold theme is a set of inline CSS custom properties
  (`bachThemeVars`) that retint the shared `--jp-gold` accent toward rose
  and expose `--jp-bach-*` tokens. Applied on the hero and on the chat
  session when occasion=bachelorette. Body text stays warm olive.
- The hero is built bachelorette-first but compositionally generic, the
  intent is to generalize it into a reusable `InquiryHero` so birthday /
  group pages can reuse it with different content + theme.
- The conversation is driven by `/api/inquiry-agent/*` endpoints (turn,
  quote, reserve, share). Pricing is real (PriceLabs-backed).

Key files (for reference, do not need to read to ideate):
`src/app/batch/page.tsx`, `src/app/bachelorette/page.tsx`,
`src/components/sections/BacheloretteHero.tsx`,
`src/components/brand/InquiryChat.tsx`,
`src/components/brand/InquiryChatThread.tsx`,
`src/components/brand/bachTheme.ts`, `src/app/chat/session/page.tsx`.

---

## 4. Where the experience stands
- The journey works end to end: occasion screen → confetti → bachelorette
  hero → chat card → full conversation, all pre-seeded and rose-themed.
- The bachelorette page today is **hero + chat only**. There is no
  additional "selling" content on it yet (no gallery section, no
  "what's included", no testimonials, no all-inclusive tiers).
- The all-inclusive bachelorette **product** (a free base layer + three
  tiers + a la carte add-ons) is the direction but is **not yet surfaced**
  anywhere on this page.

---

## 5. What we want help thinking about (the bachelorette page)
These are open. We want your thinking, not code.

1. **Is "hero into chat" the right shape, or does `/bachelorette` need a
   real landing experience?** If the latter, what sections, in what order,
   to sell a bachelorette weekend? (e.g. the weekend narrative, what's
   included, the spaces/gallery, social proof, per-person math, the moat).
   Remember the goal is conversion for a group organizer who is comparing
   us to hotels and generic rentals.
2. **The all-inclusive product.** How and where should the free base layer
   + 3 tiers + a la carte add-ons show up on this page (or in Olivia's
   flow) without turning it into a pricing menu that undercuts the
   "defer price to Abe" stance?
3. **Hero art direction.** Pink-forward vs gold-forward; should the chat
   card surface tint rose or stay linen; photo treatment (clean vs a
   rose/gold wash); how loud the lockup should be; tagline + copy.
4. **How bachelorette-specific should Olivia get?** Her opener, the value
   pillars she leads with, the proof she shows, the qualify questions.
5. **What converts a bachelorette organizer specifically?** The emotional
   job (planning the bride's weekend, not chasing 9 friends for money),
   and how the page + chat should speak to that.

### Guardrails (do not violate)
- Warm/light only, no black, no cool colors.
- Cormorant Garamond (display) + Outfit (body), never swapped.
- Rose/gold/peach are display/large-text only; body copy stays warm olive.
- No dashes of any kind in any copy.
- Reserve-now-nothing-due is the CTA spine. Olivia defers price to Abe.
- Hero ships static (motion budget reserved for a later scroll-reveal).
