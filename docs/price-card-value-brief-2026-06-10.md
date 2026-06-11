# Price card value framing — design brief

**Date:** 2026-06-10
**For:** visual iteration before build (the price-reveal card in the `/chat` flow)
**Problem it solves:** post-price drop-off is the single biggest leak. When the number lands, people go quiet. The card today is a number (total, nightly, per guest). It should be a number sitting on a pile of value, framed around what the home actually *affords* the group.

---

## The core insight: the argument splits by what they're comparing us against

Guests weigh The Jackpot against two different things, and the winning argument is different for each:

- **vs. a hotel block** → win on **togetherness + per-person value**. (The per-person-per-night reframe and the honest hotel comparison already do this.)
- **vs. another nice group rental** → here togetherness is table stakes (everyone's under one roof there too), and we do NOT want to compete on price (we're premium). We win on **purpose-built and curated**: this home was composed for the celebration and set up before you arrive, not a big house you have to turn into a party.

The lead message must beat *both* comps, so it leads with the differentiator the other-rental comp can't claim: **purpose-built and curated.** (Confirmed by Abe as the real hook when a guest picks us over an equally nice-looking rental.)

Brand note: never name the competitor category ("Airbnb" is a forbidden word). Speak to the contrast in plain language ("not a big house you fill", "set up before you arrive").

---

## The structure: three affordance lines, not a feature list

A noun list (cinema, hot tub, bar) makes us sound like every other listing. Each line ladders feature → affordance → the underlying thing it gives the group. The feature is only the *proof*; the affordance is the sell.

Fixed 3-line skeleton (this order is intentional, see comp logic above):

1. **Made for exactly this** — purpose-built and curated. *(beats the other-rental comp; also the luxury/editorial angle: someone with taste composed it)*
2. **Everyone together, and you never have to leave** — the whole place private, the night that doesn't end. *(beats the hotel comp; the emotional core)*
3. **And it's genuinely handled** — real host, full kitchen, logistics gone. *(service + ease + trust; beats the lockbox-and-ghost rental)*

### Readability
Each line = one bold affordance headline + a thin proof clause underneath. Scannable in a glance, mobile-first. Gold starburst ✦ as the bullet (brand bullet, never a dot). No paragraphs.

Universal (non-flexed) version:

> ✦ **Made for exactly this**
> A real cinema, a hot tub built for the group, the stocked bar and parlor, the fire-pit courtyard. One home composed for the celebration and set up before you walk in, not a big house you have to turn into one.
>
> ✦ **Everyone together, and you never have to leave**
> Beds for 14, the whole place private, the night that doesn't end at a hotel door or last call.
>
> ✦ **And it's genuinely handled**
> A real host who knows the city, full kitchen and coffee bar, parking, twelve minutes from Midway. Slow mornings, no surprises.

---

## Occasion-flex (essential, per Abe)

The 3-line skeleton stays fixed. What flexes is **which curated proof points get foregrounded** and the **dream-outcome topline** — the occasion picks the details that matter to *that* group. Same home, the lens selects.

The card composes as: **dream-outcome topline → 3-line skeleton with occasion-selected proof → (existing) per-person reframe + number.**

### Proof-point banks by occasion

**Bachelorette**
- Topline: *The send-off the bride actually remembers, the whole crew together for it.*
- Line 1 proof: the bar and parlor for the night in, the hot tub, the courtyard made for photos, the cinema to wind down.
- Line 2 proof: the whole crew with the bride start to finish, the night that doesn't end at last call.
- Line 3 proof: a host who knows the city's spots, the photographer rec list, parking, slow mornings.

**Reunion (family or friend group)**
- Topline: *Everyone in one place for once. The reunion that actually happens instead of the one you keep talking about.*
- Line 1 proof: the cinema for the kids, the kitchen for the big group dinner, the fire pit for the late talks, the game room.
- Line 2 proof: three generations (or the whole friend group) under one roof, no one rushing off.
- Line 3 proof: full kitchen and coffee bar to cook in, room for everyone's stuff, parking, slow mornings.

**Milestone birthday**
- Topline: *A celebration that's about being together, not a restaurant table that turns over in two hours.*
- Line 1 proof: the bar and parlor, the cinema, the courtyard lit up. A night that feels like an occasion.
- Line 2 proof: the people who matter all in one place, the night on your own terms.
- Line 3 proof: a host who knows the city, full kitchen, parking, no surprises.

**Default / other** (use when occasion is unknown or doesn't fit above; note: not a meeting/corporate venue per the fact sheet)
- Use the universal version above.

---

## The dream-outcome frame above it all

The card sits under one idea: **this is the difference between a trip you coordinate and a weekend you're actually in, the one everyone keeps bringing up years later.** The occasion topline is the per-occasion expression of this.

---

## Voice & brand rules (non-negotiable)

- **No dashes of any kind** in any guest-facing copy (em, en, hyphen). Period, comma, or rephrase.
- Warm, confident, editorial. No hype, no "BOOK NOW", no exclamation energy. Reads like a great concierge, not a marketer.
- ✦ gold starburst as the bullet, never a dot.
- Forbidden words: rental, listing, Airbnb, property, party house. Speak to the contrast without naming the category.
- Never invent a competitor's price. The per-person reframe is real math from the quote; the hotel comparison speaks to structure, not a fabricated number. Against other rentals we compete on quality/curation/service, never on price.

---

## What this is NOT
- Not a 15-noun amenity list. Three affordance lines, features as quiet proof.
- No fake scarcity, no countdown timers, no "2 left" (brand-banned, and fatal for luxury).
- Not an infomercial "FREE bonuses" stack. It's "what's already yours / what it's built for", in concierge voice.

---

## Where it lives + open build question (for me, not the mock)

- Renders on the price-reveal card in `src/components/brand/InquiryChatThread.tsx` (the `priceQuote` block), alongside the existing total / nightly / per-person figures. Olivia's first post-price line tees it up.
- **Build decision to settle before implementation:** static front-end component fed by `occasion` (proof banks as data) vs. LLM-composed by Olivia. Leaning **static/data-driven** for brand consistency and to keep the key value card off the LLM-variance + dash-sanitizer path. The occasion just selects which proof bank renders. Flag for Abe at build time.

## Adjacent elements already on/near the card
- 5.0 ★ 47 social proof exists (hero stat) — placing a real, specific proof point near the price beat is a lever worth using.
- The 3 action buttons (Reserve now / questions / send to group) live below the value framing.

---

## Iteration 2 (2026-06-11) — implemented directly, iterated in Chrome (no mock)

**Lead with per-person-per-night.** The total was the hero (big) and per-person-per-night was a tiny line. Flip it: the small honest unit (e.g. $138 / guest / night) is the hero number; the group total stays clearly visible as "for the whole group" (transparency + groups split it). Anchor on the friendly number, total reads as reasonable. (Hormozi divide-down.)

**Readability / not too mellow.** The card was uniform warm olive at one size and the proof lines were two sentences each, so nothing grabbed and people would skim. Fixes: big per-person number as the visual anchor; the three ✦ headlines are the scannable layer; proof trimmed to short fragments, not sentences; the value block visually separated (tint/divider) so it reads as "why it's worth it," not fine print.

**9:12 vertical media carousel.** A horizontal scroll-snap strip of portrait (3:4 / "9 by 12") cards on the card, each a placeholder for a vertical video (brand photos as placeholders for now, with a play affordance). Visual proof at the price beat. Real video/photo selects + real review quotes come from Abe later; do not invent reviews.

**No Airbnb link.** Decided against: sends guests off the direct funnel to a platform (lost margin + relationship), undercuts the "direct, not a listing" positioning (and Airbnb is a forbidden word), and surfaces comps we don't control. Bring credibility ON-surface instead: review quotes, 5.0 ★ 47, the media carousel.

**Sticky-then-lock Reserve CTA.** All these additions make the card long. So the primary "Reserve now, nothing due" floats pinned above the composer while the guest scrolls through the card (so the CTA is always reachable AND they still see the affordances on the way down), then locks into its inline position once the natural action row scrolls into view. Implemented with an IntersectionObserver on the inline action row; floating bar shows only while priceQuote exists, priceAction is "none", and the inline actions are out of view.
