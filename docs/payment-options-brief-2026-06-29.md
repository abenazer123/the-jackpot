# Payment options at checkout: Reserve / Pay 50% / Pay 100%

Brief for visual iteration before build. Date: 2026-06-29.

## Goal

On the `/confirm/[token]` payment step, let the guest choose how much to
pay today instead of the single fixed $500 reserve. Three choices, same
grand total in every case (no discount, no surcharge):

1. **Reserve your dates.** $500 today. Balance follows the schedule.
2. **Pay half now.** 50% of the total today, final 50% by the milestone.
3. **Pay in full.** 100% today, nothing else due.

Decisions locked with Abe:

- Offer **all three**.
- **Default = Reserve $500** (lowest friction is the anti drop off mechanic;
  the guest can upgrade to 50 or 100 percent if they want).
- **No incentive** for paying more up front. Paying early is a convenience,
  not a deal. Protects margin and keeps the logic simple.

## Worked example (Kat, total $3,771)

| Option        | Due today   | Remaining after today                  |
| ------------- | ----------- | -------------------------------------- |
| Reserve $500  | $500.00     | balance to 50% by M1, then final 50%   |
| Pay half      | $1,885.50   | final $1,885.50 by M2                  |
| Pay in full   | $3,771.00   | nothing (only the $250 refundable hold)|

The $250 security hold near arrival applies in all three cases.

## The visual to iterate on (this is the part for the other agent)

The selector sits **above** the card form. Picking an option updates the
amount the card form will charge and re-renders the schedule beneath it.

Open questions for the visual pass:

- **Selector form:** three stacked radio "cards" (each with title, amount
  due today, one line of what is left) vs. a segmented control vs. a more
  compact toggle. Radio cards read clearest at three options; confirm.
- **Emphasis:** the $500 reserve is the default and the safest commitment.
  Should it be visually pre-selected only, or also labelled (e.g. "Most
  popular" / "Reserve") without making the other two feel penalized?
- **Amount hierarchy:** the "due today" number is the decision driver. It
  should be the largest type in each card; the "what is left" line is
  secondary.
- **Schedule below:** today it always shows the 3 step schedule. It now
  needs to reflect the chosen option (reserve = 3 steps, half = 2 steps,
  full = "Paid in full today"). Should the schedule animate/transition on
  change, or just swap?
- **Mobile:** three cards stacked; make sure the card form stays reachable
  without excessive scrolling.

Copy follows the brand voice: **no dashes of any kind** in any guest
facing text. Use periods or commas.

## Technical shape (for the build, after the visual is settled)

1. **Deposit route** accepts a `plan` of `reserve | half | full` and
   computes the amount **server side** from the inquiry's real
   `quote_total_cents` (never trusts a client supplied amount):
   - reserve: `DEPOSIT_NOW_USD * 100` ($500)
   - half: `Math.round(total / 2)`
   - full: `total`
   The PaymentIntent is (re)created for the chosen plan on submit.
2. **Card is saved in every case.** Reserve and half need it for the
   future milestone charges; full still needs it for the $250 hold. So
   `setup_future_usage: "off_session"` stays on regardless.
3. **Schedule helper** (`paymentSchedule`) becomes plan aware so the page,
   the PDF, and the certificate all show the same plan specific schedule.
4. **Agreement hash is unaffected.** `agreementCanonicalText()` hashes the
   terms text only (version + sections + acknowledgments), no dollar
   amounts. The payment plan is a payment detail, not a terms change.
5. **Record the choice.** Add a `payment_plan` text column to
   `booking_agreements` and store the actual amount charged today in
   `deposit_amount_cents`. Surface both in the Bookings tab, the PDF, and
   the certificate email.
6. **Auto charge tie in.** The scheduled milestone charges read the plan:
   reserve = 2 future charges, half = 1, full = 0. (Auto charge itself is
   a separate pending piece; this just makes the data ready for it.)

## Files this will touch (estimate)

- `src/lib/booking/agreement.ts` (plan aware `paymentSchedule`, a small
  `planAmountCents(total, plan)` helper)
- `src/components/booking/ConfirmBooking.tsx` (the selector + pass plan to
  the deposit call + re-render schedule)
- `src/components/booking/confirm.module.css` (selector styling)
- `src/app/api/booking/deposit/route.ts` (accept + validate `plan`,
  server side amount)
- `src/app/api/booking/sign/route.ts` (persist `payment_plan` + real
  amount)
- `src/lib/booking/agreementPdf.ts` + `src/lib/email/bookingCertificate.ts`
  (show the chosen plan + schedule)
- migration: `booking_agreements.payment_plan text`
- `src/app/admin/(panel)/bookings/page.tsx` (show the plan)

## Out of scope for this brief

- Auto charging the milestone payments (separate pending decision on
  decline / SCA handling).
- Any discount or pay in full incentive (explicitly declined).
