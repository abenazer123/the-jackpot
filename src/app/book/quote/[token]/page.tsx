/**
 * /book/quote/[token] — Step 4 of the funnel.
 *
 * Server-fetches the inquiry by share_token and hands the
 * inquiry + quote_snapshot to <QuoteReveal /> (client component
 * with all CTA logic). If the token doesn't match a row, the
 * standard not-found.tsx renders.
 *
 * The share_token is also reused by /trip/[token] (Phase 2 — the
 * read-only public share view). Same row, different views.
 */

import { notFound } from "next/navigation";

import { QuoteReveal } from "@/components/brand/funnel/QuoteReveal";
import { computeQuoteLive } from "@/lib/pricing/computeQuoteLive";
import type { Quote } from "@/lib/pricing/types";
import { supabaseServer } from "@/lib/supabase-server";

import styles from "./page.module.css";

interface QuotePageProps {
  params: Promise<{ token: string }>;
}

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const { data, error } = await supabaseServer()
    .from("inquiries")
    .select(
      "id, name, email, source, arrival, departure, guests, quote_snapshot, utm_source",
    )
    .eq("share_token", token)
    .maybeSingle();

  if (error) {
    console.error("[quote] fetch failed", error);
    notFound();
  }
  if (!data) notFound();

  let quote = (data.quote_snapshot ?? null) as Quote | null;
  const guests = (data.guests as number) ?? 0;
  const arrival = data.arrival as string;
  const departure = data.departure as string;
  const name = (data.name as string) ?? "";
  const email = (data.email as string) ?? "";

  // Re-compute on the fly for rows that were finalized before the
  // cache had data for these dates. Persist back so subsequent
  // loads are cached.
  if (!quote && arrival && departure && guests > 0) {
    const result = await computeQuoteLive({ arrival, departure, guests });
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
            console.warn("[quote] backfill persist failed", updErr);
          }
        });
    }
  }

  // Re-derive nights for the heading line.
  const nights = (() => {
    const a = new Date(arrival + "T00:00:00");
    const d = new Date(departure + "T00:00:00");
    return Math.max(1, Math.round((d.getTime() - a.getTime()) / 86_400_000));
  })();

  const dateRange = `${isoToDisplay(arrival)} \u2013 ${isoToDisplay(departure)}`;

  // Pull the live group tally so the coordinator sees how her
  // friends are reacting on the trip page. Cheap aggregate query
  // — counts only, no PII / per-viewer breakdown.
  const tally = await loadTally(data.id as string);

  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Here&rsquo;s your weekend.</h1>
      <p className={styles.body}>
        {dateRange} &middot; {nights} night{nights === 1 ? "" : "s"} &middot;{" "}
        {guests} {guests === 1 ? "guest" : "guests"}
      </p>

      {tally.total > 0 ? (
        <p className={styles.tally}>
          <span className={styles.tallyEyebrow}>Group says &rarr;</span>{" "}
          <span className={styles.tallyYes}>{tally.yes} like it</span>
          {tally.maybe > 0 ? (
            <>
              {" "}&middot;{" "}
              <span className={styles.tallyMaybe}>
                {tally.maybe} not sure
              </span>
            </>
          ) : null}
          {tally.no > 0 ? (
            <>
              {" "}&middot;{" "}
              <span className={styles.tallyNo}>
                {tally.no} sitting out
              </span>
            </>
          ) : null}
          {tally.reservations > 0 ? (
            <>
              {" "}&middot;{" "}
              <span className={styles.tallyReserved}>
                {tally.reservations} reserved
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {quote ? (
        <QuoteReveal
          inquiry={{
            id: data.id as string,
            name,
            email,
            source: (data.source as string | null) ?? null,
            attribution: {
              utm_source: (data.utm_source as string | null) ?? null,
            },
          }}
          quote={quote}
          shareToken={token}
        />
      ) : (
        <p className={styles.body}>
          I&rsquo;ll send your personalized quote to{" "}
          <span className={styles.email}>{email}</span> within the day.
        </p>
      )}
    </div>
  );
}

interface Tally {
  yes: number;
  maybe: number;
  no: number;
  reservations: number;
  total: number;
}

async function loadTally(inquiryId: string): Promise<Tally> {
  const sb = supabaseServer();
  const [votesRes, reservationsRes] = await Promise.all([
    sb.from("trip_votes").select("vote").eq("inquiry_id", inquiryId),
    sb
      .from("trip_reservations")
      .select("inquiry_id", { count: "exact", head: true })
      .eq("inquiry_id", inquiryId),
  ]);
  const tally: Tally = {
    yes: 0,
    maybe: 0,
    no: 0,
    reservations: reservationsRes.count ?? 0,
    total: 0,
  };
  for (const row of (votesRes.data ?? []) as Array<{ vote: string }>) {
    if (row.vote === "yes") tally.yes++;
    else if (row.vote === "maybe") tally.maybe++;
    else if (row.vote === "no") tally.no++;
  }
  tally.total = tally.yes + tally.maybe + tally.no + tally.reservations;
  return tally;
}
