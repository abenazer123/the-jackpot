/**
 * PriceLabs Customer API client.
 *
 * Base URL: https://api.pricelabs.co
 * Auth:     X-API-Key header (copy from Account Settings → API Details in PriceLabs)
 * Docs:     https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3
 *
 * Rate limits: 60 req/min, capped at 1000 req/hour. Our daily sync is one
 * call, so this is a non-issue. Timeout guidance from PriceLabs is 300s.
 *
 * The Jackpot uses the Airbnb listing as the source of truth for dynamic
 * pricing — id + pms are stored in `pricing_config` so Abe can swap them
 * (VRBO or bcom) without a code change.
 */

const BASE_URL = "https://api.pricelabs.co";
const DEFAULT_TIMEOUT_MS = 120_000; // 2 min. PriceLabs suggests up to 300s.

function apiKey(): string {
  const k = process.env.PRICELABS_API_KEY;
  if (!k) throw new Error("PRICELABS_API_KEY missing from env");
  return k;
}

async function plFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "X-API-Key": apiKey(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

// ---------- /v1/listings ------------------------------------------------

export interface PriceLabsListing {
  id: string;
  pms: string;
  name?: string;
  city_name?: string;
  state?: string;
  country?: string;
  no_of_bedrooms?: number | null;
  push_enabled?: boolean;
  [key: string]: unknown;
}

export async function fetchListings(opts?: {
  onlySyncing?: boolean;
  skipHidden?: boolean;
}): Promise<PriceLabsListing[]> {
  const qs = new URLSearchParams();
  if (opts?.onlySyncing) qs.set("only_syncing_listings", "true");
  if (opts?.skipHidden) qs.set("skip_hidden", "true");
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await plFetch(`/v1/listings${suffix}`);
  if (!res.ok) {
    throw new Error(
      `PriceLabs /v1/listings failed: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as { listings?: PriceLabsListing[] };
  return body.listings ?? [];
}

// ---------- /v1/listing_prices -----------------------------------------

/**
 * Per-date row as returned by PriceLabs. `price` is the dynamic
 * recommended nightly rate (demand- and seasonality-aware). `user_price`
 * of -1 historically signalled unavailable, though PriceLabs now also
 * exposes the explicit `unbookable` flag (0/1).
 */
export interface PriceLabsDayPrice {
  date: string; // YYYY-MM-DD
  price: number; // PriceLabs recommended dynamic rate
  user_price?: number;
  uncustomized_price?: number;
  min_stay?: number;
  unbookable?: 0 | 1;
  demand_color?: string;
  demand_desc?: string;
  weekly_discount?: number;
  monthly_discount?: number;
  extra_person_fee?: number;
  extra_person_fee_trigger?: number;
  check_in?: boolean;
  check_out?: boolean;
}

export interface PriceLabsListingPrices {
  id: string;
  pms: string;
  group?: string;
  currency: string;
  last_refreshed_at: string;
  /** LOS tier adjustments as configured in PriceLabs. null if no tiers. */
  los_pricing?:
    | Record<
        string,
        {
          los_night: string;
          max_price?: string;
          min_price?: string;
          los_adjustment: string; // "-10" = 10% off, "10" = 10% premium
        }
      >
    | null;
  data: PriceLabsDayPrice[];
  error?: string;
}

/**
 * POST /v1/listing_prices — fetch dynamic prices for one listing over a
 * date range. PriceLabs accepts multiple listings per call, but we sync
 * one listing per cron run, so we keep this signature single-listing for
 * clarity. Expand to take an array if we onboard a second property.
 */
export async function fetchListingPrices(params: {
  id: string;
  pms: string;
  dateFrom: string; // YYYY-MM-DD — must be today or later
  dateTo: string; // YYYY-MM-DD
}): Promise<PriceLabsListingPrices> {
  const res = await plFetch("/v1/listing_prices", {
    method: "POST",
    body: JSON.stringify({ listings: [params] }),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      `PriceLabs /v1/listing_prices failed: ${res.status} ${res.statusText} ${bodyText.slice(0, 400)}`,
    );
  }
  const body = (await res.json()) as PriceLabsListingPrices[];
  const first = body[0];
  if (!first) {
    throw new Error("PriceLabs /v1/listing_prices returned empty array");
  }
  if (first.error) {
    // LISTING_NOT_PRESENT / LISTING_NO_DATA / LISTING_TOGGLE_OFF
    throw new Error(`PriceLabs error for listing ${params.id}: ${first.error}`);
  }
  return first;
}
