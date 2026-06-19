# Batch Funnel Brief — Occasion Screen + Bachelorette Landing

**Started:** 2026-06-18
**Owner:** Abe
**Status:** LIVING DOC. We add to this as we decide. Current focus: the
occasion screen on `/batch` and its tracking. Next up: the options we
show, what each click does, where it routes, then the bachelorette
landing page itself.

---

## 0. How to use this

This is the running plan for the Batch entry experience. Settled
decisions go in §2-§4. The agenda we have not worked through yet lives in
§5 and is what the next conversations fill in. Nothing here is built yet.

Related: the strategic pivot ([[direct-booking-pivot-to-all-inclusive]]),
value positioning, and Batch attribution all sit in memory; the Olivia
intake rebuild shipped (see `docs/olivia-intake-flow-brief-2026-06-16.md`).

---

## 1. Why this exists

- **The pivot:** sell an all-inclusive Chicago bachelorette weekend, not a
  house at a nightly rate. The page's job is to communicate an experience
  and start a concierge conversation.
- **Batch is effectively the whole paid channel:** ~$430/mo, ~45 deduped
  leads/quarter, ~82% of real leads, and **0 conversions** to date.
- **The blind spot:** we have NO first-touch visibility today. PostHog is
  not wired to the Jackpot site, and the inquiries table only contains
  people who already became a lead, so it cannot tell us how many hit
  `/batch` and bounced. We genuinely don't yet know if the loss is pre or
  post inquiry.
- **The occasion screen does double duty:** it routes people to a tailored
  page AND becomes our first-touch measurement instrument (bounce rate +
  the real occasion mix). That measurement value is what justifies putting
  a screen before the landing page despite the added step.

---

## 2. Settled decisions

### 2.1 The occasion screen is the first thing on `/batch`
A single question ("what are you celebrating?") with tappable option
cards. On tap, route to the matching landing page. The bachelorette page
is the one we build first and fully curate.

### 2.2 Tracking backend = Supabase, not PostHog (for this metric)
We track the occasion screen in our own Supabase, and surface it in the
existing `/admin/marketing` tab. Reasons:
- The marketing dashboard already reads Supabase natively. No second
  account, no cross-account API key, no query-API integration at render.
- The occasion tap is a **custom** interaction we'd instrument either way,
  so PostHog's auto-capture advantage doesn't apply to this metric.
- **Dedup and test-exclusion (the explicit concerns) stay under our
  control** rather than depending on filters configured in a PostHog
  account we'd have to wire in.
- The Jackpot PostHog lives in a **separate account** from the MCP/agent,
  so wiring it is extra friction with little payoff for this.

PostHog stays an optional, parallel power tool for whole-site session
replay and ad-hoc funnels **in its own UI** — not the source for our
dashboard. Revisit if we want that later.

### 2.3 What we measure
- `occasion_screen_viewed` — fired on mount.
- `occasion_selected` — fired on tap, with the chosen `occasion`.
- **Bounce rate = 1 − (unique selectors ÷ unique viewers).**
- Chain the full funnel later: viewed → selected → chat started →
  inquiry → reserve, so we see exactly where the drop concentrates.

### 2.4 Dedup + excluding tests
The hard part: at the screen the visitor is **anonymous** (no email/name
yet), so we cannot filter tests by email the way the inquiries cleanup
does. Test-exclusion has to happen pre-identity:
- **Internal flag:** visiting `/batch?internal=1` once per team device
  sets a persistent `jp_internal` cookie; every event from that device
  carries `internal: true` and is excluded from the numbers. This is the
  only reliable way to keep our own taps out of bounce.
- **Dedup:** count unique sessions/persons via an anon id we set, not raw
  events, so refreshes and double-taps don't inflate.
- **Bots:** filter by user-agent.
- The existing email/phone test-exclusion (abenazer, test, the prune
  rules) still applies downstream once identity is known.

### 2.5 Routing + UTM (LOCKED 2026-06-18)
On select, route to the destination **carrying the occasion AND the UTM
params forward**, and the destination reads the occasion so Olivia never
re-asks it.
- **Bachelorette** → its dedicated landing page (built next). Until that
  page exists, falls back to `/chat?occasion=bachelorette`.
- **Everything else** → one shared, occasion-aware "celebration" page
  (built later, NOT a page per occasion — let demand earn dedicated
  pages). Until it exists, falls back to `/chat?occasion=<value>`.
- **No dead ends** — every tap goes somewhere live from day one.

**UTM preservation is mandatory.** The screen is now an extra hop, so it
must NOT drop attribution. Reuse the existing `UtmProvider` (already
captures/persists UTM and feeds `/api/inquiries`) so the eventual inquiry
still records `utm_source=batch` etc. Capture UTM on the `/batch` landing
and carry it through the screen → destination → inquiry, unbroken.

---

## 3. Occasion screen design direction

- **Frame it as tailoring, not a quiz or a gate.** One tap, instant
  payoff. Never reads as a form. Example headline direction: "Let's build
  your weekend around the occasion." (copy not final)
- **Big tappable cards, not a dropdown.** Bachelorette gets visual
  priority (76% of the channel).
- **Icon + label + a warm micro-aesthetic per card** (subtle gradient,
  warm shadow, hover lift). Brand rules hold: gold/warm only, no cool
  colors, no black, no gambling imagery, Cormorant headline / Outfit body,
  44px+ targets, and no dashes in any copy.

### Occasion options (LOCKED 2026-06-18)

Eight options, with a visual hierarchy so the count never slows the 77%
who tap the first one:
- **Hero card: Bachelorette** (77.4% of Batch demand) — biggest, dominant.
- **Standard cards: Birthday** (9.7%), **Bachelor** (4.6%), **Group trip**
  (~2.4%).
- **Lighter row underneath: Getaway · Reunion · Just a good time** — the
  non-milestone friends-weekend cluster; smaller chips, not equal-weight
  cards, so they're available without competing with the headline
  occasions.
- **Catch-all: Something else** — captures a short free-text ("tell us
  what you're celebrating") so the long tail (wedding, holiday,
  graduation, showers, anniversary, etc.) is *learned* without a card for
  each.

Rationale: only bachelorette/birthday/bachelor/group-trip are demand
justified. **Wedding was dropped as a card** (~0.2% of demand) and lives
in Something else. The free-text is self-correcting: if a label keeps
showing up there, demand has earned it a card. Let demand earn cards,
don't guess them in.

**Follow-on:** the chat funnel's occasion widget + the harness occasion
enum should be aligned to this same set (add group trip / getaway /
reunion / just-a-good-time, drop wedding) so the screen's captured
occasion flows cleanly into Olivia.

### Screen motion (direction, 2026-06-18)

**Entrance — the arrival moment, staged from a blank canvas:**
1. Blank warm canvas.
2. **THE JACKPOT** wordmark reveals in (letter-by-letter rise/fade, not a
   literal handwriting draw — cleaner for the serif).
3. The **starburst** animates in.
4. The lockup **slides up and docks as the header**.
5. The **question + option cards rise up into view** beneath it.

Constraints (this is the top of a bounce-sensitive funnel):
- Total ~1s, snappy easing. Cards become tappable the instant they land —
  never make the 77% wait to tap Bachelorette.
- Play **once per session**; no replay on back-nav from a landing page.
- `prefers-reduced-motion` snaps straight to the composed state (logo
  docked, options visible), no motion.

**Exit — on select:** an occasion-themed transition that fills the screen
and masks the route change (so the next page feels instant). Transform/
opacity only, capped particle count, ~1s, then route. Bachelorette ships
first; other occasions get themed exits later.

**Confetti palette — bachelorette (DECIDED 2026-06-18):** keep the
pink/red/blush/white, MIXED with the Jackpot warm palette so it reads as
ours. Working set (~7-8 colors): soft pink, deeper rose-pink, a WARM red
(coral-leaning, not cool crimson), blush, white/cream, + brand gold
(`#d4a930`), gold-bright (`#e8b923`), peach (`#ff9050`).

> **Scope (brand guardrail):** this is a deliberate, **confetti-only**
> exception to the no-pink rule, justified by bachelorette convention and
> anchored by brand colors. It does NOT loosen the rule anywhere else —
> every other surface stays warm-only. Do not let pink creep into the
> rest of the brand on the basis of this exception.

---

## 4. Who the Batch buyer is (data, informs copy + the page)

From the deduped Batch leads (n≈45, directional):
- **Occasion:** 76% bachelor/ette; long tail of getaway, birthday,
  wedding, other. (Form lumps bachelor + bachelorette into one field.)
- **Group size:** median 8, avg 8.5, range 4-14 — most parties are well
  under the 14 capacity, so the upsell lever is experiences, not beds.
- **Trip length:** ~2.5 nights (62% two nights, 29% three).
- **Seasonality:** Jul + Aug + Sep = 76% of demand.
- **Lead time:** median ~79 days out; they plan 2-3 months ahead with
  experiences still unbooked — the window the packages target.
- **Engagement:** 41 of 45 completed the full inquiry, then went quiet.
  The loss is after a fully-engaged inquiry, not at the form. (Caveat:
  this is survivor data; the occasion screen is what will finally show the
  pre-inquiry bounce.)
- **Buyer:** the MoH/bridesmaid, not the bride; pooled money; thinks per
  person.

---

## 5. Open — the agenda we have not worked through yet

1. ~~What options we show~~ — **RESOLVED, see §3 "Occasion options
   (LOCKED)".**
2. ~~What happens when each option is clicked~~ — **RESOLVED, see §2.5.**
3. ~~Where each routes~~ — **RESOLVED, see §2.5.**
4. **The bachelorette landing page** (the main build) — copy, images,
   vibe, and the bachelorette-tuned Olivia. This is where the all-
   inclusive positioning, the free base layer / lead magnet, and the
   package ladder actually land.

---

## 6. Proposed Supabase tracking schema (draft, to refine in §2.3 work)

A lightweight events table the marketing dashboard can read:

```sql
create table landing_event (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  anon_id     text not null,        -- set client-side, persisted; dedup key
  event       text not null,        -- 'occasion_screen_viewed' | 'occasion_selected'
  occasion    text,                 -- set on occasion_selected
  utm_source  text,
  referrer    text,
  path        text,                 -- e.g. /batch
  internal    boolean default false -- jp_internal cookie present
);
```

Bounce + occasion mix come from grouping by `anon_id` over this table,
filtered to `internal = false`. Surfaces as a new section in
`/admin/marketing` next to the existing Batch profile.

---

## 8. Build scope (settled work; EXCLUDES the bachelorette page contents)

Grounded in the code: `/batch` does **not** exist yet (we create it);
`UtmProvider` + `PostHogProvider` already exist (reuse UTM capture).

**Phase 0 — Foundations**
- Read `UtmProvider` to reuse its UTM capture/persistence.
- Establish an `anon_id` (reuse the PostHog `distinct_id` if present, else
  a `jp_anon` cookie) for dedup.
- Confetti approach: lightweight (canvas-confetti or hand-rolled
  transform/opacity), capped particles, perf-safe.

**Phase 1 — Data layer (Supabase)**
- Migration: `landing_event` table (anon_id, event, occasion,
  occasion_freetext, full utm set, referrer, landing_path, internal,
  created_at). Naming: `<timestamp>_landing_events.sql`.
- `POST /api/landing-event` to insert (validates, stamps server-side).

**Phase 2 — The occasion screen (`/batch`)**
- New route `src/app/batch/page.tsx` + module CSS.
- 8 options with the §3 hierarchy; "Something else" reveals a short
  free-text. Brand-styled cards (icon + label + warm aesthetic, 44px+).
- Headline + sublines (the "tailoring, not a quiz" copy).
- On mount: capture UTM, set/read `anon_id`, read `jp_internal` flag, fire
  `occasion_screen_viewed`.
- On tap: fire `occasion_selected` (+ free-text), then route.

**Phase 3 — Motion**
- Entrance: wordmark → starburst → dock to header → options rise. ~1s,
  once/session (sessionStorage), `prefers-reduced-motion` snaps to final.
- Exit: bachelorette confetti (the §3 palette) masking the route; simpler
  fade for other occasions for now.

**Phase 4 — Routing + pass-through**
- On select, route per §2.5 carrying `occasion` + UTM. v1: all destinations
  fall back to `/chat?occasion=<value>` (incl. bachelorette until its page
  exists).
- Destination reads `occasion` and pre-fills it so Olivia never re-asks.
- Verify the eventual inquiry still records `utm_source=batch` end to end.

**Phase 5 — Dashboard**
- New `/admin/marketing` section reading `landing_event`: occasion-screen
  funnel (viewed → selected), **bounce rate**, and the explicit occasion
  mix. Filtered `internal = false`, deduped by `anon_id`.

**Phase 6 — Consistency follow-on**
- Align the chat occasion widget + harness enum to the locked 8-option set
  (add group trip / getaway / reunion / just-a-good-time; drop wedding).

**Phase 7 — Verify**
- Walk the flow with `?internal=1`; confirm events write + dedup, dashboard
  reads, bounce math, UTM preserved into a test inquiry, reduced-motion.
  Clean up test rows after.

**Deferred (next conversation, not this scope):** the bachelorette landing
page contents (copy/images/vibe/Olivia tuning), the shared celebration
page, and themed exits beyond bachelorette.

**Open at build time:** anon_id source (PostHog distinct_id vs own cookie);
confetti library choice; whether to stand up a minimal bachelorette page
now or keep the `/chat` fallback until the real one is designed.

---

## 7. Decisions log

- 2026-06-18 — Occasion screen approved as the `/batch` entry, justified
  by the first-touch measurement gap. Tracking backend = Supabase.
- 2026-06-18 — Occasion options locked (8, with hierarchy): Bachelorette
  hero; Birthday/Bachelor/Group trip standard; Getaway/Reunion/Just a good
  time lighter row; Something else with free-text. Wedding dropped as a
  card. Chat widget + harness enum to be aligned as a follow-on.
- 2026-06-18 — Screen motion direction set: staged entrance (wordmark →
  starburst → dock as header → options rise, ~1s, once/session, reduced-
  motion safe) and occasion-themed exit transitions. Bachelorette exit =
  confetti. Confetti palette = bachelorette pink/red/blush/white mixed
  with brand gold/gold-bright/peach/cream — a confetti-only, scoped
  exception to the no-pink rule, not a brand-wide change.
- 2026-06-18 — Routing locked: bachelorette → dedicated page; all others →
  one shared occasion-aware page; v1 everything falls back to
  `/chat?occasion=…`, no dead ends. UTM preservation mandatory (reuse
  UtmProvider). Build scope written (§8); bachelorette page contents
  deferred to the next conversation.
