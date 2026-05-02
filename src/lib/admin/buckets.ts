/**
 * Bucket-code glossary — single source of truth for what
 * A1/A2/B1/etc. mean. Used by the legend `<details>` blocks on
 * /admin and /admin/categories so the codes are always
 * explained in-context.
 *
 * Mirrors the seed comment in the migration
 * `20260501031607_expense_tracking.sql` and the taxonomy in
 * `docs/second-brain/cost-structure.md` §1.
 */

export interface BucketDef {
  code: string;
  name: string;
  description: string;
}

export const BUCKETS: readonly BucketDef[] = [
  {
    code: "A1",
    name: "Monthly recurring fixed",
    description:
      "Bills that arrive every month regardless of bookings — mortgage, utilities, internet, software subscriptions.",
  },
  {
    code: "A2",
    name: "Annual recurring fixed",
    description:
      "Once-a-year obligations — domain renewal, LLC report, STR license, insurance premium. Amortize ÷ 12 for monthly view.",
  },
  {
    code: "B1",
    name: "Per-booking turn",
    description:
      "Costs incurred for each guest stay — cleaning, laundry, welcome supplies. Scale with booking count.",
  },
  {
    code: "B2",
    name: "Channel fees",
    description:
      "Platform commissions taken by Airbnb / VRBO / Booking.com from each booking. Derived from reservation_data, not entered manually.",
  },
  {
    code: "B3",
    name: "Payment processing",
    description:
      "Stripe / processor fees on direct bookings. Zero today (Phase 8 surface).",
  },
  {
    code: "C1",
    name: "Repairs (irregular)",
    description:
      "One-off fixes — plumbing, HVAC, hot tub repair, snow removal. Per-incident, no monthly baseline.",
  },
  {
    code: "C2",
    name: "Capex / replacements",
    description:
      "Long-lived purchases tracked separately in /admin/capex with monthly amortization. Not a typical entry bucket.",
  },
  {
    code: "C3",
    name: "Compliance / professional",
    description:
      "City violations, legal review, accounting fees. Per-incident; hopefully zero.",
  },
  {
    code: "C4",
    name: "Marketing / promo",
    description:
      "Paid Airbnb promotion, Google Ads, photography refresh. Currently zero; placeholder for Phase 8 direct-booking work.",
  },
  {
    code: "D1",
    name: "Maintenance reserve",
    description:
      "Modeled, not actual cash — set-aside per booking for future repairs. Not in entries today.",
  },
  {
    code: "D2",
    name: "Capex amortization",
    description:
      "Modeled monthly carry of all capex items. Auto-derived from `capex_items.monthly_amortization_cents`.",
  },
] as const;

/** Lookup by code; returns undefined if unknown. */
export function bucketDef(code: string): BucketDef | undefined {
  return BUCKETS.find((b) => b.code === code);
}
