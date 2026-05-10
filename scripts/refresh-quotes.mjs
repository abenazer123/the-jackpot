/**
 * One-off script — backfills share_tokens + refreshed quotes for
 * actionable leads identified in docs/inquiries-actionable-2026-05-10.md.
 *
 * Per-lead plan:
 *   - Naina Vyas       — mint token + refresh quote (today < original)
 *   - Allison Mengel   — mint token + write today's quote as original
 *                        (she had no quote captured at submit time)
 *   - Vanessa Poirier  — mint token only (today > original; don't
 *                        refresh — never penalize for waiting)
 *   - McKenzie Kedzior — refresh quote only (token exists; today < original)
 *
 * Reads:
 *   - .env.local for SUPABASE_URL + SERVICE_ROLE_KEY
 *   - PriceLabs `/v1/listing_prices` (live pull) for current rates
 *   - Supabase `pricing_config` for cleaning fee + Airbnb/VRBO fee bps
 *
 * Writes (PATCH on inquiries.id):
 *   - share_token (when mintToken=true)
 *   - quote_snapshot + quote_total_cents (when setOriginal=true)
 *   - quote_refreshed_snapshot + quote_refreshed_total_cents +
 *     quote_refreshed_at (when refreshQuote=true)
 *
 * Idempotent: re-running mints fresh tokens / re-refreshes quotes;
 *   doesn't undo or duplicate prior writes if you only run it once.
 */

import fs from "node:fs";
import crypto from "node:crypto";

// ─── env ─────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PL_KEY = env.PRICELABS_API_KEY;
if (!SUPA_URL || !SUPA_KEY || !PL_KEY) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

// ─── token gen (matches src/lib/share/generateShareToken.ts) ─────
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
function genToken() {
  const bytes = crypto.randomBytes(22);
  return Array.from(bytes, (b) => ALPHABET[b & 63]).join("");
}

// ─── Supabase REST helpers ───────────────────────────────────────
const sbHeaders = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
};

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPatch(path, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path}: ${r.status} ${await r.text()}`);
  return r.status;
}

// ─── PriceLabs ───────────────────────────────────────────────────
async function fetchPrices(dateFrom, dateTo, listingId, pms) {
  const r = await fetch("https://api.pricelabs.co/v1/listing_prices", {
    method: "POST",
    headers: { "X-API-Key": PL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      listings: [{ id: listingId, pms, dateFrom, dateTo }],
    }),
  });
  if (!r.ok) throw new Error(`PriceLabs: ${r.status} ${await r.text()}`);
  const body = await r.json();
  return body[0].data;
}

// ─── Quote computation (mirrors src/lib/pricing/computeQuote.ts) ─
function computeQuote({
  arrival,
  departure,
  guests,
  priceByDate,
  cfg,
  listingId,
  pms,
}) {
  const start = new Date(arrival + "T00:00:00Z");
  const end = new Date(departure + "T00:00:00Z");
  const nights = Math.round((end - start) / 86_400_000);
  const dateList = Array.from({ length: nights }, (_, i) => {
    return new Date(start.getTime() + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
  });
  const nightly = dateList.map((d) => {
    const r = priceByDate[d];
    if (!r) throw new Error(`Missing price for ${d}`);
    return { date: d, rateCents: Math.round(r.user_price * 100) };
  });
  const subtotalCents = nightly.reduce((s, n) => s + n.rateCents, 0);
  const discountTotalCents = 0;
  const cleaningCents = Number(cfg.cleaning_fee_cents ?? 47500);
  const preTaxCents = subtotalCents - discountTotalCents + cleaningCents;
  const taxEnabled = String(cfg.tax_enabled ?? "false").toLowerCase() === "true";
  const taxRateBps = Number(cfg.tax_rate_bps ?? 1737);
  const taxCents = taxEnabled
    ? Math.round((preTaxCents * taxRateBps) / 10_000)
    : 0;
  const totalCents = preTaxCents + taxCents;
  const perGuestCents = Math.round(totalCents / guests);
  const airbnbFeeBps = Number(cfg.airbnb_fee_bps ?? 1550);
  const vrboFeeBps = Number(cfg.vrbo_fee_bps ?? 500);
  const savedVsAirbnbCents = Math.round((totalCents * airbnbFeeBps) / 10_000);
  const savedVsVrboCents = Math.round((totalCents * vrboFeeBps) / 10_000);
  const minStayRequired = Math.max(
    ...dateList.map((d) => priceByDate[d].min_stay || 1),
  );

  const now = new Date().toISOString();

  return {
    currency: "USD",
    arrival,
    departure,
    nights,
    guests,
    listingId,
    pms,
    nightly,
    subtotalCents,
    constraints: {
      minStayRequired,
      minStayMet: nights >= minStayRequired,
      checkInRestricted: false,
      checkOutRestricted: false,
    },
    discounts: [],
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
    pricesAsOf: now,
    stale: false,
    minNightlyFloorApplied: false,
    computedAt: now,
  };
}

// ─── plan ────────────────────────────────────────────────────────
const plan = [
  {
    label: "Naina Vyas",
    email: "naina24vyas@gmail.com",
    mintToken: true,
    refreshQuote: true,
    setOriginal: false,
  },
  {
    label: "Allison Mengel",
    email: "allisonmengel99@gmail.com",
    mintToken: true,
    refreshQuote: false,
    setOriginal: true,
  },
  {
    label: "Vanessa Poirier",
    email: "vmpoirier14@gmail.com",
    mintToken: true,
    refreshQuote: false,
    setOriginal: false,
  },
  {
    label: "McKenzie Kedzior",
    email: "kenziekedzior@yahoo.com",
    mintToken: false,
    refreshQuote: true,
    setOriginal: false,
  },
];

// ─── main ────────────────────────────────────────────────────────
const LISTING_ID = "1517776645045787467";
const PMS = "airbnb";

console.log("Loading config + Airbnb price calendar (Jul 1 – Sep 30)…");
const cfgRows = await sbGet("pricing_config?select=key,value_number,value_text");
const cfg = {};
for (const r of cfgRows) {
  if (r.value_number != null) cfg[r.key] = r.value_number;
  else if (r.value_text != null) cfg[r.key] = r.value_text;
}
const prices = await fetchPrices("2026-07-01", "2026-09-30", LISTING_ID, PMS);
const priceByDate = Object.fromEntries(prices.map((r) => [r.date, r]));
console.log(
  `  cleaning_fee_cents = ${cfg.cleaning_fee_cents} | airbnb_fee_bps = ${cfg.airbnb_fee_bps} | vrbo_fee_bps = ${cfg.vrbo_fee_bps}`,
);
console.log(`  ${prices.length} priced dates loaded.`);

for (const item of plan) {
  console.log(`\n── ${item.label} (${item.email}) ──`);
  // Find the canonical inquiry row (status=submitted, latest match)
  const rows = await sbGet(
    `inquiries?email=eq.${encodeURIComponent(item.email)}&status=eq.submitted&select=id,name,arrival,departure,guests,reason,quote_total_cents,share_token&order=created_at.desc`,
  );
  if (rows.length === 0) {
    console.log("  ✗ no submitted inquiry found");
    continue;
  }
  // Pick the row with most fields filled
  const row = rows.reduce((best, r) => {
    const score = (x) =>
      ["name", "phone", "guests", "reason", "quote_total_cents"].filter(
        (f) => x[f] != null,
      ).length;
    return score(r) > score(best) ? r : best;
  });
  console.log(
    `  inquiry ${row.id}: ${row.arrival}→${row.departure}, ${row.guests}g, original=$${row.quote_total_cents ? (row.quote_total_cents / 100).toFixed(0) : "(none)"}`,
  );

  const patch = {};

  if (item.mintToken && !row.share_token) {
    patch.share_token = genToken();
    console.log(`  + share_token: ${patch.share_token}`);
  } else if (item.mintToken && row.share_token) {
    console.log(`  · share_token already set (${row.share_token}) — keeping`);
  }

  let quote = null;
  if (item.refreshQuote || item.setOriginal) {
    quote = computeQuote({
      arrival: row.arrival,
      departure: row.departure,
      guests: row.guests,
      priceByDate,
      cfg,
      listingId: LISTING_ID,
      pms: PMS,
    });
    console.log(
      `  computed today: $${(quote.totalCents / 100).toFixed(0)} (${quote.nightly.map((n) => "$" + (n.rateCents / 100).toFixed(0)).join(" + ")} + cleaning)`,
    );
  }

  if (item.refreshQuote && quote) {
    if (
      row.quote_total_cents != null &&
      quote.totalCents >= row.quote_total_cents
    ) {
      console.log(
        `  · today (${quote.totalCents}) >= original (${row.quote_total_cents}) — skipping refresh per "no upward refresh" rule`,
      );
    } else {
      patch.quote_refreshed_snapshot = quote;
      patch.quote_refreshed_total_cents = quote.totalCents;
      patch.quote_refreshed_at = quote.computedAt;
      console.log(
        `  + quote_refreshed_total_cents: ${quote.totalCents} (saves $${((row.quote_total_cents - quote.totalCents) / 100).toFixed(0)})`,
      );
    }
  }

  if (item.setOriginal && quote) {
    patch.quote_snapshot = quote;
    patch.quote_total_cents = quote.totalCents;
    console.log(`  + quote_snapshot (as original): ${quote.totalCents}`);
  }

  if (Object.keys(patch).length === 0) {
    console.log("  · no changes needed");
    continue;
  }

  const status = await sbPatch(`inquiries?id=eq.${row.id}`, patch);
  console.log(`  ✓ PATCH HTTP ${status}`);
}

console.log("\nDone.");
