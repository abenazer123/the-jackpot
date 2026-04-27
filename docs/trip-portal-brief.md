# Phase 2 — Trip portal share page

## Context

When the coordinator taps **"Share with my group"** on the quote
screen we (a) open a preview sheet with a copy-link affordance,
(b) point the link at a clean public page they can paste into
the group chat. The page's job is to get a row of thumbs-up
emojis from 11 friends in iMessage — not to convert those
friends. The friends are the coordinator's audience; the
coordinator is Abe's lead.

This phase builds the public page (`/trip/[token]`), the
preview sheet, the OG image, view tracking, and the
"share-fired" host signal email.

**Already shipped in Phase 1.5:**
- `inquiries.share_token` column (22-char nanoid).
- The token is generated on **every** finalize and returned in
  the API response. Every successfully finalized inquiry has a
  shareable URL by the time the visitor reaches the success
  screen.

## URL & lifetime

`https://thejackpotchi.com/trip/<token>`

- Same `share_token` as `/book/quote/[token]` — different routes,
  different views.
- **Expires after 60 days** (`shared_at + 60d` evaluated server-
  side). Stale-pricing dead links read worse than no link.
- Expired links render a graceful "This trip has moved on — but
  The Jackpot is still here" with a link back to `/`. Turns a
  dead end into a top-of-funnel visit.

## Page content (top → bottom)

The page is read by a friend in a group chat with ~3 seconds of
attention. The first thing on screen has to make them stop
scrolling.

1. **Hero photo strip** — `HeroPhotoCarousel` reused with the
   existing 6 brand photos (`brand/docs/photos/*.jpg`). Cover
   image dominates; remaining photos behind, swipeable, no auto-
   advance, no dot indicator. (Agent suggested single image —
   I'm keeping the carousel because group chats negotiate hard
   on photos and one shot can't carry a 5BR home. Default-paused
   carousel reads passive enough for cold viewers.)
2. **Eyebrow + hook** — placed immediately on or under the hero:
   *"An invitation from {firstName}"* (Cormorant italic, 13px,
   gold) → headline: *"The Jackpot · {dateRange} · {occasion}"*.
3. **Stay summary card** — dates, nights, **per-person price**
   leading (the only number the friend cares about), total,
   savings line.
4. **Where everyone sleeps** *(critical, was missing in v0
   plan)* — static property data. Clean list, no photos, no
   accordion:

   ```
   Bedroom 1   King
   Bedroom 2   Queen
   Bedroom 3   Two twins
   Bedroom 4   Queen
   Bedroom 5   Bunks + twin
   Sofa beds   Living room (2)
   ```

   Hardcoded in `src/lib/property/sleepingArrangements.ts` for
   v1. Single source of truth so the trip page + future
   accommodation routes both read from it. Real bedroom photos
   land later.
5. **3-4 photo grid** — small grid (NOT the full HighlightsGrid
   from landing — too heavy for a share page). Pulls 4 photos
   from the brand asset folder.
6. **Location context** — neighborhood + airport + downtown
   distance, in plain text. Two lines max:
   *"West Loop, Chicago. 18 min from O'Hare, 12 min from
   downtown."* No map for v1.
7. **CTA strip** *(ships in Push 3 — page goes out without it
   in Push 1)* — three actions for friends:
   - **Cast your vote** — YES / MAYBE / NO. Group-chat-speed
     signal. No name/email required. Coordinator sees the live
     tally on her quote screen.
   - **Reserve my stay** — stronger commitment. Friend leaves
     name + email; registered as one of the `{guests}` on the
     coordinator's inquiry. Visually heavier than vote.
   - **Talk to Abe** — mailto with a prefilled subject
     (*"Question about {firstName}'s Jackpot trip ({dateRange})"*).
     Routes specific questions to the host with full context.
8. **Quiet safety-valve footer** — *"Questions? Abe is the host
   — abe@thejackpotchi.com"*. Stays in addition to the CTA
   because not everyone reads buttons.

## What the page does NOT show

Phone, full email, address, inquiry id, attribution data,
appeal/share/CTA flags, anything that could leak coordinator
PII. Treat the URL as semi-public — anyone with the token can
view what's on the page and nothing else.

## OG image (ship with v1, not deferred)

The link unfurl in iMessage / WhatsApp / Slack IS the first
impression. If it unfurls blank, nobody taps it. If it unfurls
with a hero photo + dates + per-person price, everyone taps it.

`src/app/trip/[token]/opengraph-image.tsx` — Next.js dynamic
OG via `ImageResponse`:

- 1200×630, hero photo as background, dark gradient overlay.
- Headline (Cormorant italic): *"The Jackpot · {dateRange}"*
- Sub: *"${perPerson}/person · {occasion} weekend"*
- Bottom-right: small wordmark + thejackpotchi.com.

This is part of v1. Not optional.

## View tracking

Add `share_views integer not null default 0` to `inquiries`.
Increment server-side on each `/trip/[token]` page render,
deduplicated by IP within a 30-minute window (in-memory or
short-TTL cache — no per-viewer table; this is just a counter).

Surface the count in:
- Abe's host signal email when share fires:
  *"Trip page viewed 9 times so far."*
- A future host dashboard column.

Strong follow-up signal for Abe. *"Looks like 9 people have
checked out the trip page — any questions from the group?"*
reads informed, not pushy.

## Preview sheet on share-CTA tap

`src/components/brand/SharePreviewSheet.tsx` (+ CSS module).
Opens on the quote screen when the coordinator taps "Share
with my group". Replaces the current "Got it — Abe will send
your trip portal shortly" label flip with the sheet itself.

Contents (top → bottom):
- Eyebrow: *"Send this to your group"*.
- Mini-preview card — same vibe as the OG unfurl: hero photo
  thumbnail, title row, one-line description.
- URL displayed as a read-only `<input>` — full width, gold
  border, ⌥-monospace font for the path.
- Primary action: **Copy link** (gold pill). On click:
  `navigator.clipboard.writeText(share_url)`, button label
  flips to *"Copied ✓"* for 2.5s, then back.
- Secondary action: native share (`navigator.share`) when
  supported (iOS / Android Chrome / Safari). Hidden on desktop.
- Footer note: *"Anyone with this link can see your trip"* —
  small olive-secondary.

Dismiss: backdrop click, ESC, swipe-down on mobile.

## Host signal email when share fires

When the share API fires (current `flag_update` branch with
`primary_cta_path === "share"`):

1. Server checks if a "share-fired" signal email has already
   been sent for this inquiry. If yes, no-op (one per inquiry
   max — re-opening the preview sheet doesn't re-fire).
2. If no, send a small email to Abe:
   - Subject: *"📨 {name} just shared their trip page"*
   - Body: name, dates, total, current view count, link to the
     trip page Abe can open to see what the group is seeing.

Tracked via a new `share_email_sent_at timestamptz` column on
the inquiry. Idempotent.

## Confirmation email update

`src/lib/email/guestConfirmation.ts` — link to **the trip
portal**, not the quote page:

> "Here's your trip page — share it with your group when you're
> ready."
>
> [View your trip → thejackpotchi.com/trip/{token}]

Reasoning: the coordinator already saw the quote in the funnel.
What she needs three days later when she opens her email is the
link to share — not the same numbers on a different URL.

The trip page also shows the pricing, so it serves both
purposes (reference for the coordinator + pitch for the group).

## Migration

```sql
alter table public.inquiries
  add column if not exists share_views integer not null default 0,
  add column if not exists share_email_sent_at timestamptz,
  add column if not exists shared_at timestamptz;

-- shared_at populated on first /trip/[token] render or on share
-- CTA tap — whichever happens first. Used by the 60-day expiry.
```

The existing `share_token` column from Phase 1.5 stays as is.

## Files to add

- `supabase/migrations/{ts}_trip_portal.sql`
- `src/lib/property/sleepingArrangements.ts` — static bed list.
- `src/lib/property/location.ts` — neighborhood + travel times.
- `src/app/trip/[token]/page.tsx` — server component.
- `src/app/trip/[token]/page.module.css`
- `src/app/trip/[token]/not-found.tsx` — expired/missing link.
- `src/app/trip/[token]/not-found.module.css`
- `src/app/trip/[token]/opengraph-image.tsx` — dynamic OG.
- `src/components/brand/SharePreviewSheet.tsx` (+ CSS).
- `src/components/brand/trip/TripHero.tsx` — header lockup.
- `src/components/brand/trip/SleepingList.tsx`
- `src/components/brand/trip/PhotoGrid.tsx` — 4-up.
- `src/lib/email/hostShareNotice.ts` — share-fired host email.
- `src/lib/share/incrementViewCount.ts` — server util with IP
  dedupe.

## Files to change

- `src/app/api/inquiries/route.ts` — in flag-update branch when
  `primary_cta_path === "share"`: set `shared_at` if null,
  fire `sendHostShareNotice` once (gated on
  `share_email_sent_at`).
- `src/lib/email/guestConfirmation.ts` — link to /trip/[token]
  instead of the quote URL (or in addition, depending on
  current copy).
- `src/components/brand/funnel/QuoteReveal.tsx` — replace the
  `share_requested` button label flip with opening
  SharePreviewSheet. The flag-update API call stays.

## Reuse (no edits)

- `HeroPhotoCarousel` from
  `src/components/sections/HeroPhotoCarousel.tsx` + the
  `HERO_PHOTOS` const in `HeroSection.tsx`.
- Brand tokens (`/brand/tokens/brand.css`).
- `Wordmark` for the OG image (rendered as text in
  `ImageResponse`, not the React component).

## Verification (when we build)

1. iPhone 14 Pro Max viewport. Drive funnel through to quote
   screen → tap **Share with my group** → preview sheet opens
   with a real URL → tap **Copy link** → label flips to *"Copied
   ✓"* → paste into Notes shows the full URL.
2. Open URL in incognito → trip page renders with right photo,
   dates, per-person price, sleeping list, no PII. No CTAs.
3. Open URL with bogus token → expired/missing page.
4. Wait until `shared_at + 60 days` (or back-date in DB) → load
   URL → graceful "trip has moved on" page.
5. Reload `/trip/[token]` repeatedly within 30 min from same
   IP → view count increments once. From a different IP →
   increments again.
6. Paste URL into iMessage → unfurl shows hero + dates + price
   (OG image works).
7. First share CTA tap → Abe gets one signal email; subsequent
   re-opens of the preview sheet do NOT re-fire the email.
8. Confirmation email after a fresh inquiry contains the
   `/trip/[token]` link.
9. Lighthouse mobile run on `/trip/[token]` ≥ 90 perf + a11y.
10. Lint + typecheck clean.

## What's NOT in Phase 2 v1

- Real per-bedroom photos (placeholders / no photos for v1).
- Map embed in location section (text-only for v1).
- Editing / revoking individual share links (no host dashboard
  exists yet).
- Split-pay link from "Reserve my stay" — the v1 reserve CTA
  just registers the friend as a guest. A second iteration
  emails them a split-pay link with their per-person amount.

## Deferred (next phase, after v1 ships)

- **Per-viewer tracking** — Abe wants this. Anonymous per-
  viewer fingerprint (cookie-based) so the host can see
  "12 unique visitors, 4 voted YES, 1 reserved" rather than
  just totals. Ships after the page proves out.

## Resolved decisions (Phase 2 open questions)

1. **CTA destination on the trip page** → no CTAs, only a quiet
   `Questions? Abe is the host` line.
2. **Native share** → yes, on the preview sheet only. Trip page
   has no share buttons.
3. **Host email when share fires** → yes, idempotent (one per
   inquiry).
4. **Privacy / expiration** → 60-day soft expiry + graceful
   "still here" page.
