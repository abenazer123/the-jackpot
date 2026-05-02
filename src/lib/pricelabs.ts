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

// ---------- /v1/reservation_data --------------------------------------

/**
 * One reservation as returned by /v1/reservation_data. Money fields are
 * delivered as strings (dollars). The PMS-specific quirks are documented
 * in `docs/pricelabs-api.md` §256:
 *   - `rental_revenue` is post-platform-fee revenue (Airbnb + VRBO ✅;
 *     Booking.com sometimes empty).
 *   - `total_cost` is what the guest paid (includes cleaning).
 *   - `guestName` is privacy-redacted ("Hidden").
 */
export interface PriceLabsReservation {
  listing_id: string;
  listing_name?: string;
  reservation_id: string;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  booking_status: "booked" | "cancelled";
  booked_date: string; // ISO datetime
  cancelled_on: string | null;
  rental_revenue: string; // dollars, as string
  total_cost: string;
  no_of_days: number; // = nights
  cleaning_fees?: number;
  currency: string;
  channelConfirmationCode: string | null;
  guestName?: string;
  [key: string]: unknown;
}

/**
 * GET /v1/reservation_data — auto-paginates until next_page=false. Each
 * page returns up to 100 reservations.
 *
 * Required: pms. Optional: listing_id (filter), start_date, end_date
 * (YYYY-MM-DD; check-in date filter — NOT `dateFrom`/`dateTo` like
 * /v1/listing_prices uses).
 *
 * Designed to be called from both render-time code (today's stopgap) and
 * a daily ingestion cron (Phase 6.1; see
 * docs/second-brain/architecture-decisions.md §1).
 */
export async function fetchReservations(params: {
  pms: string;
  listing_id?: string;
  start_date?: string;
  end_date?: string;
  pageSize?: number;
}): Promise<PriceLabsReservation[]> {
  const limit = params.pageSize ?? 100;
  const out: PriceLabsReservation[] = [];
  let offset = 0;

  // Cap iterations defensively; 500 pages × 100 = 50k reservations is
  // far beyond plausible. Stops a runaway loop if next_page never flips.
  for (let i = 0; i < 500; i++) {
    const qs = new URLSearchParams({
      pms: params.pms,
      limit: String(limit),
      offset: String(offset),
    });
    if (params.listing_id) qs.set("listing_id", params.listing_id);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);

    const res = await plFetch(`/v1/reservation_data?${qs}`);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(
        `PriceLabs /v1/reservation_data failed: ${res.status} ${res.statusText} ${bodyText.slice(0, 400)}`,
      );
    }
    const body = (await res.json()) as {
      pms_name?: string;
      next_page?: boolean;
      data?: PriceLabsReservation[];
    };
    const page = body.data ?? [];
    out.push(...page);

    if (!body.next_page || page.length === 0) break;
    offset += limit;
  }

  return out;
}
