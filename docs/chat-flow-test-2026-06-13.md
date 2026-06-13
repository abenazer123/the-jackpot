# /chat flow test + fixes — 2026-06-13

Full tap-through test of the price-discovery flow (dates → contact →
group/occasion → qualify beat → reveal → share), reproducing Abe's
report and sweeping for other issues. Every item below was fixed and
re-verified live at mobile width.

## Issues found + fixed

1. **Qualify beat cut off on mobile.** Root cause: the auto-scroll
   effect's deps did not include `searchStage`/`decisionPower`, so when
   Q1 → Q2 grew the card the chat never re-scrolled and the 3rd chip sat
   under the sticky composer. Fix: added the qualify + share state to the
   scroll deps so the card follows as it grows; bumped the scroll
   region's bottom padding 12px → 24px.

2. **Occasion animation not visible.** The sparkle motif shipped but was
   far too faint (peak opacity 0.65, small, few). Fix: dialed it up —
   more + larger sparkles at higher opacity with a soft gold glow, and
   bigger champagne bubbles that rise with a horizontal drift. Confirmed
   clearly visible + on-brand (still transform/opacity only, capped,
   reduced-motion hides it).

3. **Slow to start the reveal after the two questions.** Root cause: the
   whole price card was gated on `priceQuote`, so a cold PriceLabs fetch
   left the guest staring at a "Finalizing…" pill. Fix: decoupled the
   value drip from the quote — the value (dream, photos, pillars, review)
   reveals immediately on the second tap; only the *number* holds for the
   quote (with an inline "Pulling your number…" placeholder that swaps in
   when it lands). The header now derives from local state so the card
   renders instantly. (In testing the quote was usually cache-warm from
   the availability check and the number was instant.)

4. **Trip widget + image slow after "Send to my group".** Root cause:
   the post-price share routed through a full LLM turn (Olivia had
   nothing to compose since every slot was already known), and the cover
   image had no placeholder/priority so it popped in. Fix: a new direct
   mint route `POST /api/inquiry-agent/share` (reuses the harness
   `ensureShareLink`, no model) so the widget shows in well under a
   second; the cover `<Image>` got `priority` + a blur placeholder so it
   paints instantly. Falls back to the agent path if the direct mint
   can't proceed.

5. **Let people open the trip page + keep the actions hovering.** Added
   an "Open the page" button to the share widget, and a hovering sticky
   action bar (Open · Copy link · Send it) pinned above the composer the
   whole time the trip widget is up, so the coordinator can act without
   scrolling back. Native share falls back to copy on desktop. 44px tap
   targets.

## Verified
- Motif clearly visible (sparkles + champagne bubbles) at the bachelorette beat.
- Reveal starts immediately after Q2 (value first, number when ready).
- Share widget + image appear fast; Open / Copy / Send work inline and in the hovering bar.
- tsc, build, lint clean; eval 10/10.
