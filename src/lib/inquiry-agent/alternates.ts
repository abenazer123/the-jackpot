/**
 * Find nearby open date ranges when a guest's requested dates are
 * booked. Cache-only availability scan (listing_prices.available) plus
 * a real computeQuote for each surviving candidate, so the alternates
 * the guest sees carry true prices.
 *
 * Used by /api/inquiry-agent/quote: when the primary quote comes back
 * `unavailable`, we attach 2-3 alternates so the chat can render
 * tappable "here's what's open near you" cards instead of stranding
 * the guest.
 */

import { computeQuote } from "@/lib/pricing/computeQuote";
import { supabaseServer } from "@/lib/supabase-server";

export interface AlternateRange {
  arrival: string;
  departure: string;
  nights: number;
  totalCents: number;
  perGuestCents: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) /
      86_400_000,
  );
}

async function readListingId(): Promise<string | null> {
  const { data } = await supabaseServer()
    .from("pricing_config")
    .select("value_text")
    .eq("key", "pricelabs_listing_id")
    .single();
  return (data?.value_text as string | undefined) ?? null;
}

/**
 * @param arrival requested arrival (ISO)
 * @param departure requested departure (ISO, exclusive checkout)
 * @param guests guest count
 * @param max how many alternates to return (default 3)
 */
export async function findAlternateRanges(
  arrival: string,
  departure: string,
  guests: number,
  max = 3,
): Promise<AlternateRange[]> {
  const nights = diffDays(arrival, departure);
  if (nights < 1) return [];

  const listingId = await readListingId();
  if (!listingId) return [];

  // Scan window: 21 days before the requested arrival through 35 days
  // after, floored at today. Wide enough to find a nearby weekend,
  // tight enough to stay one cache read.
  const today = todayIso();
  let scanStart = addDays(arrival, -21);
  if (scanStart < today) scanStart = today;
  const scanEnd = addDays(arrival, 35 + nights);

  const { data, error } = await supabaseServer()
    .from("listing_prices")
    .select("stay_date,available")
    .eq("listing_id", listingId)
    .gte("stay_date", scanStart)
    .lte("stay_date", scanEnd)
    .order("stay_date", { ascending: true });
  if (error || !data) return [];

  const availableByDate = new Map<string, boolean>();
  for (const row of data as Array<{ stay_date: string; available: boolean }>) {
    availableByDate.set(row.stay_date, row.available);
  }

  // Slide an N-night window. A candidate [d, d+nights) is viable when
  // every night in it is available in the cache. Skip the exact
  // requested range (that's what was unavailable). Prefer candidates
  // closest to the original arrival, and keep them spread out so we
  // don't return three near-identical weekends.
  const candidates: Array<{ arrival: string; departure: string; dist: number }> = [];
  for (const startDate of availableByDate.keys()) {
    if (startDate < today) continue;
    if (startDate === arrival) continue;
    let allOpen = true;
    for (let i = 0; i < nights; i++) {
      if (availableByDate.get(addDays(startDate, i)) !== true) {
        allOpen = false;
        break;
      }
    }
    if (!allOpen) continue;
    candidates.push({
      arrival: startDate,
      departure: addDays(startDate, nights),
      dist: Math.abs(diffDays(arrival, startDate)),
    });
  }

  candidates.sort((a, b) => a.dist - b.dist);

  // Spread: require at least `nights` days between picked alternates so
  // they read as distinct options.
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.every((p) => Math.abs(diffDays(p.arrival, c.arrival)) >= nights)) {
      picked.push(c);
    }
    if (picked.length >= max) break;
  }

  // Price each survivor for real. Drop any that fail to quote.
  const out: AlternateRange[] = [];
  for (const c of picked) {
    const q = await computeQuote({ arrival: c.arrival, departure: c.departure, guests });
    if (q.ok) {
      out.push({
        arrival: c.arrival,
        departure: c.departure,
        nights,
        totalCents: q.quote.totalCents,
        perGuestCents: q.quote.perGuestCents,
      });
    }
  }
  return out;
}
