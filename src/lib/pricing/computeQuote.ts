/**
 * computeQuote — turns an inquiry (dates + guests) into a fully itemized
 * Quote. Reads three tables:
 *
 *   listing_prices   — nightly rates cached from PriceLabs (populated by
 *                      /api/cron/pricelabs-sync)
 *   pricing_config   — cleaning fee, tax rate, floors, listing id, flags
 *   discounts        — optional rules. Non-stackable; best-wins, unless a
 *                      promo code is supplied (code overrides automatic).
 *
 * No network calls. Safe to invoke from any server route.
 */

import { supabaseServer } from "@/lib/supabase-server";

import type {
  Quote,
  QuoteError,
  QuoteErrorCode,
  QuoteResult,
} from "./types";

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48h

const CONFIG_KEYS = [
  "pricelabs_listing_id",
  "pricelabs_pms",
  "cleaning_fee_cents",
  "tax_rate_bps",
  "tax_enabled",
  "min_stay_floor",
  "max_guests",
  "min_nightly_cents",
  "airbnb_fee_bps",
  "vrbo_fee_bps",
] as const;

type ConfigKey = (typeof CONFIG_KEYS)[number];

interface ConfigRow {
  key: string;
  value_text: string | null;
  value_number: number | null;
}

interface ListingPriceRow {
  listing_id: string;
  stay_date: string;
  rate_cents: number;
  min_stay: number;
  unbookable: boolean;
  fetched_at: string;
}

interface DiscountRow {
  id: string;
  kind: "los" | "occasion" | "code" | "date_window";
  label: string;
  min_nights: number | null;
  occasion: string | null;
  code: string | null;
  stay_start: string | null;
  stay_end: string | null;
  valid_from: string | null;
  valid_to: string | null;
  percent_off_bps: number | null;
  amount_off_cents: number | null;
  active: boolean;
}

export interface ComputeQuoteInput {
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD (exclusive — checkout day)
  guests: number;
  occasion?: string;
  code?: string;
}

function err(code: QuoteErrorCode, message: string, extra?: Partial<QuoteError>): QuoteResult {
  return { ok: false, error: { code, message, ...extra } };
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

function cfgText(cfg: Map<ConfigKey, ConfigRow>, key: ConfigKey): string | null {
  return cfg.get(key)?.value_text ?? null;
}
function cfgNum(cfg: Map<ConfigKey, ConfigRow>, key: ConfigKey): number | null {
  const v = cfg.get(key)?.value_number;
  return typeof v === "number" ? v : null;
}
function cfgBool(cfg: Map<ConfigKey, ConfigRow>, key: ConfigKey): boolean {
  const t = cfgText(cfg, key);
  return t === "true" || t === "1";
}

export async function computeQuote(
  input: ComputeQuoteInput,
): Promise<QuoteResult> {
  const sb = supabaseServer();

  // --- 1. Config ---------------------------------------------------------
  const cfgRes = await sb
    .from("pricing_config")
    .select("key,value_text,value_number")
    .in("key", CONFIG_KEYS as unknown as string[]);
  if (cfgRes.error) {
    return err("config_missing", `pricing_config read failed: ${cfgRes.error.message}`);
  }
  const cfg = new Map<ConfigKey, ConfigRow>();
  for (const row of (cfgRes.data ?? []) as ConfigRow[]) {
    if (CONFIG_KEYS.includes(row.key as ConfigKey)) {
      cfg.set(row.key as ConfigKey, row);
    }
  }

  const listingId = cfgText(cfg, "pricelabs_listing_id");
  const pms = cfgText(cfg, "pricelabs_pms");
  const cleaningCents = cfgNum(cfg, "cleaning_fee_cents");
  const taxRateBps = cfgNum(cfg, "tax_rate_bps");
  const taxEnabled = cfgBool(cfg, "tax_enabled");
  const minStayFloor = cfgNum(cfg, "min_stay_floor") ?? 1;
  const maxGuests = cfgNum(cfg, "max_guests") ?? 14;
  const minNightlyCents = cfgNum(cfg, "min_nightly_cents") ?? 0;
  const airbnbFeeBps = cfgNum(cfg, "airbnb_fee_bps") ?? 0;
  const vrboFeeBps = cfgNum(cfg, "vrbo_fee_bps") ?? 0;

  if (!listingId || !pms) return err("config_missing", "pricelabs_listing_id/pms not set");
  if (cleaningCents == null) return err("config_missing", "cleaning_fee_cents not set");
  if (taxRateBps == null) return err("config_missing", "tax_rate_bps not set");

  // --- 2. Input sanity ---------------------------------------------------
  if (input.guests > maxGuests) {
    return err("max_guests", `guests exceed max of ${maxGuests}`);
  }

  const dates = eachDate(input.arrival, input.departure);
  const nights = dates.length;
  if (nights < 1) return err("min_stay", "departure must be after arrival", { required: 1 });
  if (nights < minStayFloor) {
    return err("sub_floor", `minimum stay is ${minStayFloor} nights`, { required: minStayFloor });
  }

  // --- 3. Nightly rates from cache --------------------------------------
  const pricesRes = await sb
    .from("listing_prices")
    .select("listing_id,stay_date,rate_cents,min_stay,unbookable,fetched_at")
    .eq("listing_id", listingId)
    .in("stay_date", dates);
  if (pricesRes.error) {
    return err("cache_empty", `listing_prices read failed: ${pricesRes.error.message}`);
  }
  const rows = (pricesRes.data ?? []) as ListingPriceRow[];
  if (rows.length === 0) {
    return err("cache_empty", "no cached prices yet — run /api/cron/pricelabs-sync first");
  }

  const byDate = new Map<string, ListingPriceRow>();
  for (const r of rows) byDate.set(r.stay_date, r);

  let minNightlyFloorApplied = false;
  const nightly: Array<{ date: string; rateCents: number }> = [];
  let maxMinStay = 0;
  let latestFetchedAt = "";
  for (const date of dates) {
    const row = byDate.get(date);
    if (!row) {
      return err("out_of_window", `no cached rate for ${date}`, { offendingDate: date });
    }
    if (row.unbookable) {
      return err("unbookable", `${date} is flagged unbookable in PriceLabs`, {
        offendingDate: date,
      });
    }
    const rate = Math.max(row.rate_cents, minNightlyCents);
    if (rate > row.rate_cents) minNightlyFloorApplied = true;
    nightly.push({ date, rateCents: rate });
    if (row.min_stay > maxMinStay) maxMinStay = row.min_stay;
    if (row.fetched_at > latestFetchedAt) latestFetchedAt = row.fetched_at;
  }

  if (nights < maxMinStay) {
    return err("min_stay", `minimum stay for these dates is ${maxMinStay} nights`, {
      required: maxMinStay,
    });
  }

  const subtotalCents = nightly.reduce((s, n) => s + n.rateCents, 0);

  // --- 4. Discounts ------------------------------------------------------
  const discountsRes = await sb
    .from("discounts")
    .select("*")
    .eq("active", true);
  if (discountsRes.error) {
    // Discounts are optional — log and proceed without them.
    console.warn("[computeQuote] discounts read failed, proceeding without", discountsRes.error);
  }
  const discountRows = ((discountsRes.data ?? []) as DiscountRow[]).filter(applicable);

  function applicable(d: DiscountRow): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (d.valid_from && today < d.valid_from) return false;
    if (d.valid_to && today > d.valid_to) return false;
    if (d.stay_start && input.arrival < d.stay_start) return false;
    if (d.stay_end && input.departure > d.stay_end) return false;
    switch (d.kind) {
      case "los":
        return d.min_nights != null && nights >= d.min_nights;
      case "occasion":
        return !!input.occasion && d.occasion === input.occasion;
      case "code":
        return (
          !!input.code && !!d.code && d.code.toLowerCase() === input.code.toLowerCase()
        );
      case "date_window":
        return true; // date-window match already checked via stay_start/stay_end
      default:
        return false;
    }
  }

  function amount(d: DiscountRow): number {
    if (d.amount_off_cents != null) return d.amount_off_cents;
    if (d.percent_off_bps != null) {
      return Math.round((subtotalCents * d.percent_off_bps) / 10_000);
    }
    return 0;
  }

  const applied: Quote["discounts"] = [];
  // If a promo code matches, it wins outright (guest intent > system choice).
  const codeMatch = discountRows.find((d) => d.kind === "code");
  if (codeMatch) {
    applied.push({
      kind: "code",
      label: codeMatch.label,
      amountCents: amount(codeMatch),
    });
  } else {
    // Non-stackable: pick the single largest automatic discount.
    let best: DiscountRow | null = null;
    let bestAmt = 0;
    for (const d of discountRows) {
      const amt = amount(d);
      if (amt > bestAmt) {
        best = d;
        bestAmt = amt;
      }
    }
    if (best && bestAmt > 0) {
      applied.push({ kind: best.kind, label: best.label, amountCents: bestAmt });
    }
  }
  const discountTotalCents = Math.min(
    subtotalCents,
    applied.reduce((s, d) => s + d.amountCents, 0),
  );

  // --- 5. Totals ---------------------------------------------------------
  const preTaxCents = Math.max(0, subtotalCents - discountTotalCents) + cleaningCents;
  const taxCents = taxEnabled ? Math.round((preTaxCents * taxRateBps) / 10_000) : 0;
  const totalCents = preTaxCents + taxCents;
  const perGuestCents = Math.round(totalCents / Math.max(1, input.guests));

  const savedVsAirbnbCents = Math.round((totalCents * airbnbFeeBps) / 10_000);
  const savedVsVrboCents = Math.round((totalCents * vrboFeeBps) / 10_000);

  const pricesAsOfMs = latestFetchedAt ? new Date(latestFetchedAt).getTime() : 0;
  const stale = pricesAsOfMs > 0 && Date.now() - pricesAsOfMs > STALE_THRESHOLD_MS;

  const quote: Quote = {
    currency: "USD",
    arrival: input.arrival,
    departure: input.departure,
    nights,
    guests: input.guests,
    listingId,
    pms,
    nightly,
    subtotalCents,
    discounts: applied,
    discountTotalCents,
    cleaningCents,
    preTaxCents,
    taxEnabled,
    taxRateBps,
    taxCents,
    totalCents,
    perGuestCents,
    savedVsAirbnbCents,
    savedVsVrboCents,
    pricesAsOf: latestFetchedAt,
    stale,
    minNightlyFloorApplied,
    computedAt: new Date().toISOString(),
  };
  return { ok: true, quote };
}
