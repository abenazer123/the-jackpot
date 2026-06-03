"use server";

import { revalidatePath } from "next/cache";

import { refreshAllPrices as runRefreshAllPrices } from "./refresh";

/**
 * Server action: refresh listing_prices from PriceLabs for every
 * future-dated inquiry, recompute today's quote per inquiry, and write
 * it to the quote_refreshed_* columns. Triggered by the "Update prices"
 * form button on /admin/inquiries.
 *
 * Returns nothing — the form revalidates the page after success and
 * the new totals show up in the "New" column on next render.
 */
export async function refreshAllPrices(): Promise<void> {
  const result = await runRefreshAllPrices();
  console.log(
    "[admin/inquiries] refreshAllPrices result",
    result,
  );
  revalidatePath("/admin/inquiries");
}
