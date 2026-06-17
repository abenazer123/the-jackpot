# Olivia Intake Flow — Design Brief

**Date:** 2026-06-16
**Owner:** Abe
**Status:** Draft for visual iteration, then build
**Surface:** `/chat/session` (the full-page conversational front door)

---

## 0. What this is

The spec for Olivia's rebuilt intake flow. It replaces the cold "what
weekend are you thinking" opener with a human introduction, captures
contact early, and qualifies the lead with a small set of high-value
questions before the price reveal and the reserve-with-nothing-due hold.

This document is the canonical logic. The happy path is the skeleton;
the branch logic in §6 is the muscle. Olivia's other agent should
iterate the widget visuals against §4 and §5; the build follows §8.

---

## 1. Goal of the flow

1. Feel like a real planner, not a form or a chatbot.
2. Capture contact (name, email, phone) early, so a qualified lead
   reaches Abe even if the guest drops off later.
3. Qualify the lead with the minimum set of questions that actually
   change how Abe runs the lock-in call.
4. Reveal a real price, then drive to **Reserve now, nothing due**.
5. Hand Abe a one-glance summary where every answer is an actionable
   line.

---

## 2. Voice and non-negotiables

- Warm, confident planner energy. Short messages, this is a text
  thread, not an essay.
- **No dashes of any kind** in Olivia's output or any UI copy. Em, en,
  hyphen, all banned. Rephrase, or use a comma, period, or space.
- One question per turn. React to the answer before asking the next.
- Use the celebrant's name once she has it.
- **Never say "weekend" as the default.** People book other lengths.
  Use "stay," "dates," or "trip." (See §7 for the copy sweep.)
- Olivia never negotiates, quotes off-script, or holds firm on price.
  She diagnoses budget and occasion, explains value (per person, what
  is included), and defers the decision to Abe. The shown price is the
  live PriceLabs number, presented as is.
- Tap targets at least 44px. Warm, light palette only. `--jp-*` tokens.

---

## 3. What is new vs what already exists

**Already built (reuse):**
- `date_picker` (calendar) + availability check + alternate-dates widget
- `group_occasion` widget (count + Bachelor / Bachelorette / Wedding / Other)
- `contact_form` widget (name / email / phone, phone already required)
- The "calculating your number" loading beat (champagne-coupe animation)
- The two qualify questions: Q1 `decision_timeline`, Q2 `decision_makers`
- Price card (per guest per night, group total, Book Direct savings, breakdown)
- Post-price CTA engine (Reserve / questions / Send to group)
- Reserve scheduler (Today / Tomorrow, Afternoon / Evening, 15-min times CT, phone confirm)
- `share_link` (group vote page)

**New for this brief:**
- **Self-intro opener** ("I'm Olivia, I help plan the stays around here…")
- **Contact moved earlier** — right after the availability result, before occasion. Required: name, email, and phone. NOTE: today only email and phone are enforced (`canSaveContact`); the name check must be added.
- **Birthday occasion** — added to the group/occasion widget and the harness enum. It does not exist today (widget is Bachelor / Bachelorette / Wedding / Other), so this is net-new, not a wording change.
- **Date flexibility** question + `date_flex` signal
- **Celebrant name** widget (`Me` button + name input) + `celebrant_name` slot, conditional on occasion
- **Budget per person** question + `house_budget_pp` signal, asked in the loading beat. (This supersedes the earlier "budget-fit widget at price reveal, not a text question" note — Abe's current call is a loading-beat question.)
- **"weekend" to "stays/dates" copy sweep** across existing strings

---

## 4. Slots and signals (the schema)

| Field | Type | Captured at | Notes |
|---|---|---|---|
| `arrival` / `departure` | date | dates | trip length derived from the range, not asked |
| `availability` | open \| taken | availability check | taken routes to alternates |
| `name` / `email` / `phone` | string | contact (early) | **all three required.** Name validation is NOT enforced today; the build must add it. |
| `date_flex` | `locked` \| `soft` | flex question | drives price-steering + CTA tone |
| `group_size` | int (1 to 14) | group + occasion | widget caps at 14; over-14 only reachable in the free-text lane (see §6.1) |
| `occasion` | bachelorette \| bachelor \| wedding \| birthday \| other | group + occasion | sets celebrant wording. **Birthday is new** (added to widget + enum). |
| `celebrant_name` | string \| "me" | celebrant | skipped when occasion = other |
| `decision_timeline` | `starting` \| `awhile` \| `ready` | loading beat Q1 | kept from current flow |
| `decision_makers` | `lock` \| `crew` \| `relay` | loading beat Q2 | kept; drives CTA order |
| `house_budget_pp` | int \| null | loading beat Q3 | null = "not sure yet" |
| `quote_total_cents` | int | price reveal | persisted server-side at quote time |
| `reserve_call_window` | string | reserve | e.g. "Tomorrow, Jun 17 at 6:30 PM CT" |

---

## 5. The flow, turn by turn (happy path)

Example persona: Sarah, planning a bachelorette for 10, late July, the
bride is Jenna.

**1. Intro**
> Hi, I'm Olivia. I help plan the stays around here. Let me check our availability for your dates and get you a real price. What dates are you eyeing?

`[ calendar ]` → Jul 24 to Jul 26

**2. Availability result**
> Good news, those dates are open.

*(if taken: "Those exact dates are taken. Here are the closest open ones." → alternates → pick → re-check)*

**3. Contact** *(required, framed as value)*
> Let me grab your name, email, and phone so I can send you the full details and you have everything to share with the group.

`[ name ] [ email ] [ phone ]` — all three required

**4. Date flexibility**
> Are those dates locked in, or is there a little wiggle room? Some dates run a lot friendlier on price for the exact same stay, so this lets me show you all your options.

`[ Locked in ] [ A little wiggle room ]`

**5. Group + occasion** *(existing widget)*
> Perfect. How big is the group, and what are we celebrating?

`[ 10 ] [ Bachelor ][ Bachelorette ][ Wedding ][ Other ]`

**6. Celebrant** *(wording flexes to occasion; skipped if Other)*
> A bachelorette, so fun. Who's the lucky bride we're celebrating?

`[ Me ] [ type a name… ]` → Jenna

**7. Loading beat** *(all three while the number computes)*
> Pulling Jenna's number now. While it loads, a couple quick things.
- Q1: How long have you been searching? `[ Just starting ][ Been at it a while ][ Ready to lock something in ]`
- Q2: Once you've got the number, what happens next? `[ I'll lock it in ][ I'll run it by the crew ][ I'm gathering for whoever's deciding ]`
- Q3: Any budget per person in mind for the house? Totally fine if not. `[ $ per person ][ Not sure yet ]`

**8. Price reveal**
`[ price card ]`
`[ Reserve now, nothing due ] [ I have a few questions ] [ Send to my group ]`

**9. Reserve** *(the scheduler)*
→ confirm number → day + time
> Your dates are on hold, nothing due. We hold them 7 days so the next group gets a fair shot, and Abe will call you Tomorrow, Jun 17 at 6:30 PM CT to lock it in.

**What lands in Abe's inbox:**
> Sarah is holding Jul 24 to 26 for 10 (Jenna's bachelorette).
> Searching a while, ready to lock it in, budget ~$300/person, dates flexible.
> Reserved, wants a call Tomorrow 6:30 PM CT, price shown $2,282, 312 555 0142.

---

## 6. The full branch logic (decision tree)

### 6.1 Availability (after dates)
- **Open** → "Good news, those dates are open." → proceed to contact.
- **Taken** → show the closest open ranges (existing alternates widget).
  Guest picks one → re-check → proceed. Olivia never dead-ends on
  "those are taken."
- **Over capacity** → honest not-a-fit: "We sleep up to 14 comfortably.
  For [N] you'd want a second space, so this place may not be the right
  fit." Still capture the lead (contact already taken) and flag it for
  Abe. NOTE: the tap widget caps the count at 14, so this branch is only
  reachable in the free-text / agent lane (the harness has a `max_guests`
  response). It is not reachable through the scripted widget.

### 6.2 Contact (required)
- All three fields required. The form cannot submit without a valid
  name, email, and phone. **Build note:** today `canSaveContact` only
  checks email + phone (`InquiryChatThread.tsx:1690`); the name check
  must be added.
- Framing is value, not a gate: "so I can send you the full details and
  you have it to share." Never "give me your info to continue."
- This is the single most important capture in the flow, because it is
  taken before any drop-off-prone qualifying questions.
- **Known tradeoff (decided):** this is an up-front, three-field gate
  shown before any price (right after "your dates are open"). The
  reference doc warned against up-front hard gates, and it is the
  biggest conversion risk in the flow. Abe's call is to capture early
  and required, accepting that risk in exchange for never losing a
  qualified lead to a silent drop-off. If conversion suffers, the
  fallback is to soften to email-only here and collect phone at reserve.

### 6.3 Date flexibility
- **`locked`** → "Perfect, [dates] it is." Price goes straight to that
  date. Biases the post-price CTA order toward Reserve first.
- **`soft`** → "Nice, that helps." Arms the date-steering option: if the
  budget later comes in under the shown price and dates are flexible,
  Olivia can offer to check a friendlier date (re-quote), never a
  discount.

### 6.4 Occasion → celebrant wording
Birthday is a **new** option being added to the widget + enum.
- bachelorette → "the lucky bride"
- bachelor → "the lucky groom"
- wedding → "the happy couple"
- birthday → "the birthday [guest of honor / person]" (final copy TBD, §9)
- other → **skip the celebrant step entirely.**

### 6.5 Celebrant
- **`Me`** → Olivia warms it: "Even better, this is your celebration."
  Uses "your" framing afterward.
- **typed name** → uses the name throughout the rest of the thread.

### 6.6 Budget (Q3 in the loading beat)
Budget is a qualifying signal for Abe and an input to Olivia's value
framing. It is never a price gate, and Olivia never discounts.
- **At or above the date's price** → present the number with
  confidence, anchor on what is included and per person.
- **Below the shown price, dates `soft`** → Olivia may offer to check
  other open dates, but **must not promise a cheaper one.** There is no
  cheaper-open-date finder today: `alternates.ts` only fires when the
  requested dates are *booked* (it finds open ranges near a taken one),
  not when an available date is simply pricey. So the honest copy is
  "Since you're flexible, want me to pull a few other open dates so you
  can compare?" and let the real re-quotes speak. She never says "[date]
  is cheaper" unless a real quote backs it. **Build option:** if we want
  true price-down steering, add a cheaper-open-date finder; until then,
  copy stays comparison-only.
- **Below the shown price, dates `locked`** → do not discount. Explain
  the value (per person, what is included) and let Abe take the
  conversation on the call. Defer, never haggle.
- **"Not sure yet"** → proceed, let the price and inclusions anchor.

### 6.7 Q1 + Q2 → reveal tone and CTA order
- `decision_makers = lock` → lead with **Reserve now**. Confident reveal.
- `decision_makers = crew` or `relay` → lead with **Send to my group**,
  Reserve second. Reveal leans on "easy to share, nothing due to hold."
- `decision_timeline = starting` → softer, lower pressure, keep options
  visible. `ready` → more direct, Reserve forward.
- `date_flex = locked` reinforces Reserve-first; `soft` keeps Share and
  alternates visible.

### 6.8 Price CTAs
- **Reserve now, nothing due** → the scheduler (confirm number, day,
  time), then the hold + notify Abe.
- **I have a few questions** → hand to Olivia in diagnostic mode (free
  chat). She answers without inventing facts, then re-offers Reserve.
- **Send to my group** → mint the share / vote page. Contact already
  captured, so the share path no longer needs to ask for it.

---

## 7. Copy sweep: "weekend" to "stays/dates"

The word "weekend" is hardcoded in many existing strings (the reserve
blurb, the hold confirmation, the share path, the scarcity line, etc.).
Sweep them to "stay," "dates," or "trip" so the product does not assume
a two-night Fri to Sun booking. Audit every user-facing string in
`InquiryChatThread.tsx`, the harness system prompt, and the email
senders.

---

## 8. Build scope (file touchpoints)

| Area | File | Change |
|---|---|---|
| Opener | `InquiryChatThread.tsx` | self-intro copy; reorder so contact follows availability |
| Date flex | `InquiryChatThread.tsx` + `.module.css` | new toggle widget + `date_flex` state/signal |
| Celebrant | `InquiryChatThread.tsx` + `.module.css` | new `Me` + input widget, conditional on occasion; `celebrant_name` slot |
| Budget | `InquiryChatThread.tsx` | third card in the loading beat; `house_budget_pp` signal |
| Contact reorder | `InquiryChatThread.tsx` | move `contact_form` to after availability, before occasion |
| Signals | `harness.ts` | add `date_flex`, `celebrant_name`, `house_budget_pp`; keep `decision_timeline`, `decision_makers` |
| System prompt | `harness.ts` | new opener rules, celebrant + budget framing, the "stays not weekends" rule |
| Email | `abeNotification.ts` | add celebrant, flex, budget lines to the glance summary |
| Copy sweep | repo-wide | "weekend" to "stays/dates" |
| Eval | `evals/` | new scenarios (celebrant wording, budget steering, required contact) AND update existing scenarios broken by the reorder + required name |

---

## 8.1 Two lanes (do not forget the free-text path)

Everything in §5 is drawn as tap widgets, but the surface has **two
lanes** and the logic has to hold in both:

1. **Scripted tap-through** — the deterministic widget flow above.
2. **Agent-driven free chat** — when the guest types instead of tapping,
   the harness LLM composes the turns. `npm run eval` exercises *this*
   lane.

Every rule in §6 (the order, contact-before-occasion, celebrant wording
per occasion, birthday, the never-promise-a-cheaper-date guardrail, the
stays-not-weekends rule) must be encoded in the **harness system prompt**,
not just the widget code, or the typed lane will diverge. Treat the
system prompt as a first-class deliverable, and expect existing eval
scenarios to need updating, not just new ones added.

---

## 9. Open decisions for Abe / visual iteration

**Resolved this round:**
- Budget = a question in the loading beat (not a widget at reveal). Supersedes the earlier note.
- Birthday = added as a real occasion option.
- Contact = captured early and required (name, email, phone), tradeoff accepted (§6.2).

**Still open:**

1. **Loading beat carries three taps** (Q1, Q2, budget) instead of two.
   If that feels long, budget can move to its own step or become a
   single optional chip. (Current call: keep all three in the loading
   beat.)
2. **Flex placement** — currently after contact, before occasion. Could
   pair with the availability answer instead. (Current call: after
   contact.)
3. **Celebrant for `birthday`** — "birthday guest of honor" vs "birthday
   person" vs just the name. Visual iteration to settle the copy.
4. **`Me` celebrant follow-up tone** — how warm to go without being
   corny.
5. **Budget input format** — free number entry vs preset bands
   ($200 / $300 / $400 per person). Bands are faster but coarser.
