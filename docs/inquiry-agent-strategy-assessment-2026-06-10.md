# Inquiry Agent — Strategy Assessment (post-price, drop-off, negotiation)

**Date:** 2026-06-10
**Prompted by:** Abe's review of prod session `a4af0780` + his own negotiation transcript with a real lead (Jenni, the maid-of-honor).
**Lens requested:** assess the interaction, the system we built, and the goals through an Alex Hormozi frame.

---

## 0. The headline

We built Olivia to be a **wall** that holds the price line. Abe negotiates as a **bridge** that defers the decision and keeps the door open. That single design error is working directly against the one metric that matters most: **post-price drop-off**, which Abe says is the biggest leak in the business (leads ghost his calls and texts after seeing the number).

Everything below follows from fixing that.

---

## 1. What the prod session actually did (`a4af0780`)

Real guest, mobile. Price card showed $3,932 / 3 nights / 14 guests / $281 per head.

```
Olivia: There it is. Three nights, the whole crew, 281 a head. How does that sit?
Guest:  that's a little high
Olivia: Heard you. Do your dates have any give? A midweek shift or shoulder weekend moves the math.
Guest:  no not really, is this the best you can do?
Olivia: I don't move on the number itself, but I can strip add ons to find the floor. What's your honest ceiling?
Guest:  like 2.5k all in
Olivia: 2.5 all in on that weekend at full crew isn't a number we can land. The path to your
        number is a different window, not a different price.
Guest:  so this is the final offer?
Olivia: On that weekend at full crew, yes.
Guest:  [taps "Send to my group" and leaves]
```

On our old rubric this is a **pass** — she held price, never discounted, stayed on brand, clean voice. On Abe's rubric it is a **near-miss that probably lost the lead**:

- She **negotiated on her own** ("I don't move on the number", "isn't a number we can land", "yes, final"). Abe's rule: Olivia never negotiates. She defers.
- She **closed doors** instead of opening them. "Is this final?" → "yes" is a conversation-ender. The guest's next move (tap share and leave) is a polite exit.
- She **stopped diagnosing.** She got one data point (ceiling = 2.5k) and immediately adjudicated it. She never learned: who's the group, the occasion, who's paying, why only the price scared them.
- She **gave a number-shaped verdict** without Abe. The decision wasn't hers to make.

She did the technically-safe thing and lost the human thread.

---

## 2. How Abe actually negotiates (from the Jenni transcript)

Abe's transcript is a clinic. The moves, in order:

1. **Re-open warmly, no pressure.** "Tried calling, no worries, here's the trip page."
2. **Honest, real scarcity.** "That weekend is getting popular, a couple other groups are asking." (True, not manufactured.)
3. **Name the elephant + ask for the budget.** "I know price is usually the #1 factor. Where does the number land for your group?"
4. **Offer the call as the low-friction path.** "If texting gets clunky, happy to do a quick 5 min call."
5. **Diagnose relentlessly before quoting.** Who's coming, who's the MOH, who's paying for the bride, what's the real group size, what's the occasion. He asks ~6 diagnostic questions before talking number.
6. **Reframe the price shock with truth.** "You're a bit smaller than the bachelorette groups we usually host, which makes sense for the price shock." (Explains *why* the number looks high for them specifically.)
7. **Defer the decision, build the case.** "We're a new family-owned business, I'll have to speak with my family, but given what you've shared I think I can help. Tell me your budget so I can make your case."
8. **Never commits on the spot. Sets a follow-up clock.** "I'll let you know within 24 hours."

Result: the lead stayed warm and engaged ("liked" his message, said "take your time"). He kept the door open and moved the decision to his court.

**Olivia should be running this playbook, not the wall playbook.** Her post-price job is steps 3, 5, 6 (name it, diagnose, explain value) and then route to 7/8 (defer to Abe / book the call / reserve no-payment). She is the front half of Abe's process, not a substitute for his judgment.

---

## 3. The Hormozi lens (as requested)

Hormozi's frame maps cleanly onto everything above:

**a. The lever is the offer and the risk, never the price.** Hormozi: don't cut price, increase value or remove risk. Our equivalents:
- **Risk reversal → reserve with no payment.** This is the single highest-leverage idea in Abe's message. "Hold your dates, nothing due now" removes the commitment barrier at the exact moment of hesitation. It converts a price-shock exit into a captured lead. Replace the dead "Save for later" chip with it and put a version on the hero.
- **Value re-anchor → per person per night.** $3,932 looks scary. $94 per person per night, for a private 5-bedroom home with a hot tub and cinema, against a downtown hotel block at $200+ per person per night with no shared space, is a *bargain*. Olivia should make that comparison explicitly, sourced from real PriceLabs / market context, not vibes. Abe already intuits this ("281 a head") but Olivia drops the number without the comparison that makes it land.

**b. The money is in the follow-up, and the goal of any one touch is the next step.** Hormozi hammers that most revenue is in nurture, not first contact. Abe's drop-off problem IS a follow-up problem. The chat's whole reason to exist is to **stay in the conversation** so the lead doesn't go cold between the price reveal and Abe's close. That means every post-price turn should be advancing toward one of three next steps: (1) reserve no-payment, (2) book a call with Abe, (3) hand Abe a diagnosed lead. "Holding the line" advances none of them.

**c. Diagnose before you prescribe.** Classic. Olivia is prescribing (adjudicating the price) before diagnosing (understanding the trip). Flip it. The budget-fit widget (below) is the first diagnostic, and it's a *tap*, not a sentence she can ignore.

**d. Lower the friction of the yes that costs nothing.** The micro-commitment. A tappable "where does this land for you?" widget is a yes that costs the guest nothing and keeps them in the funnel. A text question they've-already-got-what-they-came-for is an easy ghost.

---

## 4. Why post-price specifically leaks (the mechanism)

The guest came for the number. The instant they have it, the value of staying drops to near zero unless we give them a reason and a frictionless action. Our current post-price turn gives them:
- a price (their goal — achieved, reason to stay gone), then
- a **text question** ("how does it sit?") that is trivial to ignore, and
- if they push, a **wall** that gives them a clean reason to leave.

Three leaks in a row. Abe's process plugs all three: the budget question is framed as *helping them*, the diagnosis makes them feel understood (sunk-cost engagement), and the deferral + no-payment-reserve gives them a reason and a zero-risk action to stay.

---

## 5. Concrete changes (prioritized)

**P1 — Reframe Olivia's post-price role from negotiator to gatherer/deferrer.**
Rewrite the post-price section of the prompt:
- Remove "structural concessions she offers herself", "hold the line", "I don't move on the number", "final".
- Add: diagnose first (occasion, group, who's paying, real budget/ceiling, what else they're weighing). Validate. Explain the value (per person per night + why-it-looks-high-for-your-group, the Abe move). Then defer: "let me put together the right quote and run it by my family" / route to a call / offer the no-payment reserve.
- She may still surface *availability* alternates (booked dates) since that's not a price decision. She may NOT invent cheaper windows or quote custom numbers. Anything price-decision-shaped → Abe.

**P2 — Budget-fit widget at price reveal.**
Replace the bare "how does it sit?" text question with a tappable widget: where does this land for you? `under budget / about right / a stretch / over budget`. Captures `price_response` as a micro-commitment instead of an ignorable sentence. Each answer routes: "about right" → reserve/book; "a stretch / over" → diagnose budget + value-reframe + defer to Abe.

**P3 — Reserve-now-no-payment (locked flow).**
The anti-drop-off mechanic, and it folds in the call. It is one of the
widgets shown at price reveal (next to the budget-fit widget), the
State-1 chip, and a hero CTA. The flow when tapped:
1. One widget collecting all the info we already gather (name, email,
   phone + trip basics), ideally a single form not a drip.
2. Then a scheduling step: when are you free for a **5-minute call with
   Abe in the next 24 hours?** Positioned as required: "we'll block the
   calendar for you with nothing due now, and the quick call is how we
   guarantee the hold." The call is the commitment device AND it solves
   Abe's "guests ghost my outbound calls" problem, because the guest
   picks the time.
3. Reserve = soft hold: flag the inquiry + notify Abe with the chosen
   call window. No Stripe, no hard calendar block in v1.

This collapses old P3 + P4 into one flow. The call isn't a separate
"warm exit" — it's the guarantee mechanism baked into the reserve.

**P5 — Value justification from real data.**
Give Olivia the PriceLabs/market context to make the per-person-per-night comparison truthfully ("a hotel block for 14 downtown runs $X/person/night with no shared space; we're $94 with the whole home"). Sourced, not invented.

**P6 — Voice: kill one-word openers.**
"Cool...", "Heard you...", "Got it..." before the real sentence read as AI. Prompt rule: open with substance. (Already noted; cheap.)

---

## 6. What NOT to change

- The widget-first collection flow (pre-price) is working and on-strategy.
- The no-dash sanitizer, the notify_abe + mirror plumbing, the eval harness — all stay.
- The availability-alternates widget (booked dates) stays; it's not a price decision.
- We are NOT giving Olivia discount authority. The fix is the opposite: she has *less* pricing authority, not more. She gathers and defers.

---

## 7. Recommended sequence

1. **P1 + P6 together** (prompt rewrite: gatherer/deferrer role + kill one-word openers). Pure prompt + eval fixtures. Highest leverage, lowest build cost. Re-run evals; add fixtures asserting she defers instead of adjudicating, and that she diagnoses before quoting.
2. **P2 budget-fit widget** (small build, big drop-off impact — turns the leakiest moment into a tap).
3. **P3 reserve-no-payment** (the real anti-drop-off mechanic; bigger build — DB + CTA + hero copy).
4. **P4 schedule-a-call** and **P5 value data** after.

P1+P2 alone should move the drop-off number meaningfully and are a day of work. The rest is the back half.

---

## Open question for Abe

For **reserve-no-payment**: what does a reserve actually *do* on our end? Options:
- (a) Soft hold — just flags the inquiry "interested, dates held" and notifies you; no calendar block, no expiry. Pure lead capture.
- (b) Real 48-72h courtesy hold — blocks the dates for a window, auto-releases. More commitment, more ops risk if abused.

I'd start with (a) — it's the lead-capture win with zero downside, and you stay in control of any real hold. Confirm before P3.
