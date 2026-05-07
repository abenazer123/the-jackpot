/**
 * /trip/[token] — public trip portal.
 *
 * Server-fetches an inquiry by share_token. The page is the
 * coordinator's "pitch to her group chat" — read-only summary of
 * the stay (dates, per-person price, photos, sleeping arrangements,
 * location). No PII (no phone, full email, attribution data).
 *
 * 60-day expiry: rows older than `shared_at + 60d` (or never
 * shared yet but we'll set shared_at on first view) render the
 * graceful "trip has moved on" not-found page.
 *
 * Phase 2 Push 1: read-only render. View counter + share-fired
 * email + CTAs land in Push 2 / Push 3.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  TripReserveCta,
  TripTalkCta,
  TripVoteCta,
} from "@/components/brand/trip/CtaStack";
import { PhotoGrid } from "@/components/brand/trip/PhotoGrid";
import { ShareDock } from "@/components/brand/trip/ShareDock";
import { SleepingList } from "@/components/brand/trip/SleepingList";
import { TripHero } from "@/components/brand/trip/TripHero";
import { TripLocation } from "@/components/brand/trip/TripLocation";
import { ViewTracker } from "@/components/brand/trip/ViewTracker";
import { HeroPhotoCarousel } from "@/components/sections/HeroPhotoCarousel";
import { computeQuoteLive } from "@/lib/pricing/computeQuoteLive";
import type { Quote } from "@/lib/pricing/types";
import { reasonToOccasion } from "@/lib/property/location";
import { BRAND_PHOTOS } from "@/lib/property/photos";
import { siteOrigin } from "@/lib/siteOrigin";
import { supabaseServer } from "@/lib/supabase-server";

import styles from "./page.module.css";

interface TripPageProps {
  params: Promise<{ token: string }>;
}

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;
const EXPIRY_MS = 60 * 86_400_000;

function isoToLong(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

/** Pulled out of the render body so the React-Compiler purity
 *  linter is happy with `Date.now()` (impure-during-render). */
function isExpired(sharedAt: string): boolean {
  const sharedMs = new Date(sharedAt).getTime();
  const nowMs = Date.now();
  return nowMs - sharedMs > EXPIRY_MS;
}

export default async function TripPage({ params }: TripPageProps) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  // The booker's browser carries a per-token owner cookie (set on
  // finalize). When present we render the ShareDock instead of the
  // view tracker — owner views shouldn't inflate `share_views`.
  const cookieStore = await cookies();
  const isOwner =
    cookieStore.get(`jp_owner_${token}`)?.value === "1";

  const { data, error } = await supabaseServer()
    .from("inquiries")
    .select(
      "id, name, arrival, departure, guests, reason, quote_snapshot, shared_at",
    )
    .eq("share_token", token)
    .maybeSingle();

  if (error) {
    console.error("[trip] fetch failed", error);
    notFound();
  }
  if (!data) notFound();

  // Vote tally + this viewer's existing vote (if any). The CTA
  // shows just the total count pre-vote, and reveals the
  // breakdown only after the friend casts a vote — like a secret
  // ballot that opens once you participate.
  const inquiryId = data.id as string;
  const viewerId = cookieStore.get("jp_viewer")?.value ?? null;
  const [voteRowsRes, myVoteRes] = await Promise.all([
    supabaseServer()
      .from("trip_votes")
      .select("vote")
      .eq("inquiry_id", inquiryId),
    viewerId
      ? supabaseServer()
          .from("trip_votes")
          .select("vote")
          .eq("inquiry_id", inquiryId)
          .eq("viewer_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const initialTally = { yes: 0, love: 0, maybe: 0, total: 0 };
  for (const r of (voteRowsRes.data ?? []) as Array<{ vote: string }>) {
    if (r.vote === "yes") initialTally.yes++;
    else if (r.vote === "love") initialTally.love++;
    else if (r.vote === "maybe") initialTally.maybe++;
    // legacy "no" — quietly drop from the tally; the option no
    // longer exists.
  }
  initialTally.total =
    initialTally.yes + initialTally.love + initialTally.maybe;
  const myStoredVote =
    (myVoteRes.data as { vote?: string } | null)?.vote ?? null;
  const initialVote =
    myStoredVote === "yes" || myStoredVote === "love" || myStoredVote === "maybe"
      ? (myStoredVote as "yes" | "love" | "maybe")
      : null;

  // 60-day expiry. shared_at is null until the first share-CTA tap
  // or first view (set in Push 2). Pre-shared inquiries don't expire
  // because there's no "shared" anchor yet — they're treated as
  // freshly-minted.
  const sharedAt = data.shared_at as string | null;
  if (sharedAt && isExpired(sharedAt)) notFound();

  let quote = (data.quote_snapshot ?? null) as Quote | null;
  const arrival = data.arrival as string;
  const departure = data.departure as string;
  const guests = (data.guests as number) ?? 0;
  const occasion = ((data.reason as string) ?? "").toLowerCase() || "group";
  const name = (data.name as string) ?? "";

  // Old rows (or rows finalized when the cache was cold) may have
  // a null quote_snapshot. Re-compute on the fly using the live
  // PriceLabs fallback and persist back to the row so subsequent
  // loads are cached.
  if (!quote && arrival && departure && guests > 0) {
    const result = await computeQuoteLive({
      arrival,
      departure,
      guests,
      occasion: (data.reason as string) ?? undefined,
    });
    if (result.ok) {
      quote = result.quote;
      void supabaseServer()
        .from("inquiries")
        .update({
          quote_snapshot: result.quote,
          quote_total_cents: result.quote.totalCents,
        })
        .eq("share_token", token)
        .then(({ error: updErr }) => {
          if (updErr) {
            console.warn(
              "[trip] backfill quote_snapshot persist failed",
              updErr,
            );
          }
        });
    }
  }

  const nights = (() => {
    const a = new Date(arrival + "T00:00:00");
    const d = new Date(departure + "T00:00:00");
    return Math.max(1, Math.round((d.getTime() - a.getTime()) / 86_400_000));
  })();

  const dateRange = `${isoToLong(arrival)} \u2013 ${isoToLong(departure)}`;
  const totalCents = quote?.totalCents ?? 0;
  const perPersonCents =
    quote && guests > 0
      ? Math.round(quote.totalCents / guests / Math.max(1, nights))
      : 0;
  const showSavings =
    quote != null && quote.savedVsAirbnbCents > 0;

  return (
    <main className={styles.page} data-with-dock={isOwner ? "true" : "false"}>
      {isOwner ? null : <ViewTracker token={token} />}
      <div className={styles.photoStrip}>
        <HeroPhotoCarousel photos={BRAND_PHOTOS} intervalMs={60000} />
      </div>

      <div className={styles.content}>
        <TripHero
          firstName={firstNameOf(name)}
          dateRange={dateRange}
          occasion={occasion}
        />

        {quote ? (
          <>
            <section className={styles.summary}>
              <div className={styles.perPerson}>
                {fmt(perPersonCents)}
                <span className={styles.perPersonLabel}>per person/night</span>
              </div>
              <div className={styles.summaryMeta}>
                {nights} night{nights === 1 ? "" : "s"} &middot; {guests}{" "}
                {guests === 1 ? "guest" : "guests"}
              </div>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total for the group</span>
                <span className={styles.totalValue}>{fmt(totalCents)}</span>
              </div>
              {showSavings ? (
                <div className={styles.savings}>
                  Booking direct saves the group{" "}
                  {fmt(quote.savedVsAirbnbCents)} vs Airbnb.
                </div>
              ) : null}
            </section>
            <p className={styles.splitPay}>
              Each guest pays their share directly &mdash; no Venmo
              round-ups, no chasing friends down for cash.
            </p>
          </>
        ) : (
          <p className={styles.noQuote}>
            Pricing coming shortly &mdash; Abe is finalizing the numbers
            for these dates.
          </p>
        )}

        {!isOwner ? (
          <TripVoteCta
            token={token}
            bookerFirstName={firstNameOf(name)}
            initialTally={initialTally}
            initialVote={initialVote}
          />
        ) : null}

        <SleepingList />

        <PhotoGrid />

        <TripLocation
          occasion={reasonToOccasion((data.reason as string) ?? null)}
        />

        {!isOwner ? (
          <>
            <TripReserveCta
              token={token}
              bookerFirstName={firstNameOf(name)}
            />
            <TripTalkCta
              token={token}
              bookerFirstName={firstNameOf(name)}
              dateRange={dateRange}
            />
          </>
        ) : (
          <p className={styles.contact}>
            Questions? Abe is the host &mdash;{" "}
            <a
              href="mailto:abe@thejackpotchi.com"
              className={styles.contactLink}
            >
              abe@thejackpotchi.com
            </a>
          </p>
        )}
      </div>

      {isOwner ? (
        <ShareDock
          shareUrl={shareUrlFor(token)}
          dateRange={dateRange}
          firstName={firstNameOf(name)}
          quoteUrl={`/book/quote/${token}`}
        />
      ) : null}
    </main>
  );
}

function shareUrlFor(token: string): string {
  return `${siteOrigin()}/trip/${token}`;
}
