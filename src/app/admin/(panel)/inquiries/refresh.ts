/**
 * Shared refresh helpers for the admin inquiries view.
 *
 * Two operations the page exposes:
 *
 *   1. refreshAvailabilityCache(rows) — hits PriceLabs once for the
 *      combined date range across the given inquiries, upserts into
 *      listing_prices. Powers the "open dates only" filter (so the
 *      filter reflects today's reality, not the last cron run).
 *
 *   2. refreshAllPrices() — does (1) plus computes a fresh quote for
 *      every future-dated inquiry and writes it back to
 *      quote_refreshed_total_cents + quote_refreshed_snapshot +
 *      quote_refreshed_at. The trip-page render still gates the
 *      "honor the lower price" badge on direction; writing upward
 *      refreshes here doesn't leak to guests.
 *
 * Both ops are no-ops when there are no future-dated inquiries.
 */

import { fetchListingPrices } from "@/lib/pricelabs";
import { computeQuote } from "@/lib/pricing/computeQuote";
import { supabaseServer } from "@/lib/supabase-server";

interface RangeRow {
  id: string;
  arrival: string | null;
  departure: string | null;
  guests: number | null;
  reason: string | null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Combined arrival..departure across a list of rows, clamped to today
 *  on the low end. Returns null if no row has a usable future range. */
function combinedRange(rows: RangeRow[]): { from: string; to: string } | null {
  const today = todayIso();
  let minA: string | null = null;
  let maxD: string | null = null;
  for (const r of rows) {
    if (!r.arrival || !r.departure) continue;
    if (r.departure <= today) continue;
    const a = r.arrival < today ? today : r.arrival;
    if (minA == null || a < minA) minA = a;
    if (maxD == null || r.departure > maxD) maxD = r.departure;
  }
  if (!minA || !maxD) return null;
  return { from: minA, to: maxD };
}

async function readPriceLabsConfig(): Promise<
  { listingId: string; pms: string } | null
> {
  const { data } = await supabaseServer()
    .from("pricing_config")
    .select("key,value_text")
    .in("key", ["pricelabs_listing_id", "pricelabs_pms"]);
  let listingId: string | null = null;
  let pms: string | null = null;
  for (const row of (data ?? []) as Array<{ key: string; value_text: string | null }>) {
    if (row.key === "pricelabs_listing_id") listingId = row.value_text;
    if (row.key === "pricelabs_pms") pms = row.value_text;
  }
  if (!listingId || !pms) return null;
  return { listingId, pms };
}

/**
 * Refresh listing_prices from PriceLabs for the combined date range of
 * the given rows. Single API call. Idempotent — overwrites existing
 * cache rows. Safe to call repeatedly.
 *
 * Returns the row count it wrote, or 0 on early-bail (no rows in range,
 * config missing, or PriceLabs error).
 */
export async function refreshAvailabilityCache(
  rows: RangeRow[],
): Promise<number> {
  const range = combinedRange(rows);
  if (!range) return 0;

  const cfg = await readPriceLabsConfig();
  if (!cfg) {
    console.warn("[admin/inquiries/refresh] PriceLabs config missing");
    return 0;
  }

  let prices;
  try {
    prices = await fetchListingPrices({
      id: cfg.listingId,
      pms: cfg.pms,
      dateFrom: range.from,
      dateTo: range.to,
    });
  } catch (err) {
    console.warn("[admin/inquiries/refresh] PriceLabs fetch failed", err);
    return 0;
  }

  const fetchedAt = new Date().toISOString();
  const upsertRows = prices.data.map((d) => {
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
  if (upsertRows.length === 0) return 0;

  const { error } = await supabaseServer()
    .from("listing_prices")
    .upsert(upsertRows, { onConflict: "listing_id,stay_date" });
  if (error) {
    console.warn("[admin/inquiries/refresh] cache upsert failed", error);
    return 0;
  }
  return upsertRows.length;
}

/**
 * Recompute today's quote for each future-dated inquiry and write it
 * back to the quote_refreshed_* columns. Runs the availability refresh
 * first so the per-inquiry quote reads from fresh cache.
 *
 * Returns a summary the caller can surface to the operator.
 */
export async function refreshAllPrices(): Promise<{
  cacheRowsWritten: number;
  quotesRefreshed: number;
  quotesFailed: number;
}> {
  // Pull every inquiry with a future-dated stay. We don't gate on
  // status — both partial and submitted rows are worth pricing.
  const today = todayIso();
  const { data, error } = await supabaseServer()
    .from("inquiries")
    .select("id, arrival, departure, guests, reason")
    .gte("departure", today);
  if (error) {
    console.warn("[admin/inquiries/refresh] inquiries read failed", error);
    return { cacheRowsWritten: 0, quotesRefreshed: 0, quotesFailed: 0 };
  }

  const futureRows = ((data ?? []) as RangeRow[]).filter(
    (r) => r.arrival && r.departure,
  );
  if (futureRows.length === 0) {
    return { cacheRowsWritten: 0, quotesRefreshed: 0, quotesFailed: 0 };
  }

  const cacheRowsWritten = await refreshAvailabilityCache(futureRows);

  // Compute fresh quotes in parallel. Each call hits Supabase for
  // pricing_config + the just-warmed listing_prices + discounts; at
  // our scale that's fine to fan out without a chunked semaphore.
  //
  // Guest-count fallback: partial drafts (and a handful of older
  // submitted rows) have no `guests` captured. Mirror what the
  // /api/inquiries draft path does and substitute the house max (14)
  // so we still show a New-price estimate. The quote is "best case"
  // at full capacity — same convention the public funnel uses
  // pre-finalize, so admins reading the column already know what it
  // means.
  const GUESTS_FALLBACK = 14;
  const now = new Date().toISOString();
  const results = await Promise.all(
    futureRows.map(async (row) => {
      if (!row.arrival || !row.departure) {
        return { ok: false as const, id: row.id };
      }
      const guests = row.guests && row.guests > 0 ? row.guests : GUESTS_FALLBACK;
      const r = await computeQuote({
        arrival: row.arrival,
        departure: row.departure,
        guests,
        occasion: row.reason ?? undefined,
      });
      if (!r.ok) return { ok: false as const, id: row.id };
      return {
        ok: true as const,
        id: row.id,
        snapshot: r.quote,
        totalCents: r.quote.totalCents,
      };
    }),
  );

  // Bulk-write the successful refreshes one row at a time. Postgres
  // upserts on a column subset are awkward through supabase-js; the
  // sequential update is fast enough for low-hundred row counts.
  let refreshed = 0;
  let failed = 0;
  for (const res of results) {
    if (!res.ok) {
      failed += 1;
      continue;
    }
    const { error: updErr } = await supabaseServer()
      .from("inquiries")
      .update({
        quote_refreshed_snapshot: res.snapshot,
        quote_refreshed_total_cents: res.totalCents,
        quote_refreshed_at: now,
      })
      .eq("id", res.id);
    if (updErr) {
      console.warn("[admin/inquiries/refresh] update failed", res.id, updErr);
      failed += 1;
      continue;
    }
    refreshed += 1;
  }

  return { cacheRowsWritten, quotesRefreshed: refreshed, quotesFailed: failed };
}
