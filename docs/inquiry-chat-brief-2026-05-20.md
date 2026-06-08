# Conversational Inquiry — Design & Status Brief

**Date:** 2026-05-20
**Surface:** `/chat` (alternative landing for testing the new flow)
**Audience:** A collaborating agent who hasn't seen this work yet. Read straight through.

---

## 1. Why this exists

The current booking flow (live at `/`) is a fixed form: date pickers + email → modal → group/occasion/budget fields → quote. It works, but every guest gets the same identical sequence, and the experience feels like filling out a form to qualify for a quote.

We're testing a different premise: **the inquiry should feel like a chat with a real concierge.** A guest lands on the page, picks an intent, and the experience unfolds in a conversational thread — Olivia (the concierge persona) asks one thing at a time, the guest answers, and committed answers stack into the chat history. The same data ends up captured, but the framing shifts from "qualify yourself" to "let me match you to the right setup."

The two pieces we're iterating on are loosely independent:

- **UX/UI of the conversation** — the surface guests see (this brief)
- **The agent's actual responses** — Olivia's voice, knowledge, handoff logic (separate workstream, not built yet — scripted today)

This brief covers the UX/UI side only.

---

## 2. Where it lives

### Route
- `/chat` — the alternative landing page. Hero-only (no other landing sections), so we can iterate on the inquiry experience in isolation.
- The production landing (`/`) still uses `HeroSection` + `HeroBookingBar` (the old form-based flow). Untouched.

### Files

| File | Role |
|------|------|
| `src/app/chat/page.tsx` | Route entry — renders only `<HeroChatSection />` |
| `src/components/sections/HeroChatSection.tsx` + `.module.css` | Hero shell: wordmark, tagline, trust strip, price caption, photo carousel — same identity as the main hero, but with `<InquiryChat />` in place of the date+email booking bar |
| `src/components/brand/InquiryChat.tsx` + `.module.css` | **State 1** card — Olivia greeting + 3 commitment-ordered chips + free-text input fallback. Sits inline in the hero. |
| `src/components/brand/InquiryChatThread.tsx` + `.module.css` | **State 2+** — fullscreen mobile `<dialog>` that opens when the guest taps a chip. Houses the entire conversation thread, the date picker, contact form, group/occasion widget, and pricing pill. |
| `src/components/brand/Calendar.tsx` + `.module.css` | Existing date-picker; extended with an `inline` prop so we can drop it into the thread body (in addition to its original popover use in `HeroBookingBar`). |

All visual tokens come from `/brand/tokens/brand.css` (no hardcoded colors, fonts, spacing, or radii). See `/brand/docs/design-system.md` for the rules.

---

## 3. The flow — visual walkthrough

The whole experience is **mobile-only** for now. Desktop chip taps are no-ops (we'll design that variant in a later round). Everything below is what a mobile guest sees.

### Entry: the InquiryChat card (inline in hero)

When a guest lands on `/chat`, they see the full brand stack (wordmark → tagline → 14-sleeps strip → "From $620/night · 2-night minimum") and below it a white chat card:

```
┌─────────────────────────────────────┐
│  ⓞ  Olivia                          │
│      ● Active 2 min ago             │
├─────────────────────────────────────┤
│  Browsing for the group? I can      │
│  help, or just send you what you    │
│  need.                              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Check dates & price       → │   │ ← primary, gold-tinted
│  │ Get a real number in 30s    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Send this to my group     → │   │
│  │ No commitment — link + pics │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Save for later            → │   │
│  │ I'll text you when ready    │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Or ask anything…              ↑   │
└─────────────────────────────────────┘

  Or use the booking form instead →
```

- **Three chips ordered by commitment**, primary = "Check dates & price" (we currently want to push this as the suggested path).
- **Free-text fallback** at the bottom — input + send button — for guests who'd rather just type.
- **"Or use the booking form instead →"** as a soft fallback to the legacy form.

Tapping **Check dates & price** on mobile opens the fullscreen chat thread. The other two chips are inert (planned for later rounds).

### Once expanded: the InquiryChatThread (fullscreen)

A native `<dialog>` slides up and fills the viewport. The shell is consistent across all subsequent states:

```
┌─────────────────────────────────────┐
│ ←  ⓞ  Olivia                        │ ← sticky header, back arrow
│       ● Active now                  │
├─────────────────────────────────────┤
│                                     │
│  [chat history scrolls here]        │
│                                     │
│  [the active "step block" lives at  │
│   the bottom of the history]        │
│                                     │
├─────────────────────────────────────┤
│  Or type your dates…           ↑   │ ← sticky composer
└─────────────────────────────────────┘
```

- **Back arrow** (top-left) closes the dialog and returns to State 1. ESC + native back gesture also work (free from `<dialog>`).
- **No wordmark inside the dialog** — the dialog is a focused conversation surface; brand identity stays underneath, softened by a warm backdrop blur.
- **Composer is always sticky-bottom.** Placeholder text changes per step ("Or type your dates…" → "Or ask anything…"). Send is wired but inert (no parser yet).

---

## 4. The four steps in detail

The thread runs through four states. State changes are committed actions; phase reveals within a state are timed drip-feeds. Every committed action becomes a permanent user bubble in the chat history.

### Step 1: `dates` — pick a stay window

What the guest sees inside the thread body:

```
                          [Check dates & price]   ← user bubble (echoes the chip)

 ⓞ  Cool — what weekend? Pick anything
     and I'll pull a real number.

 ┌─────────────────────────────────┐
 │ ARRIVAL     │ DEPARTURE         │
 │ Pick a date │ Pick a date       │
 ├─────────────┴───────────────────┤
 │  [inline month calendar]        │
 │   S M T W T F S                 │
 │   …                             │
 └─────────────────────────────────┘
```

- **Two summary chips** (Arrival / Departure) sit above an inline calendar. Tapping a chip refocuses the calendar to the matching field.
- **Calendar reuses** the existing `Calendar.tsx` in `inline` mode — no popover, no portal, just a flow element. Full month grid with prev/next nav, range-hover preview, 2-night minimum, today-floor.
- **Pick arrival → focus auto-advances to departure.** If arrival is later changed in a way that invalidates departure, departure clears.
- **Pick departure → commits the range and moves to step 2 `checking`.** The calendar block collapses; a `Jun 20 – Jun 22` user bubble takes its place.

### Step 2: `checking` — availability check + contact capture

This is the longest step and where the drip-feed pattern was first established. Four phases (`CheckingPhase: 0|1|2|3`) reveal sequentially after the departure pick:

**Phase 0 — 0ms** (immediate):
- User bubble lands: `May 20 – May 22` (whatever range was picked).
- Olivia "typing" dots appear underneath (three pulsing gold dots in a linen bubble).

**Phase 1 — 800ms**:
- Typing dots replaced by Olivia's first reply, with the long date format:
  > "Got it — Wed, May 20 to Fri, May 22. Pulling availability + pricing now…"
- **Availability pill** fades in below: a small gold-tinted pill with three pulsing dots and the text "Checking the calendar…"
- A second typing-dots bubble appears under the pill (Olivia "writing" her next message while the pill keeps spinning).

**Phase 2 — 2300ms**:
- Second typing dots replaced by Olivia's follow-up (italic — it reads as an aside):
  > *"While I look — where can I reach you? In case we get disconnected, I'll send the full answer your way."*
- The pill keeps spinning (it's a long-running indicator across the whole step, not a per-message thing).

**Phase 3 — 3000ms**:
- Contact form widget fades in. Three fields:
  - **Name** (text, optional but encouraged)
  - **Email** (required, lightly validated client-side)
  - **Phone** (tel, marked "optional" inline)
- Single primary button at the bottom: **"Save my info"** (gold gradient pill).
- Save enabled when email passes the lightweight check (has `@` and a `.` after it).

**On save** → step 3 `available`. Form unmounts; a compact user bubble + sage success line take its place (see step 3).

Phase delays are tuned constants in `CHECKING_PHASE_DELAYS`:
- `typingOne: 800` (0→1)
- `beatToTyping: 1500` (1→2)
- `beatToForm: 700` (2→3)
Total drip-feed: ~3 seconds from departure pick to form visible.

### Step 3: `available` — confirmed open + gather group/occasion

The first thing that happens when step transitions to `available` is the **contact form collapses** into history:

```
                      [Marcus Johnson · marcus@example.com]   ← compact user bubble

 ✓ Got it — the answer will land in your inbox too.     ← sage success line, italic-feel
```

- The user bubble joins name, email, and phone with middle dots. Empty fields are skipped (no dangling separators).
- The success line uses sage tokens (`--jp-sage-10` bg, `--jp-sage-deep` text + tick fill) so it reads as a system confirmation, not a chat message.
- These two pieces persist as history — they don't disappear when later steps add more content.

Then two reveal phases (`AvailablePhase: 0|1|2`):

**Phase 0 — 0ms**:
- Olivia typing dots.

**Phase 1 — 800ms**:
- Olivia's good-news reply lands. **First name is used if we captured one**:
  > "Good news, **Marcus** — Wed, May 20 to Fri, May 22 is wide open. Two quick things so I can pull your most accurate price: *your group size and what you're celebrating.*"
- If no name was provided, the greeting collapses to `"Good news — "` (no comma, no name). The personalization is intentional and used sparingly — only this beat for now.

**Phase 2 — 1700ms**:
- **Group + occasion widget** fades in:

```
 ┌─────────────────────────────────┐
 │ HOW BIG'S THE GROUP             │
 │ ( 6–8 )  ( 9–11 )  ( 12–14 )    │
 │                                 │
 │ WHAT'S THE OCCASION             │
 │ ( Bachelor )( Bachelorette )    │
 │ ( Wedding )( Other )            │
 │                                 │
 │ ┌─────────────────────────────┐ │
 │ │       Continue              │ │ ← disabled until both groups selected
 │ └─────────────────────────────┘ │
 └─────────────────────────────────┘
```

- **Single-select per group** — tapping a chip selects it (gold-tinted bg, gold-deep text), tapping another in the same group switches the selection.
- **Continue button** is gold-gradient, disabled until both groups have a pick.
- Tapping Continue → step 4 `pricing`.

Phase delays in `AVAILABLE_PHASE_DELAYS`:
- `typing: 800` (0→1)
- `beatToWidget: 900` (1→2)

### Step 4: `pricing` — mocked check, awaiting price reveal

On Continue, the widget collapses into another compact user bubble:

```
                          [12–14 guests · Bachelor]   ← user bubble

 ┌─────────────────────────────────────┐
 │  ⦿⦿⦿  Pulling pricing now…         │ ← same checking pill, different text
 └─────────────────────────────────────┘
```

- **The same animated pill** used for availability is reused for pricing — consistent visual language.
- **No price reveal yet.** This is the natural next step (mockup State 6 — "matched fit" price card with toggles and CTAs).

---

## 5. Established design patterns

These patterns are the templates we'd extend for future states (price reveal, post-quote CTAs, etc.):

### Pattern: drip-feed reveal
- Each step has a phase machine (`CheckingPhase`, `AvailablePhase`).
- A `useEffect` keyed on `step` schedules timers to advance phases.
- Each new block fades + lifts in via `.fadeIn` (320ms ease-out).
- Typing-indicator bubbles bridge between Olivia messages so the conversation reads as live composition.
- **Reduced-motion is honored** — jumps straight to the final phase, no animations.

### Pattern: commit-and-collapse
- Every committed answer (dates, contact, group/occasion) collapses its widget into a compact summary user bubble.
- Bubble formats use middle dots (`·`) as separators for multi-field summaries.
- Collapsed history accumulates — older bubbles never disappear.
- No "edit" affordance yet — guest can use the composer or back out to fix.

### Pattern: animated indicators
- **Typing dots** — three gold-deep dots in a linen-bg bubble, staggered `checkingPulse` keyframe (1.1s, 160ms offsets).
- **Checking pill** — same dot animation but as a horizontal pill with text, gold-tinted bg. Used for both availability and pricing waits.
- These share the `checkingPulse` keyframe — one animation language across the surface.

### Pattern: persona personalization
- **First name** from the contact form (`firstNameOf(contactName)`) is dropped sparingly into Olivia's copy.
- Used once today, in the "Good news, [Marcus] —" beat. We'd add 1–2 more touch points in later states but keep it rare so it doesn't feel performed.
- Falls back to non-name phrasing when we don't have a name.

### Pattern: form-card visual family
- The date block, contact form, and group/occasion widget all use the same card shell:
  - `1px solid var(--jp-border-default)`
  - `border-radius: var(--jp-radius-md)`
  - `padding: 12-14px`
  - `background: var(--jp-bg-primary)`
- Field labels are 10px, weight 600, letter-spacing 2.4px, uppercase, in `--jp-text-secondary`.
- Primary action button uses the `--jp-gradient-button` gradient pill.

### Pattern: brand-token-only colors
- No hardcoded hex anywhere in the inquiry surface. Every color references a `--jp-*` token.
- The mockup HTML used some custom browns (`#3a2806`, `#c97b16`, etc.) — these were all mapped to brand equivalents (warm olive, gold-deep, etc.) on the way in. **No black anywhere.**

---

## 6. What's mocked / not built

This is a UX/UI prototype. None of the following has real wiring yet:

| Piece | Today | Real |
|-------|-------|------|
| Availability check | Always passes after a fake ~3s wait | Real API call against the property's calendar |
| Pricing | Always shows the spinning pill, never reveals a number | API → live nightly + cleaning + dynamic price |
| Contact persistence | Stays in local React state only | POST to Supabase + sync to VenueMBA CRM |
| Free-text composer | Inert — clears draft on send | LLM-driven Olivia response, parsing dates from text |
| Olivia's replies | Hardcoded strings in JSX | LLM-driven, persona-tuned, knowledgeable about the property |
| Share / Save chips (State 1) | No-op | Share = SMS/clipboard handoff with property link + pics; Save = collect phone + text-when-ready opt-in |
| Desktop | Chip tap on `>900px` does nothing | Desktop variant of the expanded thread — TBD |

The hardcoded copy is intentionally placeholder. The voice should be tuned together with whatever LLM stack we land on.

---

## 7. Technical notes for the agent

If you're going to suggest visual or interaction changes, here's what's worth knowing:

- **Component architecture**: `InquiryChat` (inline card) → on chip tap, opens `<InquiryChatThread />` as a sibling. The thread is a fullscreen `<dialog>` rendered into the same React tree.
- **State machine**: one `Step` enum + per-step phase counters. All state is local to `InquiryChatThread` — no context, no store. State resets every time the dialog reopens.
- **Auto-scroll**: a `useEffect` keyed on `[step, checkingPhase, availablePhase]` scrolls the body to the bottom whenever new content appears. Deferred via `requestAnimationFrame` so layout settles first.
- **No analytics yet**. PostHog is set up project-wide but we haven't wired the inquiry flow into it. Each state transition is an obvious event to capture (`inquiry_step_advanced`, `inquiry_contact_saved`, etc.).
- **The Calendar component** is shared with the production booking bar. The `inline` prop is additive — desktop popover behavior is unchanged.
- **`<dialog>` semantics** give us focus trap, ESC, and body scroll lock for free. The backdrop has `backdrop-filter: blur(6px)` (warm olive overlay).
- **iOS safe areas**: composer padding uses `env(safe-area-inset-bottom)` so the input doesn't sit behind the home indicator.

---

## 8. Open questions & known limitations

Stuff worth discussing or designing for:

1. **Desktop variant.** Today's chip click is a no-op on `>900px`. Options: (a) modal in the center of the viewport with the same thread shell, (b) right-side drawer that pushes the hero left, (c) an inline-expanding card that grows in place. No call yet — deferred until mobile feels right.

2. **Editing committed answers.** No "edit" affordance on the collapsed bubbles. If a guest typos their email or picks the wrong group size, today they have to back all the way out (which resets everything) or text Olivia in the composer (which is currently inert). Probably worth either: an "edit" pencil on each summary bubble that re-expands its widget, or letting the composer handle "actually I meant 9–11".

3. **Share / Save chips on State 1.** Both are inert. The Share path probably needs to capture a phone (or email) and ship a templated message; Save needs phone + opt-in. Neither has been designed yet.

4. **Olivia's voice.** Every reply is currently a hardcoded string. The whole flow should eventually be LLM-driven — taking the guest's free-text into account, handling edge questions ("can we bring a dog?"), and knowing when to hand off to a human (Abe). The widgets stay; the connective copy gets generated.

5. **The free-text composer.** Today it accepts input and clears on send — no parsing, no Olivia response. The most leveraged near-term win is probably parsing date phrases ("memorial day weekend") and group counts ("we're 11 guys") into widget pre-fills.

6. **Availability = false case.** We've never built the "those dates are not available" path. Mockup didn't include it. Probably: Olivia says "those specific nights are taken — here's what's open near them" + a small "alternates" widget with 2–3 nearby ranges.

7. **The pricing pill's perpetual spin.** Step 4 (`pricing`) ends with the pill spinning forever because the price-reveal widget isn't built. Mockup State 6 is the reference for what should land next: a price card with a "Matches your range" sage badge, a `$2,850 – $3,200` headline, a per-person breakdown, optional add-on toggles (Thursday early, hot tub), and two CTAs ("Send this to my group", "Have Abe text me").

8. **Mid-flow handoff.** If a guest abandons mid-conversation, what happens? The contact info is captured at step 2, so we already have a way to reach them — but we haven't designed the recovery message (text vs email, when to fire, what to say).

9. **Loaded state vs. cold state.** A guest who's been here before — should we remember them? The legacy funnel uses a `funnel-draft` localStorage hook to resume. We could do the same here, or treat each visit as fresh.

10. **Sparing-ness of first-name use.** Today we use the first name exactly once. Should we also use it at: the pricing-pill text ("Pulling pricing for you, Marcus…"), the eventual price reveal ("Here's your setup, Marcus —"), or never beyond the one good-news beat? Open call.

---

## 9. How to see it

```bash
npm run dev
# open http://localhost:3001/chat in a mobile viewport (or DevTools mobile emulation, ≤900px)
# tap "Check dates & price"
# pick any two dates ≥2 nights apart
# fill in the contact form (email required, name + phone optional)
# pick a group size and an occasion → Continue
```

State persists for the life of the dialog; backing out resets everything.

---

## 10. Asks from the collaborating agent

If you're reviewing this brief, the most useful feedback is on:

- **Pacing of the drip reveals** — does ~3s for the checking step feel right, too long, too short?
- **Where else (and how often) the first name should land** without becoming saccharine
- **The Share / Save chip experiences on State 1** — these are blank slates right now
- **The availability = false branch** — both copy and visual
- **Visual choices in the State 4 widget** — chip count, label tone, whether Continue is the right pattern vs auto-advance, whether the "this helps me pull your most accurate price" framing in Olivia's preamble lands

Anything else you spot is welcome. Bring it back as a list of concrete changes (with rationale) and we'll work through them together.
