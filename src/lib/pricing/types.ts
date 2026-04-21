/**
 * Shape of a fully-computed quote. Serialized as `quote_snapshot` jsonb on
 * `inquiries` so any email reprint weeks later matches what the guest saw.
 *
 * All monetary fields are in cents (ints). Percent fields use basis points
 * (bps): 1737 = 17.37%. No floats in storage.
 */
export interface Quote {
  currency: "USD";

  // Stay shape
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  nights: number;
  guests: number;

  // Where the rates came from
  listingId: string;
  pms: string;

  // Per-night breakdown (same length as nights). Pre-discount, pre-tax.
  nightly: Array<{ date: string; rateCents: number }>;
  subtotalCents: number;

  /**
   * Constraints PriceLabs flagged on these dates. We compute the quote
   * even when they're violated (so Abe can see the number and decide),
   * but downstream UI / follow-up copy can reference these fields.
   */
  constraints: {
    /** Tightest per-night min_stay across the range. */
    minStayRequired: number;
    /** True if nights >= minStayRequired. */
    minStayMet: boolean;
    /** True if any night has check_in=false (e.g. "Saturday arrivals only"). */
    checkInRestricted: boolean;
    /** True if any night has check_out=false. */
    checkOutRestricted: boolean;
  };

  // Applied discounts (non-stackable — usually zero or one entry).
  discounts: Array<{
    kind: "los" | "occasion" | "code" | "date_window";
    label: string;
    amountCents: number; // positive; subtracted from subtotal
  }>;
  discountTotalCents: number;

  // Fees & tax
  cleaningCents: number;
  preTaxCents: number; // subtotal - discount + cleaning
  taxEnabled: boolean; // false until Abe is registered with Chicago DOF + IL DOR
  taxRateBps: number;
  taxCents: number;

  totalCents: number;
  perGuestCents: number;

  // Narrative (platform-fee savings)
  savedVsAirbnbCents: number;
  savedVsVrboCents: number;

  // Provenance
  pricesAsOf: string; // ISO timestamp — latest fetched_at across the stay
  stale: boolean; // true if pricesAsOf > 48h ago
  minNightlyFloorApplied: boolean; // true if any night was floored to min_nightly_cents
  pricelabsLastRefreshedAt?: string;
  computedAt: string; // ISO timestamp when computeQuote ran
}

export type QuoteErrorCode =
  | "out_of_window" // some stay date isn't in the listing_prices cache
  | "unavailable" // a night is actually booked on Airbnb (user_price=-1) or flagged unbookable
  | "sub_floor" // nights < pricing_config.min_stay_floor (hard absolute floor, usually 2)
  | "max_guests" // guests > pricing_config.max_guests
  | "cache_empty" // listing_prices has no rows yet (first deploy)
  | "config_missing"; // a required pricing_config key is absent

export interface QuoteError {
  code: QuoteErrorCode;
  message: string;
  /** For sub_floor: the required number of nights. */
  required?: number;
  /** For out_of_window / unavailable: the offending date. */
  offendingDate?: string;
}

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: QuoteError };
