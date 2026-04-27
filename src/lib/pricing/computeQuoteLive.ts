/**
 * computeQuoteLive — wraps `computeQuote` with a live PriceLabs
 * fallback. When the cache misses (out_of_window — typical for
 * dates beyond the nightly cron's reach, or before the first sync
 * runs), we hit PriceLabs directly for the requested range,
 * upsert the result into `listing_prices`, then re-run
 * `computeQuote`. The cache stays the source of truth — every
 * downstream consumer keeps reading from one place.
 *
 * Bounded: live fetch only happens for dates within the next 730
 * days from today (matches the cron's SYNC_DAYS). Past dates and
 * dates beyond that window get the same `out_of_window` error
 * `computeQuote` already returned.
 *
 * Idempotent on the cache write — `onConflict: listing_id,stay_date`
 * upserts. The cron sync overwrites any row we wrote here on its
 * next run.
 */

import { fetchListingPrices, type PriceLabsDayPrice } from "@/lib/pricelabs";
import { supabaseServer } from "@/lib/supabase-server";

import { computeQuote, type ComputeQuoteInput } from "./computeQuote";
import type { QuoteResult } from "./types";

const MAX_LOOKAHEAD_DAYS = 730;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(iso: string): number {
  const today = new Date(todayIso() + "T00:00:00Z").getTime();
  const target = new Date(iso + "T00:00:00Z").getTime();
  return Math.round((target - today) / 86_400_000);
}

async function readPriceLabsConfig(): Promise<
  { listingId: string; pms: string } | null
> {
  const { data, error } = await supabaseServer()
    .from("pricing_config")
    .select("key,value_text")
    .in("key", ["pricelabs_listing_id", "pricelabs_pms"]);
  if (error || !data) return null;
  let listingId: string | null = null;
  let pms: string | null = null;
  for (const row of data as Array<{
    key: string;
    value_text: string | null;
  }>) {
    if (row.key === "pricelabs_listing_id") listingId = row.value_text;
    if (row.key === "pricelabs_pms") pms = row.value_text;
  }
  if (!listingId || !pms) return null;
  return { listingId, pms };
}

async function backfillFromPriceLabs(
  arrival: string,
  departure: string,
): Promise<boolean> {
  const today = todayIso();
  // Past dates can't be priced live.
  if (departure <= today) return false;
  // Don't burn quota on stays > 730 days out.
  if (daysFromToday(arrival) > MAX_LOOKAHEAD_DAYS) return false;

  const cfg = await readPriceLabsConfig();
  if (!cfg) return false;

  const dateFrom = arrival < today ? today : arrival;
  // PriceLabs `dateTo` is inclusive in their API; our `departure` is
  // exclusive (checkout day). Send `departure` as-is — the extra
  // day doesn't hurt the cache and saves an off-by-one bug.
  const dateTo = departure;

  let prices;
  try {
    prices = await fetchListingPrices({
      id: cfg.listingId,
      pms: cfg.pms,
      dateFrom,
      dateTo,
    });
  } catch (err) {
    console.warn("[computeQuoteLive] PriceLabs live fetch failed", err);
    return false;
  }

  const fetchedAt = new Date().toISOString();
  const rows = prices.data.map((d: PriceLabsDayPrice) => {
    const unbookable = d.unbookable === 1;
    const booked = d.user_price === -1;
    return {
      listing_id: cfg.listingId,
      stay_date: d.date,
      rate_cents: Math.round((d.price ?? 0) * 100),
      min_stay: d.min_stay ?? 2,
      unbookable,
      available: !unbookable && !booked,
      demand_desc: d.demand_desc ?? null,
      currency: prices.currency || "USD",
      fetched_at: fetchedAt,
      raw_data: d,
    };
  });

  if (rows.length === 0) return false;

  const { error: upsertErr } = await supabaseServer()
    .from("listing_prices")
    .upsert(rows, { onConflict: "listing_id,stay_date" });
  if (upsertErr) {
    console.warn(
      "[computeQuoteLive] cache upsert failed, continuing anyway",
      upsertErr,
    );
    return false;
  }
  console.log(
    "[computeQuoteLive] backfilled",
    rows.length,
    "rows from PriceLabs",
  );

  return true;
}

/**
 * Compute a quote with live PriceLabs fallback when the cache is
 * cold for the requested dates. Triggers on:
 *
 *   - `out_of_window` — some dates in the range aren't cached.
 *   - `cache_empty`   — none of the requested dates have cache rows
 *                       (typical for dates beyond the 730-day cron
 *                       window). Same fix.
 *
 * `unavailable` is NOT retried — those dates are legitimately
 * booked/blocked, and a live fetch wouldn't change that.
 */
export async function computeQuoteLive(
  input: ComputeQuoteInput,
): Promise<QuoteResult> {
  const first = await computeQuote(input);
  if (first.ok) return first;
  const code = first.error.code;
  if (code !== "out_of_window" && code !== "cache_empty") return first;

  const filled = await backfillFromPriceLabs(input.arrival, input.departure);
  if (!filled) return first;
  // Retry from the now-populated cache.
  return computeQuote(input);
}
