# Phase 2 — Trip portal share page

## Context

When a guest taps **"Share with my group"** on the success screen,
we want to (a) generate a shareable URL pointing to a simple page
that holds the inquiry info + a sample of the landing-page content,
and (b) open a preview sheet with a copy-link affordance so they
can paste it into their group chat.

Phase 1 already persists `share_requested = true` and
`primary_cta_path = "share"` on the inquiry row, and flips the
button label to "Got it — Abe will send your trip portal shortly".
Phase 2 replaces "Abe will send" with the page actually existing
and being shareable in the moment.

## What the URL looks like

`https://thejackpotchi.com/trip/<token>`

`<token>` is a 22-char URL-safe random string (nanoid alphabet)
stored in a new `inquiries.share_token` column. NOT the inquiry
UUID — UUIDs leak DB row IDs and feel utility-grade. A separate
token reads as a cleaner public identifier and lets us revoke later.

## What the page renders (server-rendered, SEO-friendly)

Layout (top → bottom, scrolling):

1. **Wordmark + invitation eyebrow**
   *"An invitation from {name}"* — Cormorant italic, 13px, gold.
   Wordmark above it as the page lock-up.
2. **Stay summary card**
   - Big italic Cormorant: "Sep 26 → Sep 28"
   - Sub: "2 nights · 6 guests · birthday weekend"
   - Total price: $3,181 — "$265 per person per night"
   - Saved vs Airbnb chip (reused from quote).
3. **Hero photo carousel**
   Reuse `HeroPhotoCarousel` from `src/components/sections/HeroPhotoCarousel.tsx`
   with the existing `HERO_PHOTOS` array (6 photos, brand-curated).
4. **Highlights grid / rooms strip**
   Reuse `HighlightsGrid` (the magazine + room cards) from
   `src/components/sections/HighlightsGrid.tsx` so the trip page
   feels like a slice of the landing page, not a separate brochure.
5. **A note from Abe** (lightweight)
   Small block — Abe headshot from `brand/docs/photos/abe.jpg`,
   one-line "I'm holding these dates for {name}'s group. Questions?
   abe@thejackpotchi.com — text 312-…".
6. **CTAs (two side-by-side)**
   - **"I'm in — count me in"** — opens a mailto:{guest_email}?subject=I'm+in. The guest's group sends a one-tap "yes" back to whoever shared.
   - **"Talk to Abe"** — mailto:abe@thejackpotchi.com with the dates pre-filled in the subject.

Things we **do NOT** show: phone number, email, exact home address,
inquiry ID, attribution data. Treat the URL as semi-public — anyone
with the link can see what's on the page.

## Preview sheet on share-CTA tap

New component `src/components/brand/SharePreviewSheet.tsx` (+ CSS module).

When the user taps "Share with my group":
1. `flagInquiry({ share_requested, primary_cta_path: "share" })`
   posts to `/api/inquiries`. Server now generates a share_token
   if one isn't set yet, persists it, and returns
   `share_url: "https://thejackpotchi.com/trip/<token>"` in the
   response.
2. The success screen opens `SharePreviewSheet` (a bottom-sheet on
   mobile, centered modal on desktop) instead of just flipping the
   button label.
3. Sheet contents (top → bottom):
   - Eyebrow: "Send this to your group"
   - Mini-preview card — same vibe as a Telegram/iMessage link
     unfurl: hero photo thumbnail, title "The Jackpot · {dates} ·
     ${total}", one-line description.
   - URL displayed as a read-only `<input>` — full width, gold
     border, ⌥-monospace font for the path.
   - Primary action: **"Copy link"** — gold pill. On click:
     `navigator.clipboard.writeText(share_url)`, button label
     flips to "Copied ✓" for 2.5s, then back.
   - Secondary affordance: native share button (Web Share API)
     when supported — `navigator.share({ title, url })`. Falls
     back to copy-link on desktop.
   - Footer note: "Anyone with this link can see your trip" —
     small olive-secondary text.
4. Dismiss: backdrop click, ESC, swipe-down on mobile.

The "Got it — Abe will send your trip portal shortly" copy gets
replaced with the live preview — Abe doesn't need to send
anything anymore.

## API changes (`src/app/api/inquiries/route.ts`)

In the FLAG-UPDATE branch, when `primary_cta_path === "share"`:

```ts
let shareToken = row.share_token as string | null;
if (!shareToken) {
  shareToken = generateShareToken(); // 22-char nanoid alphabet
  patch.share_token = shareToken;
}
// …existing patch + email logic…
return NextResponse.json({
  ok: true,
  inquiry_id: flagInquiryId,
  share_url: shareToken
    ? `${siteUrl()}/trip/${shareToken}`
    : null,
});
```

Idempotent — re-tapping share won't rotate the token.

Optionally, add a small **host email** ("X is sharing your trip
with {n} people") so Abe knows the link went out — but only the
first time, not on every preview-modal open. Default OFF for now;
revisit after we see usage.

## Files to add / change

**Add:**
- `supabase/migrations/{ts}_share_token.sql`
  ```sql
  alter table public.inquiries
    add column if not exists share_token text;
  create unique index if not exists inquiries_share_token_idx
    on public.inquiries (share_token)
    where share_token is not null;
  ```
- `src/lib/share/generateShareToken.ts` — 22-char URL-safe random.
  Use `crypto.randomUUID()` truncated, or `nanoid` if we add it.
- `src/lib/share/shareUrl.ts` — `siteUrl()` helper that reads
  `NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` (already used
  in `layout.tsx`).
- `src/app/trip/[token]/page.tsx` — server component. Fetches the
  inquiry by token from Supabase. If not found → render a tasteful
  404 ("This link has expired or moved").
- `src/app/trip/[token]/page.module.css` — page-level styles.
- `src/app/trip/[token]/not-found.tsx` — fallback.
- `src/app/trip/[token]/opengraph-image.tsx` — dynamic OG image
  (nice-to-have, can defer) so iMessage/WhatsApp link unfurls
  show the hero photo + dates + price.
- `src/components/brand/SharePreviewSheet.tsx` + `.module.css`
- `src/components/brand/TripPortalContent.tsx` — extracted
  read-only content used by the route page (and reusable for the
  preview's mini-card).

**Change:**
- `src/app/api/inquiries/route.ts` — generate/persist share_token in
  the FLAG-UPDATE branch when path === "share"; return share_url.
- `src/components/brand/BookingFunnelSteps.tsx`:
  - `flagInquiry` (or a wrapper) returns the response so the share
    handler can read `share_url`.
  - `handleShareRequest` opens `SharePreviewSheet` after the API
    call resolves.

**Reuse (no edits):**
- `src/components/sections/HeroPhotoCarousel.tsx` (+ HERO_PHOTOS
  list from `HeroSection.tsx`).
- `src/components/sections/HighlightsGrid.tsx`.
- `src/components/sections/MeetAbe.tsx` (or just the Abe headshot
  + a one-line note).
- `src/components/brand/Wordmark.tsx`.
- Brand tokens (`/brand/tokens/brand.css`).

## Open design questions (worth resolving before I build)

1. **CTA destination** on the trip page — `mailto:{guest_email}` so
   the group reply-alls back to whoever shared, OR a small "I'm
   in" form that pings the guest + Abe? Mailto is simpler and
   ships day one.
2. **Native share** — yes/no? If yes, `navigator.share` works on
   iOS/Android Chrome+Safari but not desktop. Falls back to copy.
3. **Host email when share fires** — currently we suppress the
   path-signal email for share (Phase 1 decision: signal email
   only for "interested" / "appeal"). With a real share URL
   existing, do we want Abe to get a quiet "X is sharing the link"
   note? My recommendation: yes, one email per inquiry max (don't
   re-send if they re-open the preview).
4. **Privacy** — token-gated is enough? Or do we want to add
   `expires_at` (e.g., 60 days from share) so old links die?

## Verification (when we build)

1. iPhone 14 Pro Max viewport. Drive funnel to success → tap
   Share with my group → preview sheet opens → URL is visible →
   tap Copy link → button flips to "Copied ✓" → paste into
   notes app shows the full URL.
2. Open the URL in an incognito window → trip page renders with
   the right dates/price/name, no PII (phone, email).
3. Open the URL with a bogus token → graceful 404.
4. Reopen the success screen and tap share again → same URL is
   returned (token didn't rotate).
5. Lighthouse mobile run on `/trip/<token>` → still > 90 on
   performance + accessibility (it's mostly static content).
6. Web Share API works on mobile Safari (real device or emulator);
   Copy fallback works in desktop Chrome.

## What I'm explicitly NOT doing in Phase 2

- Editing/revoking share links from a host dashboard (no
  dashboard exists yet).
- Tracking individual share viewers (would need a separate
  `share_views` table — defer until we see if anyone uses it).
- Embedding a booking flow on the trip page itself ("reserve from
  here") — first version routes back to the main funnel via the
  "Talk to Abe" CTA.
