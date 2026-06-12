# Price reveal redesign — build loop progress

Spec: `docs/price-reveal-redesign-brief-2026-06-12.md`. Build order: (1) value-first slow reveal → (2) qualify-during-calculating beat → (3) context-aware CTA engine → (4) honest scarcity. An item is DONE only when both auditors (Alex + head-of-design) sign off with no material issues.

## Checklist
- [ ] **1. Value-first slow reveal** — built, pending test + audit
- [ ] 2. Qualify-during-calculating beat
- [ ] 3. Context-aware CTA engine
- [ ] 4. Honest scarcity
- [ ] Final full-funnel audit

## Log
### Pass 1 (2026-06-12) — item 1 build + audit round 1
- Built the staged reveal (revealStage 0..5): header + advancing status → dream topline + photos → pillars → review → number → CTAs. Reordered so value precedes the number. tsc/build/lint clean; eval 10/10.
- **Tested live in Chrome** (desktop width — mobile resize/screenshot was flaky this pass, see deferral): confirmed value-first — at ~1s the card shows the teaser + dream + photos with NO number; by ~3s the number ($122/guest/night, $2,446, savings) and CTAs drip in last. Auto-scroll trails the drip. PASS on the core sequence.
- **Audit session** (Alex + head-of-design). Neither signed off. Punch-list:
  - Alex P1: no skip / no CTA for 2.6s (impatient bail risk); static teaser reads as loading not unveiling; number buried below the promise.
  - Design P1: auto-scroll was a hard jump (janky, races the fade); number arrival not announced (aria-live).
  - Design P2: tap targets <44px; ▶ glyph on stills; teaser overstays; desktop full-width; small-copy contrast (P3) fails AA.
- **Fixes applied this pass:** tap-anywhere skip-to-number (clears timers); advancing status line ("Pulling your weekend together… → And your number." + "tap to skip") replacing the static teaser AND the typing dots; smooth auto-scroll (instant for reduced-motion); aria-live on the number block; ≥44px tap targets (pillars, see-more); AA contrast on the total + review-meta lines; cleaned the 550→500 rhythm.
- **Pushed back:** ▶ glyph is intentional (video placeholders per Abe; real clips pending).
- **Deferred (Abe's call):** desktop max-width (desktop deprioritized); Alex's reorder (demote pillars below the number — changes the approved order).
- Verdict: item 1 = fixes applied, **pending re-test + re-audit** next pass.
- Test artifact created: LOOPTEST session — cleaned up this pass.

### Pass 2 (next) — item 1 re-test + re-audit
- Re-drive the reveal in Chrome; confirm skip works, status line advances, scroll is smooth, number announces. Re-audit (both lenses). If both sign off → mark item 1 DONE, move to item 2.
