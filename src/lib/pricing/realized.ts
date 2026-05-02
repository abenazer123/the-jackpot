/**
 * Realized ADR + LOS aggregator.
 *
 * STOPGAP — pulls live from PriceLabs at request time. See
 * docs/second-brain/architecture-decisions.md §3 row 1: the
 * proper version reads from a Supabase `reservations` table
 * populated by a daily cron, not from the API at render time.
 *
 * Today's surface is /admin Pricing math section. When the
 * cron lands, swap the data source here without changing the
 * call sites.
 *
 * Single-listing for now (the one in `pricing_config`,
 * currently Airbnb). Multi-channel blending is
 * data-watchlist.md §2 row 3.
 */

import { fetchReservations } from "@/lib/pricelabs";
import { supabaseServer } from "@/lib/supabase-server";

const DEFAULT_WINDOW_DAYS = 180;

export interface RealizedAdr {
  adrCents: number;
  avgLosNights: number;
  bookingsCount: number;
  nights: number;
  revenueCents: number;
  windowStart: string; // YYYY-MM-DD
  windowEnd: string; // YYYY-MM-DD
  listingId: string;
  pms: string;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Pulls realized ADR + LOS over the trailing window.
 * Returns null if config is missing or there are no booked
 * reservations — caller should render a "live data
 * unavailable" state.
 */
export async function getRealizedAdr(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<RealizedAdr | null> {
  const sb = supabaseServer();

  const { data: cfg, error } = await sb
    .from("pricing_config")
    .select("key, value_text")
    .in("key", ["pricelabs_listing_id", "pricelabs_pms"]);

  if (error) {
    console.error("[realized] pricing_config read failed", error);
    return null;
  }
  const map = new Map<string, string | null>();
  for (const row of cfg ?? []) map.set(row.key, row.value_text);
  const listingId = map.get("pricelabs_listing_id");
  const pms = map.get("pricelabs_pms");
  if (!listingId || !pms) return null;

  const windowStart = isoDaysAgo(windowDays);
  const windowEnd = isoToday();

  let reservations;
  try {
    reservations = await fetchReservations({
      pms,
      listing_id: listingId,
      start_date: windowStart,
      end_date: windowEnd,
    });
  } catch (e) {
    console.error("[realized] fetchReservations failed", e);
    return null;
  }

  const booked = reservations.filter((r) => r.booking_status === "booked");
  if (booked.length === 0) return null;

  let nights = 0;
  let revenueCents = 0;
  for (const r of booked) {
    const n = Number(r.no_of_days);
    if (!Number.isFinite(n) || n <= 0) continue;
    const rev = Number(r.rental_revenue);
    if (!Number.isFinite(rev)) continue;
    nights += n;
    revenueCents += Math.round(rev * 100);
  }

  if (nights === 0) return null;

  return {
    adrCents: Math.round(revenueCents / nights),
    avgLosNights: nights / booked.length,
    bookingsCount: booked.length,
    nights,
    revenueCents,
    windowStart,
    windowEnd,
    listingId,
    pms,
  };
}
