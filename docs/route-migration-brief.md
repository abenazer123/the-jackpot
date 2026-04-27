# Phase 1.5 — Move the funnel out of the modal and onto real routes

## Context

Today everything past "Check availability" lives inside a
`<dialog>` rendered by `BookingBottomSheet` (mobile) /
`BookingPricingModal` (desktop). Making that modal full-screen on
mobile in Phase 1 papered over the architectural mismatch but
introduced visible symptoms:

- Momentary flash of the landing page underneath as the sheet
  slides in.
- Background page scrolls when the user scrolls inside the sheet.
- Browser back button doesn't follow the funnel — it closes the
  modal entirely, dumping any in-progress state.
- Refreshing mid-funnel loses your place (the draft localStorage
  helps a little but doesn't reopen the modal automatically on
  the right step).
- No URL surface for any step → can't deep-link, can't share a
  half-filled draft, can't resume on another device.

Routes solve all five. The funnel is a multi-step journey, not a
quick action — it deserves real pages.

This must land **before** the trip-portal work (Phase 2) so the
share page slots into the same `/book` + `/trip` URL namespace
cleanly the first time.

## Routes

```
/                            → landing (unchanged)
/book                        → smart redirect (see /book logic below)
/book/checking               → Step 2: branded pulse + draft POST
/book/details                → Step 3: name, phone, guests, occasion
/book/quote/[token]          → Step 4: quote reveal with 3 CTA paths
/trip/[token]                → (Phase 2) public read-only share page
```

`[token]` is a single 22-char nanoid stored on `inquiries.share_token`.
Used for both `/book/quote/[token]` (interactive booker view) and
`/trip/[token]` (public read-only share view) — same token,
different routes. UUIDs-with-hyphens look utility-grade in a URL
bar and paste poorly in text messages; a nanoid is short and
URL-clean.

If the coordinator shares the quote URL in the group chat alongside
the trip URL, the group sees both views — that's a feature, not a
risk. If we ever need to revoke just the public share without
breaking the booker's view, we add a `share_revoked_at` column the
trip route checks but the quote route ignores. No extra work now.

Step 1 ("collect" — fill missing dates/email) is rarely reached
today because the hero captures everything. We collapse it: if
arrival/departure/email aren't all set when someone lands on
`/book/checking`, redirect them back to `/` (where the hero bar
will catch the gap).

Each step's URL is a real page — back/forward navigation works,
refresh stays put, every screen has a shareable URL.

## State / persistence

Three layers, in order of authority:

1. **URL** — `/book/quote/[id]` carries the inquiry id; the page
   reads it and fetches from Supabase server-side.
2. **`jp_funnel_draft` localStorage** — already exists in
   `src/lib/funnel-draft.ts`. Holds dates, email, name, phone,
   guests, reason. Survives refresh + nav. Cleared on success.
3. **React state on each page** — local form state only. Hydrated
   from localStorage on mount (existing pattern).

The inquiry id from the finalize POST becomes the route param.
After form submit, `router.push(\`/book/quote/\${id}\`)`. No more
"keyed remounts to reset state" pattern — fresh navigation gives
us that for free.

## Ownership / token model

No auth in v1. The route `/book/quote/[token]` is a public URL
guarded only by the unguessability of a 22-char nanoid (~131 bits
of entropy — effectively zero brute-force risk).

CTAs on the quote route mutate inquiry state (`primary_cta_path`,
`appeal_text`, etc.) but the worst-case "someone else taps Hold my
dates on the booker's behalf" is recoverable: Abe sees every CTA
fire in Supabase, name + phone are already on the row, and the
follow-up call confirms intent. Acceptable v1 risk.

Same token on both `/book/quote/[token]` and `/trip/[token]`. If
ever we need to revoke the share without invalidating the booker's
quote URL, add a `share_revoked_at` column the trip route honors
and the quote route ignores. Defer until needed.

## Animations / transitions

- Each `/book/*` page gets a soft fade-in (300ms opacity + 8px
  translate) on mount — same `stepEnter` animation we already use
  in `BookingFunnelSteps.module.css`. No more `sheetIn`
  translateY-100% slide; that was the modal-era affordance.
- Reduced-motion users get an instant render (we already respect
  `prefers-reduced-motion`).
- Future-nice-to-have: Next.js 16 View Transitions API for
  cross-page slides. **Skip for v1** — fade is enough.

## Layout

New `src/app/book/layout.tsx`:

- Brand background (`--jp-bg-primary`, the warm linen).
- Lightweight header: Wordmark (links home), maybe a small
  "Step X of 3" indicator on the left.
- Content area centered, max-width like the current modal card
  on desktop, full-bleed-with-padding on mobile (matches the
  current full-screen sheet).
- Footer-like back link / "Take me home" escape (bottom of the
  page on mobile, header on desktop).

The shared providers (`PostHogProvider`, `UtmProvider`,
`HostPresenceProvider`) already wrap the root layout — funnel
pages inherit them automatically.

## Entry-point changes

- `src/components/brand/HeroBookingBar.tsx`:
  - Submit handler stops calling `setModalOpen(true)`.
  - Instead: writes the draft (already does this), then
    `router.push("/book/checking")`.
  - "Continue where you left off →" CTA navigates to the deepest
    step the draft supports (e.g. if name+phone are filled,
    jump to `/book/details`).
- `src/components/brand/StickyBookingBar.tsx`: same change.
- `BookingBottomSheet.tsx`, `BookingPricingModal.tsx`,
  `BookingBottomSheet.module.css`,
  `BookingPricingModal.module.css`: **deleted** at the end of
  the migration.

## Funnel content split

`BookingFunnelSteps.tsx` (1,275 lines) contains all four steps
plus shared state. Split it cleanly:

- `src/app/book/checking/page.tsx` — Step 2 only. Reads draft,
  fires draft POST, renders the four animated beats, navigates to
  `/book/details` on advance. Mostly client-component.
- `src/app/book/details/page.tsx` — Step 3. Form fields, finalize
  POST, navigates to `/book/quote/[id]` on success.
- `src/app/book/quote/[id]/page.tsx` — Step 4. Server component
  fetches the inquiry by id (similar shape to the trip-portal
  page later), renders quote + 3 CTA paths. CTAs still hit the
  flag-update API as before.

Shared bits → keep in `src/components/brand/`:

- `QuoteReveal` (extract from `BookingFunnelSteps.tsx`) — the
  big success-screen component including all 3 CTA paths and
  The Details accordion. Used by both `/book/quote/[id]` (interactive)
  and the trip portal (read-only).
- `CheckingBeat`, `DetailsForm` — extracted as needed.
- `BookingFunnelSteps.tsx` itself: deleted at the end (or kept
  as a thin re-export shim during the cutover).

## Migration strategy (in this order)

1. Add the new routes as **skeletons** that render the existing
   `BookingFunnelSteps` component for their step. Don't break
   the modal yet — both paths coexist briefly.
2. Switch the hero entry point to navigate to `/book/checking`.
   Modal still works as a fallback if something breaks.
3. Migrate the sticky bar entry point.
4. Extract the per-step pieces from `BookingFunnelSteps.tsx`
   into proper page components.
5. Remove the modal shells (`BookingBottomSheet`,
   `BookingPricingModal`) and the modal state from the entry
   points.
6. Push.

Each step is independently shippable — if step 4 reveals a
problem, we hold off on step 5 without users noticing.

## Files to add

- `src/app/book/layout.tsx`
- `src/app/book/page.tsx` — redirects to `/book/checking` (or `/`
  if no draft)
- `src/app/book/checking/page.tsx`
- `src/app/book/details/page.tsx`
- `src/app/book/quote/[id]/page.tsx`
- `src/app/book/quote/[id]/not-found.tsx`
- `src/components/brand/QuoteReveal.tsx` (extracted)
- `src/components/brand/QuoteReveal.module.css`

## Files to change

- `src/components/brand/HeroBookingBar.tsx`
- `src/components/brand/StickyBookingBar.tsx`
- `src/components/brand/BookingFunnelSteps.tsx` — gradually
  shrinks to nothing as pieces extract; deleted at the end.

## Files to delete (final commit)

- `src/components/brand/BookingBottomSheet.tsx`
- `src/components/brand/BookingBottomSheet.module.css`
- `src/components/brand/BookingPricingModal.tsx`
- `src/components/brand/BookingPricingModal.module.css`
- `src/components/brand/BookingFunnelSteps.tsx`
- `src/components/brand/BookingFunnelSteps.module.css` (split
  into per-component CSS modules)

## /book smart-redirect logic (resolved)

`/book/page.tsx` reads the `jp_funnel_draft` localStorage on the
client and routes to the deepest valid step:

1. Draft has a finalized `inquiry_id` (we'll track this on the
   draft alongside the existing fields) → `/book/quote/[token]`.
   This is the "I already submitted, then closed the tab" case.
2. Draft has dates + email but no inquiry_id → `/book/checking`.
   The draft POST will run there.
3. Draft is empty / missing dates or email → `/`. The hero bar
   catches whatever's missing.
4. No draft at all → `/`.

Nobody types `/book` manually — they arrive via "Continue where
you left off →" from the hero or sticky bar — but the smart
redirect makes it correct in either case.

Implementation note: this means `/book/page.tsx` needs to be a
small client component that reads localStorage on mount and
calls `router.replace()`. Render a brief "Resuming…" state
during the redirect to avoid a flash of blank.

## Resolved decisions

1. **`/book/checking` stays a real route.** Stable save point —
   browser back from `/book/details` works, network errors land
   on a page that can render a retry, no awkward overlay-on-
   landing for error states.
2. **Single nanoid token, no auth, used by both `/book/quote/[token]`
   and `/trip/[token]`.** ~131-bit entropy makes guessing a
   non-issue. UUID-with-hyphens looks utility-grade; the nanoid
   format pastes cleanly into iMessage/WhatsApp.
3. **`/book` redirects via the four-case ladder above.**

## Verification (when we build)

1. iPhone 14 Pro Max viewport. Click hero CTA → routes to
   `/book/checking` with no flash, no scroll bleed.
2. Animation runs → routes to `/book/details`.
3. Fill form → submit → routes to `/book/quote/<id>`.
4. Hit browser back → returns to `/book/details` with form data
   intact (from draft localStorage).
5. Hit refresh on `/book/quote/<id>` → page re-renders with
   server-fetched inquiry.
6. Hit refresh on `/book/details` → form re-hydrates from
   draft.
7. Direct nav to `/book/quote/<bogus-uuid>` → 404 page.
8. Direct nav to `/book/checking` with empty draft → redirects
   to `/`.
9. Desktop wide viewport: same flow, layout uses centered card
   width like the current modal.
10. Lint + typecheck clean.
11. Lighthouse mobile run on `/book/quote/<id>` → ≥ 90 on
    perf + a11y.

## What's NOT in Phase 1.5

- The trip portal page (`/trip/[token]`) — that's Phase 2 and
  builds **on top of** this work.
- The share-preview sheet that opens on "Share with my group" —
  also Phase 2.
- Any pricing-config or quote-snapshot changes.
- Any auth / sign-in flow.

## Time estimate

Half-day of focused work, in two pushes:

- Push 1: Routes + entry-point swap (visible bug fixes ship
  immediately — no more bg bleed).
- Push 2: Cleanup — delete modal shells + finish the funnel
  component extraction.
