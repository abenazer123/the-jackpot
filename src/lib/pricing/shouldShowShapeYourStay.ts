/**
 * shouldShowShapeYourStay — gate helper for the conditional Step 4 in
 * the booking funnel. Returns true when ANY of these conditions match:
 *
 *   1. nights >= 3 AND guests >= 6
 *   2. reason is one of: Wedding, Bachelor/ette, Birthday
 *   3. ANY night in [arrival, departure) has PriceLabs demand_desc
 *      in {'High Demand', 'Good Demand'}
 *   4. ANY night in [arrival, departure) falls inside an active
 *      `pricing_events` window (recurring-yearly aware)
 *
 * Otherwise returns false — the funnel skips Step 4 and goes straight
 * from Step 3 submit to the success-screen reveal.
 *
 * See docs/guest-experience-ux.md §3.3 for the rationale.
 */

import { supabaseServer } from "@/lib/supabase-server";

const TRIGGER_REASONS = new Set(["Wedding", "Bachelor/ette", "Birthday"]);
const TRIGGER_DEMAND = new Set(["High Demand", "Good Demand"]);

const PRICELABS_LISTING_ID_KEY = "pricelabs_listing_id";

export interface ShapeStepInput {
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  guests: number;
  reason?: string;
}

function eachDate(fromIso: string, toIsoExclusive: string): string[] {
  const out: string[] = [];
  const start = new Date(fromIso + "T00:00:00Z");
  const end = new Date(toIsoExclusive + "T00:00:00Z");
  for (
    let d = new Date(start);
    d.getTime() < end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** "MM-DD" extractor for recurring-yearly comparison. */
function md(iso: string): string {
  return iso.slice(5, 10);
}

export async function shouldShowShapeYourStay(
  input: ShapeStepInput,
): Promise<boolean> {
  const dates = eachDate(input.arrival, input.departure);
  const nights = dates.length;

  // Gate 1 — group size + length
  if (nights >= 3 && input.guests >= 6) return true;

  // Gate 2 — reason match
  if (input.reason && TRIGGER_REASONS.has(input.reason)) return true;

  // Gate 3 — demand on any night (PriceLabs cache)
  // Gate 4 — event window on any night (pricing_events table)
  // Run both DB lookups in parallel; bail as soon as either matches.
  const sb = supabaseServer();

  const listingIdRow = await sb
    .from("pricing_config")
    .select("value_text")
    .eq("key", PRICELABS_LISTING_ID_KEY)
    .maybeSingle();
  const listingId =
    (listingIdRow.data?.value_text as string | undefined) ?? null;

  const [demandRows, eventRows] = await Promise.all([
    listingId
      ? sb
          .from("listing_prices")
          .select("stay_date,raw_data")
          .eq("listing_id", listingId)
          .in("stay_date", dates)
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("pricing_events")
      .select("start_date,end_date,recurring_yearly")
      .eq("active", true),
  ]);

  // Gate 3 — demand on any night
  const matchedDemand = (demandRows.data ?? []).some((r) => {
    const raw = (r as { raw_data?: Record<string, unknown> | null }).raw_data;
    const desc =
      raw && typeof raw.demand_desc === "string" ? raw.demand_desc : "";
    return TRIGGER_DEMAND.has(desc);
  });
  if (matchedDemand) return true;

  // Gate 4
  const events = (eventRows.data ?? []) as Array<{
    start_date: string;
    end_date: string;
    recurring_yearly: boolean;
  }>;
  const matchedEvent = dates.some((d) =>
    events.some((e) => {
      if (e.recurring_yearly) {
        // Compare MM-DD against the event window's MM-DD range.
        const dMd = md(d);
        const startMd = md(e.start_date);
        const endMd = md(e.end_date);
        if (startMd <= endMd) {
          return dMd >= startMd && dMd <= endMd;
        }
        // Wraps year boundary (e.g., NYE Dec 29 → Jan 2)
        return dMd >= startMd || dMd <= endMd;
      }
      // Non-recurring: literal date range check
      return d >= e.start_date && d <= e.end_date;
    }),
  );
  if (matchedEvent) return true;

  return false;
}
