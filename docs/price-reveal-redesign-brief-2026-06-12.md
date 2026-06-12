# Price reveal redesign — build brief

From the conversion audit (guest journey + Hormozi lens). Scope for the next implementation push. Phone stays required; the reserve call stays mandatory; post-vote handoff and the /trip /book dash cleanup are deprioritized.

## 1. Value-first slow reveal (Leak 2)
The number currently lands before the value is read. Reveal value first, drip it so it's actually read, then the number.

- **Teaser line first, no figure:** e.g. "Your weekend's ready. Here's what you're holding." Holds attention through the drip.
- **Drip the value in sequence:** dream topline → photo strip → the 3 occasion pillars → the matched review.
- **Then the number** ($X per guest/night + total + savings tag) reveals last.
- **Then the CTAs.**
- Pacing ~2–3s total; elegant unveil, not slow loading. Reuse the existing drip-feed pattern (introReady / OliviaTyping).

## 2. Qualify during the "calculating" beat (Leak 3)
Use the pre-price wait to capture two high-value signals as single-tap chips, framed as tailoring the number, with visible progress so they don't bounce.

- Lead-in: "Pulling your real number. Two quick taps so it's accurate."
- **Q1 — stage + urgency:** "Where are you in the hunt?" → `Just starting to look` · `Been at it a while` · `Ready to lock something in`. (Folds the standalone timeline question in.)
- **Q2 — deciding power (forward-framed):** "Once you've got the number, what's the move?" → `I'll lock it in` · `I'll run it by the crew` · `I'm gathering for whoever's deciding`.
- One question at a time; each tap advances a progress treatment ("Locking your dates ✓ … adding the city's fees … finalizing your number"). Their taps summon the price.
- Persist to the existing signals: Q1 → `decision_timeline`, Q2 → `decision_makers` (+ capture the relay case).

## 3. Context-aware CTA engine (Leak 3)
The price-reveal CTA priority + wording is driven by Q2 (and Q1):
- Q2 `I'll lock it in` → **Reserve now** primary.
- Q2 `run it by the crew` / `gathering for whoever's deciding` → **Get the group on board** (share/vote) primary; reserve demotes.
- Q1 `Just starting` / exploring → soften reserve subcopy ("lock the dates while you think, nothing due"), lead share or "a few questions."

## 4. Honest scarcity (Leak 6)
Apply only where genuinely true; no fake timers, no invented counts.
- Held-date courtesy at reserve: "nothing due; we hold it for 7 days so the next group gets a fair shot."
- "One home, one group per date" where it fits.
- "X weekends left" only once a real availability count is wired.

## Build order
Reveal (1) → qualify-with-progress beat (2) → CTA engine (3) → scarcity (4). Test each in Chrome.

## Retention watch
This stacks 2 qualifying taps on top of the existing contact gate before the price. Momentum framing should carry it; if retention dips, fallback = move the two taps to right after the price (pre-CTA).
