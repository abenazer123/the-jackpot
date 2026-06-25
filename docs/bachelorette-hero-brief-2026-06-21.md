# Bachelorette hero + dedicated page — design brief

Date: 2026-06-21
For: Abe's visual-iteration agent (design pass before build)
Status: brief for visual iteration. Architecture is settled; the hero's
art direction is the thing to riff on.

## Context
Bachelorette is ~77% of inquiry demand and is the whole positioning of
the brand, yet today tapping "Bachelorette" on `/batch` routes to
`/chat?occasion=bachelorette`, the same generic Olivia chat every other
occasion lands on, and the occasion param is currently ignored. It
deserves a purpose-built first impression. We are building a dedicated
bachelorette page with a bespoke hero, flowing into the existing Olivia
chat (which is already occasion-aware and reusable).

## Settled decisions (not for iteration)
- **Route:** new `/bachelorette` page. The `/batch` Bachelorette tap
  routes here (others keep going to `/chat`). The confetti pop on tap
  stays as the transition into it.
- **Page shape:** "hero into chat", a bachelorette-designed hero that
  flows straight into the embedded Olivia chat card (same single-page
  pattern as `/chat` today, bespoke up top). Not a long scrolling
  landing (yet) and not hero-only.
- **Reuse, don't rebuild the chat.** `InquiryChatThread` already collects
  occasion and tailors value framing / reviews / CTAs. We pre-seed
  `occasion="bachelorette"` so it skips that question, and pass a theme.
- **Component library = the existing convention, formalized.**
  `src/components/brand/` = reusable primitives (`Wordmark`, `Starburst`,
  `StatStrip`, `Calendar`, `InquiryChat`, `InquiryChatThread`).
  `src/components/sections/` = page compositions (`HeroSection`,
  `HeroChatSection`). The new hero is built bachelorette-first but as a
  **parameterizable section component** (content + theme via props) so a
  future birthday/group page can reuse it. Working name: `InquiryHero`
  with a bachelorette config, or `BacheloretteHero` wrapping it.
- **Visual identity:** distinct bachelorette palette (below), still
  unmistakably in-brand. The chat gets a matching pink-tinted theme
  variant.

## The hero's job
In one screen it must: (1) signal instantly "this is THE bachelorette
home," (2) feel celebratory and feminine without losing the luxe/editorial
brand, (3) carry the value spine (togetherness + per-person beats a hotel;
purpose-built + curated beats a generic rental, never compete on price),
and (4) hand off naturally into the Olivia chat card to start the inquiry.

## Visual direction (this is what to iterate)
- **Palette (scoped exception, like the confetti).** Introduce a
  bachelorette-scoped pink family alongside the brand gold/peach, this
  is NOT brand-wide. Anchor on the confetti palette already in the repo:
  rose `#f7a8c4`, pink `#ec5f8a`, coral `#f0506a`, blush `#f9d9d2`,
  plus brand `--jp-gold`/`--jp-gold-bright` and `--jp-peach`. Mood:
  warm, celebratory, feminine, still light and luxe.
  - HARD: still no black, no cool colors (no blue/gray/silver), warm/
    light always. The pinks read as warm, not hot/neon. Body text stays
    warm olive `#7a6030` (pinks/gold are display/large only, they fail
    AA for body).
  - We will add bach-scoped tokens (e.g. `--jp-bach-rose`, etc.) the way
    the confetti palette is a documented scoped exception, not edits to
    the core token set.
- **Typography:** unchanged brand pairing, Cormorant Garamond display,
  Outfit functional. Never swap them. The bachelorette personality comes
  from palette, imagery, composition, and copy, not new fonts.
- **Composition:** start from the bones of `HeroChatSection`
  (`src/components/sections/HeroChatSection.tsx`), wordmark + tagline +
  stat strip + photo treatment + the chat card, then redesign the art
  direction for bachelorette. Open questions for you below.
- **Imagery:** lean into the bachelorette-relevant spaces (spa/hot tub,
  supper club, cinema, parlor/bar). Same property photo set
  (`@brand/docs/photos/*`); the iteration is selection, crop, framing,
  and any rose/gold wash/overlay.
- **Motion:** hero **ships static** this round. Per the standing motion
  budget, the motion allowance is reserved for the sticky scroll-reveal
  pass, not the hero. The confetti is the entrance; the hero itself is
  still on arrival.

## Copy direction (draft, refine with the words person)
- Lead with the bachelorette fantasy + the home as the destination, not a
  nightly rate. "her last weekend single" energy, tasteful not corny.
- Carry per-person value early (a group of ~10 to 14 makes this land far
  under a hotel block, per the value-positioning ladder).
- Voice: "home" not "house", "crew"/"group" not "party". Warm, confident,
  concise.
- HARD: no dashes of any kind in any copy (em, en, hyphen, nbhyphen).
  Rephrase with commas/periods/spaces.

## Hard constraints (read `/brand/docs/design-system.md`)
- No black anywhere; warm/light only; no cool colors.
- Cormorant Garamond = display, Outfit = function, never swapped.
- Gold/peach/pink are display/large-text only; body is warm olive.
- Use `--jp-*` tokens (plus the new bach-scoped pink tokens); never
  hardcode colors/fonts/spacing/radii.
- Shadows/borders are warm at low opacity, never gray.
- No dashes in copy.

## For the visual agent: iterate vs fixed
Iterate freely: the hero's art direction, layout, photo treatment, the
pink/gold balance, the tagline + supporting copy, how the chat card sits
within the hero, mobile composition.
Do not change: the route/page shape, the decision to reuse the chat,
the font pairing, the hard brand rules, static-hero motion budget.

## Open questions to resolve in iteration
1. Pink-forward or gold-forward? (i.e. is the dominant wash rose with gold
   accents, or still gold-dominant with rose accents?) Affects how far
   the chat theme tilts pink.
2. Does the chat card keep its current light/linen surface on the pink
   hero, or get a rose-tinted surface to match?
3. Photo treatment: clean photos vs a subtle rose/gold gradient wash.
4. How loud is the wordmark/lockup here vs the main site, same restraint
   or a bigger celebratory moment?

## Build notes (after visual sign-off)
- New `src/app/bachelorette/page.tsx` rendering the bachelorette hero
  section, with the embedded `InquiryChat` card flowing into
  `InquiryChatThread` pre-seeded `occasion="bachelorette"`.
- Hero as a parameterizable section component (content + `theme` props)
  living in `src/components/sections/`.
- Add a `theme`/`variant` prop to `InquiryChat` / `InquiryChatThread` so
  the chat can take the pink-tinted palette; default stays the current
  gold theme for `/chat`. CSS module variables are the cleanest seam.
- Update the `/batch` Bachelorette route target from `/chat?occasion=...`
  to `/bachelorette`.
- Verify: tsc/lint clean, eval still green, confetti transition still
  lands on the new route, chat flow unchanged for non-bachelorette.
