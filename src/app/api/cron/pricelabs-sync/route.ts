/**
 * POST /api/cron/pricelabs-sync
 *
 * Daily job (Vercel Cron, 08:00 UTC ≈ 03:00 CT). Pulls 730 days of
 * PriceLabs dynamic suggested rates and upserts them into
 * `listing_prices`. Every downstream consumer (computeQuote) reads from
 * that cache — guests never touch PriceLabs directly.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when
 * CRON_SECRET is set in env. Unauthenticated calls get 401.
 *
 * On failure: logs + emails NOTIFY_EMAIL so Abe knows the cache is going
 * stale before guests see stale quotes.
 */

import { NextResponse, type NextRequest } from "next/server";

import { fetchListingPrices } from "@/lib/pricelabs";
import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "@/lib/resend";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
/** Long-ish max — PriceLabs recommends up to 300s timeout. */
export const maxDuration = 300;

const SYNC_DAYS = 730;

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization");
  return got === `Bearer ${secret}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readConfig(keys: readonly string[]): Promise<Map<string, { value_text: string | null; value_number: number | null }>> {
  const { data, error } = await supabaseServer()
    .from("pricing_config")
    .select("key,value_text,value_number")
    .in("key", keys as string[]);
  if (error) throw new Error(`pricing_config read failed: ${error.message}`);
  const map = new Map<string, { value_text: string | null; value_number: number | null }>();
  for (const row of data ?? []) {
    map.set(row.key as string, {
      value_text: (row.value_text as string | null) ?? null,
      value_number: (row.value_number as number | null) ?? null,
    });
  }
  return map;
}

async function alertAbe(error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.stack ?? error.message : String(error);
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: "⚠️ PriceLabs sync failed",
      text:
        "The nightly PriceLabs → Supabase sync failed. Pricing quotes may go stale.\n\n" +
        msg,
    });
  } catch (sendErr) {
    console.error("[cron] alert email failed", sendErr);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

// Vercel Cron defaults to GET; we accept either to be safe.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const cfg = await readConfig([
      "pricelabs_listing_id",
      "pricelabs_pms",
    ] as const);
    const listingId = cfg.get("pricelabs_listing_id")?.value_text;
    const pms = cfg.get("pricelabs_pms")?.value_text;
    if (!listingId || !pms) {
      throw new Error(
        "pricing_config missing pricelabs_listing_id or pricelabs_pms",
      );
    }

    const dateFrom = today();
    const dateTo = addDays(dateFrom, SYNC_DAYS - 1);
    const prices = await fetchListingPrices({
      id: listingId,
      pms,
      dateFrom,
      dateTo,
    });

    const rows = prices.data.map((d) => {
      const unbookable = d.unbookable === 1;
      // user_price === -1 is PriceLabs' signal for "booked on the PMS".
      const booked = d.user_price === -1;
      return {
        listing_id: listingId,
        stay_date: d.date,
        rate_cents: Math.round((d.price ?? 0) * 100),
        min_stay: d.min_stay ?? 2,
        unbookable,
        available: !unbookable && !booked,
        demand_desc: d.demand_desc ?? null,
        currency: prices.currency || "USD",
        fetched_at: new Date().toISOString(),
        raw_data: d,
      };
    });

    if (rows.length === 0) {
      throw new Error("PriceLabs returned zero price rows");
    }

    const { error: upsertErr } = await supabaseServer()
      .from("listing_prices")
      .upsert(rows, { onConflict: "listing_id,stay_date" });
    if (upsertErr) {
      throw new Error(`listing_prices upsert failed: ${upsertErr.message}`);
    }

    const rates = rows.map((r) => r.rate_cents).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)] ?? 0;
    const bookedCount = rows.filter((r) => !r.available).length;
    const summary = {
      listing_id: listingId,
      pms,
      days: rows.length,
      days_booked_or_blocked: bookedCount,
      min_cents: rates[0] ?? 0,
      max_cents: rates[rates.length - 1] ?? 0,
      median_cents: median,
      last_refreshed_at: prices.last_refreshed_at,
      elapsed_ms: Date.now() - startedAt,
    };
    console.log("[cron] pricelabs-sync ok", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron] pricelabs-sync failed", err);
    await alertAbe(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}
