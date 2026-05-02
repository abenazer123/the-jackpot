/**
 * /admin — overview.
 *
 * Layout (top to bottom):
 *   1. KPI cards (Baseline implied, Avg 3mo, Avg 12mo, This month).
 *   2. Cost structure breakdown — Fixed (per month) and Variable
 *      (per booking) line-itemed from active categories.
 *   3. Drift signals — diagnostic KPIs from Phase A of the
 *      Second Brain KPI map.
 *   4. Pricing math (live) — CVP KPIs (ADR, LOS, variable
 *      per night, CM, CM ratio, break-even). ADR + LOS pulled
 *      live from PriceLabs reservation_data. Stopgap; see
 *      docs/second-brain/architecture-decisions.md §3 for the
 *      proper version (cron + reservations table).
 *   5. Recent entries.
 *   6. Methodology — formula + explanation for every KPI on
 *      the page, plus a bucket-code legend.
 */

import Link from "next/link";

import { BUCKETS } from "@/lib/admin/buckets";
import { KPI_META } from "@/lib/admin/kpis";
import { getRealizedAdr } from "@/lib/pricing/realized";
import { supabaseServer } from "@/lib/supabase-server";

import { KPICard } from "./_components/KPICard";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

interface CategoryRow {
  category_id: string;
  display_name: string;
  bucket: string;
  frequency: string | null;
  baseline_amount_cents: number | null;
  active: boolean;
}

interface EntryRow {
  category_id: string | null;
  period_month: string | null;
  entry_date: string;
  amount_cents: number;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function startOfMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfYear(date = new Date()): string {
  return `${date.getFullYear()}-01-01`;
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Fractional months elapsed since Jan 1 of the current year.
 * E.g. May 1 → 4.0, May 15 → ~4.45. Used for YTD pacing so a
 * mid-month read doesn't pretend we've spent a full extra month.
 */
function monthsElapsedThisYear(): number {
  const today = new Date();
  const monthsCompleted = today.getMonth(); // 0-indexed; Jan=0, Dec=11
  const daysInThisMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const fractionOfMonth = (today.getDate() - 1) / daysInThisMonth;
  return monthsCompleted + fractionOfMonth;
}

function variancePill(actual: number, baseline: number, suffix?: string) {
  if (baseline === 0) return null;
  const pct = ((actual - baseline) / baseline) * 100;
  const sign = pct > 0 ? "+" : "";
  let cls = styles.variancePillAt;
  if (pct < -2) cls = styles.variancePillUnder;
  else if (pct > 2) cls = styles.variancePillOver;
  return (
    <span className={`${styles.variancePill} ${cls}`}>
      {sign}
      {pct.toFixed(0)}%
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/**
 * Per-category trailing average over the last `monthsBack`
 * calendar months. Only considers `period_month` ≥ cutoff.
 * For monthly categories the average is over distinct months
 * with entries (so a missing month doesn't drag the avg toward
 * zero). For per_booking categories, simple per-entry avg.
 */
function perCategoryTrailingAvg(
  entries: EntryRow[],
  categories: CategoryRow[],
  monthsBack: number,
): Map<string, number> {
  const byCat = new Map<string, CategoryRow>();
  for (const c of categories) byCat.set(c.category_id, c);
  const cutoffMonth = isoMonthsAgo(monthsBack - 1);

  const monthSums = new Map<string, Map<string, number>>(); // cat → month → sum
  const bookingSums = new Map<
    string,
    { sum: number; count: number }
  >();

  for (const e of entries) {
    if (!e.category_id) continue;
    const cat = byCat.get(e.category_id);
    if (!cat) continue;

    if (cat.frequency === "monthly") {
      if (!e.period_month || e.period_month < cutoffMonth) continue;
      let cm = monthSums.get(e.category_id);
      if (!cm) {
        cm = new Map();
        monthSums.set(e.category_id, cm);
      }
      cm.set(
        e.period_month,
        (cm.get(e.period_month) ?? 0) + e.amount_cents,
      );
    } else if (cat.frequency === "per_booking") {
      if (e.entry_date < cutoffMonth) continue;
      const cur =
        bookingSums.get(e.category_id) ?? { sum: 0, count: 0 };
      cur.sum += e.amount_cents;
      cur.count += 1;
      bookingSums.set(e.category_id, cur);
    }
  }

  const out = new Map<string, number>();
  for (const [cat, monthMap] of monthSums) {
    const sums = Array.from(monthMap.values());
    if (sums.length === 0) continue;
    out.set(
      cat,
      Math.round(sums.reduce((a, b) => a + b, 0) / sums.length),
    );
  }
  for (const [cat, bs] of bookingSums) {
    if (bs.count === 0) continue;
    out.set(cat, Math.round(bs.sum / bs.count));
  }
  return out;
}

export default async function AdminHome() {
  const sb = supabaseServer();
  const since12 = isoMonthsAgo(11);
  const yearStart = startOfYear();
  const monthStart = startOfMonth();
  const ninetyDaysAgo = isoDaysAgo(90);

  const [
    catsRes,
    entriesCountRes,
    capexRes,
    monthRes,
    trailingRes,
    recentRes,
    realized,
  ] = await Promise.all([
    sb
      .from("expense_categories")
      .select(
        "category_id, display_name, bucket, frequency, baseline_amount_cents, active",
      ),
    sb
      .from("expense_entries")
      .select("entry_id", { count: "exact", head: true }),
    sb.from("capex_items").select("amount_cents, monthly_amortization_cents"),
    sb
      .from("expense_entries")
      .select("amount_cents")
      .gte("entry_date", monthStart),
    sb
      .from("expense_entries")
      .select("category_id, period_month, entry_date, amount_cents")
      .gte("period_month", since12)
      .not("period_month", "is", null),
    sb
      .from("expense_entries")
      .select(
        "entry_id, entry_date, amount_cents, vendor, description, category_id",
      )
      .order("entry_date", { ascending: false })
      .limit(8),
    // Stopgap: live PriceLabs pull. See architecture-decisions.md §3.
    getRealizedAdr().catch((e) => {
      console.error("[admin] getRealizedAdr failed", e);
      return null;
    }),
  ]);

  const categories = (catsRes.data ?? []) as CategoryRow[];
  const entriesCount = entriesCountRes.count ?? 0;

  const capexRows = (capexRes.data ?? []) as Array<{
    amount_cents: number;
    monthly_amortization_cents: number | null;
  }>;
  const capexMonthly = capexRows.reduce(
    (s, r) => s + (r.monthly_amortization_cents ?? 0),
    0,
  );
  const capexLifetime = capexRows.reduce(
    (s, r) => s + r.amount_cents,
    0,
  );

  // ─── Cost structure groupings ───────────────────────────────
  const a1Items = categories
    .filter(
      (c) =>
        c.bucket === "A1" &&
        c.active &&
        c.frequency === "monthly" &&
        c.baseline_amount_cents != null,
    )
    .sort(
      (a, b) =>
        (b.baseline_amount_cents ?? 0) - (a.baseline_amount_cents ?? 0),
    );
  const a1Active = categories.filter(
    (c) => c.bucket === "A1" && c.active && c.frequency === "monthly",
  );
  const a1Tbd = a1Active.filter((c) => c.baseline_amount_cents == null);
  const a2Items = categories
    .filter(
      (c) =>
        c.bucket === "A2" &&
        c.active &&
        c.frequency === "annual" &&
        c.baseline_amount_cents != null,
    )
    .sort(
      (a, b) =>
        (b.baseline_amount_cents ?? 0) - (a.baseline_amount_cents ?? 0),
    );
  const b1Items = categories
    .filter(
      (c) =>
        c.bucket === "B1" &&
        c.active &&
        c.frequency === "per_booking" &&
        c.baseline_amount_cents != null,
    )
    .sort(
      (a, b) =>
        (b.baseline_amount_cents ?? 0) - (a.baseline_amount_cents ?? 0),
    );
  const b1Tbd = categories.filter(
    (c) =>
      c.bucket === "B1" &&
      c.active &&
      c.frequency === "per_booking" &&
      c.baseline_amount_cents == null,
  );

  const baselineA1 = a1Items.reduce(
    (s, c) => s + (c.baseline_amount_cents ?? 0),
    0,
  );
  const baselineA2Annual = a2Items.reduce(
    (s, c) => s + (c.baseline_amount_cents ?? 0),
    0,
  );
  const baselineA2Monthly = Math.round(baselineA2Annual / 12);
  const baselineB1 = b1Items.reduce(
    (s, c) => s + (c.baseline_amount_cents ?? 0),
    0,
  );
  const totalFixedMonthly = baselineA1 + baselineA2Monthly + capexMonthly;
  const baselineImplied = baselineA1 + capexMonthly;

  const monthRows = (monthRes.data ?? []) as Array<{ amount_cents: number }>;
  const monthSpend = monthRows.reduce((s, r) => s + r.amount_cents, 0);

  // ─── Trailing entries (12mo window with category_id) ───────
  const trailing = (trailingRes.data ?? []) as EntryRow[];

  // total monthly spend for the running 3/12 averages
  const monthSums = new Map<string, number>();
  for (const e of trailing) {
    if (!e.period_month) continue;
    monthSums.set(
      e.period_month,
      (monthSums.get(e.period_month) ?? 0) + e.amount_cents,
    );
  }
  const sortedMonths = Array.from(monthSums.entries()).sort((a, b) =>
    a[0] < b[0] ? 1 : -1,
  );
  const months3 = sortedMonths.slice(0, 3);
  const months12 = sortedMonths.slice(0, 12);
  const avg3 =
    months3.length > 0
      ? Math.round(months3.reduce((s, [, c]) => s + c, 0) / months3.length)
      : null;
  const avg12 =
    months12.length > 0
      ? Math.round(months12.reduce((s, [, c]) => s + c, 0) / months12.length)
      : null;

  // ─── Drift signals ──────────────────────────────────────────
  const a1Ids = new Set(a1Active.map((c) => c.category_id));
  const ytdA1Spend = trailing
    .filter(
      (e) =>
        e.category_id != null &&
        a1Ids.has(e.category_id) &&
        e.period_month != null &&
        e.period_month >= yearStart,
    )
    .reduce((s, e) => s + e.amount_cents, 0);
  const monthsElapsed = monthsElapsedThisYear();
  const ytdA1Expected = Math.round(monthsElapsed * baselineA1);

  // Per-category 3mo trailing avg + variance vs baseline
  const trailing3PerCat = perCategoryTrailingAvg(trailing, categories, 3);
  const driftableCats = categories.filter(
    (c) =>
      c.active &&
      c.baseline_amount_cents != null &&
      c.baseline_amount_cents > 0 &&
      (c.frequency === "monthly" || c.frequency === "per_booking") &&
      trailing3PerCat.has(c.category_id),
  );
  const driftRows = driftableCats
    .map((c) => {
      const actual = trailing3PerCat.get(c.category_id) ?? 0;
      const baseline = c.baseline_amount_cents ?? 0;
      const pct = ((actual - baseline) / baseline) * 100;
      return { c, actual, baseline, pct };
    })
    .filter((r) => Math.abs(r.pct) > 5)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 3);

  // C1 repair pulse — entries this month vs trailing 90 days
  const c1Ids = new Set(
    categories.filter((c) => c.bucket === "C1").map((c) => c.category_id),
  );
  const c1ThisMonth = trailing.filter(
    (e) =>
      e.category_id != null &&
      c1Ids.has(e.category_id) &&
      e.period_month === monthStart,
  );
  const c1ThisMonthSum = c1ThisMonth.reduce((s, e) => s + e.amount_cents, 0);
  const c1Last90 = trailing.filter(
    (e) =>
      e.category_id != null &&
      c1Ids.has(e.category_id) &&
      e.entry_date >= ninetyDaysAgo,
  );
  const c1Last90Sum = c1Last90.reduce((s, e) => s + e.amount_cents, 0);
  const c1MonthlyAvg90 = Math.round(c1Last90Sum / 3);

  const recent = (recentRes.data ?? []) as Array<{
    entry_id: number;
    entry_date: string;
    amount_cents: number;
    vendor: string | null;
    description: string | null;
    category_id: string | null;
  }>;

  return (
    <div>
      <h1 className={styles.h1}>Overview</h1>
      <p className={styles.subtitle}>
        {categories.length} categories tracked · {entriesCount} entries logged ·
        {" "}
        {capexRows.length} capex item{capexRows.length === 1 ? "" : "s"}.{" "}
        Manage in <Link href="/admin/categories">Categories</Link>,{" "}
        <Link href="/admin/entries">Entries</Link>,{" "}
        <Link href="/admin/capex">Capex</Link>. Month-by-month view in{" "}
        <Link href="/admin/monthly">Monthly</Link>.
      </p>

      <section className={styles.kpiGrid}>
        <KPICard
          meta={KPI_META.baseline_implied}
          value={fmt(baselineImplied)}
          sub={
            <>
              {fmt(baselineA1)} A1 fixed + {fmt(capexMonthly)} capex
              amortization
            </>
          }
          drillHref="/admin/categories?bucket=A1"
        />
        <KPICard
          meta={KPI_META.avg_monthly_3mo}
          value={avg3 == null ? "—" : fmt(avg3)}
          sub={
            <>
              {months3.length === 0
                ? "no entries yet"
                : `from ${months3.length} month${months3.length === 1 ? "" : "s"} of data`}
              {avg3 != null && baselineImplied > 0 ? (
                <>
                  {" · "}
                  {variancePill(avg3, baselineImplied, "vs baseline")}
                </>
              ) : null}
            </>
          }
          drillHref="/admin/monthly"
        />
        <KPICard
          meta={KPI_META.avg_monthly_12mo}
          value={avg12 == null ? "—" : fmt(avg12)}
          sub={
            months12.length === 0
              ? "no entries yet"
              : `from ${months12.length} month${months12.length === 1 ? "" : "s"} of data`
          }
          drillHref="/admin/monthly"
        />
        <KPICard
          meta={KPI_META.this_month_spend}
          value={fmt(monthSpend)}
          sub={`from ${monthRows.length} entr${monthRows.length === 1 ? "y" : "ies"}`}
          drillHref={`/admin/entries?period_month=${monthStart}`}
        />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Cost structure</p>
        <details className={styles.disclosure}>
          <summary>What do A1 / B1 / etc. mean?</summary>
          <div className={styles.disclosureBody}>
            {BUCKETS.map((b) => (
              <div key={b.code} className={styles.disclosureRow}>
                <div className={styles.disclosureCode}>{b.code}</div>
                <div className={styles.disclosureName}>{b.name}</div>
                <div className={styles.disclosureDesc}>{b.description}</div>
              </div>
            ))}
          </div>
        </details>
        <div className={styles.breakdownGrid} style={{ marginTop: 14 }}>
          <div className={styles.breakdownCard}>
            <p className={styles.breakdownTitle}>Fixed (per month)</p>
            {a1Items.map((c) => (
              <div key={c.category_id} className={styles.breakdownItem}>
                <span className={styles.breakdownItemLabel}>
                  {c.display_name}
                </span>
                <span>{fmt(c.baseline_amount_cents ?? 0)}</span>
              </div>
            ))}
            <div className={styles.breakdownSubtotal}>
              <span>A1 monthly recurring</span>
              <span>{fmt(baselineA1)}</span>
            </div>
            {baselineA2Monthly > 0 ? (
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownItemLabel}>
                  A2 annual ÷ 12 ({a2Items.length} item
                  {a2Items.length === 1 ? "" : "s"})
                </span>
                <span>{fmt(baselineA2Monthly)}</span>
              </div>
            ) : null}
            {capexMonthly > 0 ? (
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownItemLabel}>
                  Capex amortization ({capexRows.length} item
                  {capexRows.length === 1 ? "" : "s"})
                </span>
                <span>{fmt(capexMonthly)}</span>
              </div>
            ) : null}
            <div className={styles.breakdownTotal}>
              <span>Total fixed</span>
              <span>{fmt(totalFixedMonthly)} / mo</span>
            </div>
            {a1Tbd.length > 0 ? (
              <p className={styles.breakdownNote}>
                {a1Tbd.length} A1 categor{a1Tbd.length === 1 ? "y" : "ies"} active
                without baseline ({a1Tbd
                  .map((c) => c.display_name)
                  .join(", ")}). Fill in to firm up this number.
              </p>
            ) : null}
          </div>

          <div className={styles.breakdownCard}>
            <p className={styles.breakdownTitle}>Variable (per booking)</p>
            {b1Items.map((c) => (
              <div key={c.category_id} className={styles.breakdownItem}>
                <span className={styles.breakdownItemLabel}>
                  {c.display_name}
                </span>
                <span>{fmt(c.baseline_amount_cents ?? 0)}</span>
              </div>
            ))}
            <div className={styles.breakdownSubtotal}>
              <span>B1 turn cost</span>
              <span>{fmt(baselineB1)}</span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownItemLabel}>
                B2 channel fees{" "}
                <span className={styles.breakdownTbd}>(derived per channel)</span>
              </span>
              <span className={styles.breakdownTbd}>~5–17.5%</span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownItemLabel}>
                B3 payment processing{" "}
                <span className={styles.breakdownTbd}>(direct only)</span>
              </span>
              <span className={styles.breakdownTbd}>~3%</span>
            </div>
            <div className={styles.breakdownTotal}>
              <span>Per-booking floor</span>
              <span>{fmt(baselineB1)} + fees</span>
            </div>
            <p className={styles.breakdownNote}>
              Channel fees: Airbnb ~15.5% (17.5% if Super Strict) · Vrbo ~5%
              (PMS-connected) · Booking.com ~15%. Stripe ~2.9% + $0.30 applies
              only to direct bookings.{" "}
              {b1Tbd.length > 0
                ? `${b1Tbd.length} B1 line${b1Tbd.length === 1 ? "" : "s"} TBD: ${b1Tbd.map((c) => c.display_name).join(", ")}.`
                : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Drift signals ─────────────────────────────────── */}
      <section className={styles.section}>
        <p className={styles.sectionTitle}>Drift signals</p>
        <div className={styles.kpiGrid}>
          <KPICard
            meta={KPI_META.ytd_a1_pacing}
            value={ytdA1Spend === 0 ? "—" : fmt(ytdA1Spend)}
            sub={
              <>
                {ytdA1Expected > 0
                  ? `expected ${fmt(ytdA1Expected)} (${monthsElapsed.toFixed(1)} mo × baseline)`
                  : "no baseline set"}
                {ytdA1Spend > 0 && ytdA1Expected > 0 ? (
                  <>
                    {" · "}
                    {variancePill(ytdA1Spend, ytdA1Expected, "vs pace")}
                  </>
                ) : null}
              </>
            }
          />
          <KPICard
            meta={KPI_META.repair_pulse}
            value={
              c1ThisMonth.length === 0 && c1Last90.length === 0
                ? "—"
                : fmt(c1ThisMonthSum)
            }
            sub={
              c1ThisMonth.length === 0 && c1Last90.length === 0
                ? "no repairs logged"
                : `${c1ThisMonth.length} this month · ${c1Last90.length} in last 90d (avg ${fmt(c1MonthlyAvg90)}/mo)`
            }
            drillHref="/admin/categories?bucket=C1"
          />
          <KPICard
            meta={KPI_META.capex_lifetime}
            value={capexLifetime === 0 ? "—" : fmt(capexLifetime)}
            sub={
              capexRows.length === 0
                ? "no items logged"
                : `${capexRows.length} item${capexRows.length === 1 ? "" : "s"} · ${fmt(capexMonthly)}/mo carry`
            }
            drillHref="/admin/capex"
          />
          <KPICard
            meta={KPI_META.baseline_coverage}
            value={`${a1Items.length}/${a1Active.length}`}
            sub={
              a1Tbd.length === 0
                ? "all A1 categories priced"
                : `${a1Tbd.length} A1 categor${a1Tbd.length === 1 ? "y" : "ies"} still TBD`
            }
            drillHref="/admin/categories?bucket=A1"
          />
        </div>

        {driftRows.length > 0 ? (
          <>
            <p
              className={styles.sectionTitle}
              style={{ marginTop: 18, fontSize: 11 }}
            >
              Top drift categories (3mo trailing vs baseline)
            </p>
            <div className={styles.table}>
              <div
                className={styles.tableHeader}
                style={{
                  gridTemplateColumns: "60px 1fr 110px 110px 100px",
                }}
              >
                <div>Bucket</div>
                <div>Category</div>
                <div style={{ textAlign: "right" }}>Baseline</div>
                <div style={{ textAlign: "right" }}>3mo avg</div>
                <div style={{ textAlign: "right" }}>Δ</div>
              </div>
              {driftRows.map((r) => (
                <div
                  key={r.c.category_id}
                  className={styles.tableRow}
                  style={{
                    gridTemplateColumns: "60px 1fr 110px 110px 100px",
                  }}
                >
                  <div>
                    <span className={styles.bucketTag}>{r.c.bucket}</span>
                  </div>
                  <div className={styles.cell}>{r.c.display_name}</div>
                  <div className={styles.cell} style={{ textAlign: "right" }}>
                    {fmt(r.baseline)}
                  </div>
                  <div className={styles.cell} style={{ textAlign: "right" }}>
                    {fmt(r.actual)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {variancePill(r.actual, r.baseline)}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : trailing.length > 0 ? (
          <p
            className={styles.breakdownNote}
            style={{ marginTop: 14 }}
          >
            No categories drifting more than ±5% from baseline over the last 3
            months.
          </p>
        ) : null}

      </section>

      {/* ─── Pricing math (live) ─────────────────────────── */}
      {(() => {
        // CVP KPIs from KB §5.1 + the worksheet (PDF §2/§3).
        // ADR + LOS are pulled live from PriceLabs (stopgap;
        // see architecture-decisions.md §3 row 1).
        // Channel fees are NOT in CM — see data-watchlist.md §1.
        const adrCents = realized?.adrCents ?? null;
        const losNights = realized?.avgLosNights ?? null;
        const varPerNightCents =
          baselineB1 > 0 && losNights && losNights > 0
            ? Math.round(baselineB1 / losNights)
            : null;
        const cmCents =
          adrCents != null && varPerNightCents != null
            ? adrCents - varPerNightCents
            : null;
        const cmRatioPct =
          cmCents != null && adrCents && adrCents > 0
            ? (cmCents / adrCents) * 100
            : null;
        const breakEvenNights =
          cmCents != null && cmCents > 0 && totalFixedMonthly > 0
            ? totalFixedMonthly / cmCents
            : null;

        return (
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Pricing math (live)</p>
            <div className={styles.kpiGrid}>
              <KPICard
                meta={KPI_META.adr_180d}
                value={adrCents == null ? "—" : fmt(adrCents)}
                sub={
                  realized
                    ? `${realized.bookingsCount} bookings · ${realized.nights} nights · ${realized.pms}`
                    : "live data unavailable"
                }
              />
              <KPICard
                meta={KPI_META.avg_los}
                value={
                  losNights == null
                    ? "—"
                    : `${losNights.toFixed(1)} nights`
                }
                sub={
                  realized
                    ? `${realized.windowStart} → ${realized.windowEnd}`
                    : "live data unavailable"
                }
              />
              <KPICard
                meta={KPI_META.var_per_night}
                value={varPerNightCents == null ? "—" : fmt(varPerNightCents)}
                sub={
                  varPerNightCents == null
                    ? "needs B1 baseline + LOS"
                    : `${fmt(baselineB1)} B1 ÷ ${losNights?.toFixed(1)} nights`
                }
              />
              <KPICard
                meta={KPI_META.contribution_margin}
                value={cmCents == null ? "—" : fmt(cmCents)}
                sub={
                  cmCents == null
                    ? "needs ADR + variable / night"
                    : "per night, excl. channel fees"
                }
              />
              <KPICard
                meta={KPI_META.cm_ratio}
                value={
                  cmRatioPct == null ? "—" : `${cmRatioPct.toFixed(0)}%`
                }
                sub="CM ÷ ADR"
              />
              <KPICard
                meta={KPI_META.break_even_nights}
                value={
                  breakEvenNights == null
                    ? "—"
                    : breakEvenNights.toFixed(1)
                }
                sub={
                  breakEvenNights == null
                    ? "needs CM > 0"
                    : `total fixed ${fmt(totalFixedMonthly)} ÷ CM`
                }
              />
            </div>
            <p className={styles.breakdownNote} style={{ marginTop: 12 }}>
              Stopgap — ADR + LOS pulled live from PriceLabs at request time
              (single channel: {realized?.pms ?? "Airbnb"}). Channel fees not
              yet in CM. Proper version tracked in{" "}
              <code>architecture-decisions.md</code> §3 +{" "}
              <code>data-watchlist.md</code>.
            </p>
          </section>
        );
      })()}

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Recent entries</p>
        {recent.length === 0 ? (
          <p className={styles.empty}>
            No entries yet. Log your first one in{" "}
            <Link href="/admin/entries">Entries</Link>.
          </p>
        ) : (
          <div className={styles.table}>
            <div
              className={styles.tableHeader}
              style={{
                gridTemplateColumns: "100px 120px 1fr 120px",
              }}
            >
              <div>Date</div>
              <div>Category</div>
              <div>Vendor / note</div>
              <div style={{ textAlign: "right" }}>Amount</div>
            </div>
            {recent.map((r) => (
              <div
                key={r.entry_id}
                className={styles.tableRow}
                style={{ gridTemplateColumns: "100px 120px 1fr 120px" }}
              >
                <div className={styles.cell}>{r.entry_date}</div>
                <div className={styles.cell}>
                  <span className={styles.bucketTag}>{r.category_id ?? "—"}</span>
                </div>
                <div className={styles.cell}>
                  {r.vendor ? <strong>{r.vendor}</strong> : null}
                  {r.vendor && r.description ? " · " : ""}
                  {r.description ?? ""}
                </div>
                <div className={styles.cell} style={{ textAlign: "right" }}>
                  {fmt(r.amount_cents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Methodology — all KPIs at a glance ────────── */}
      <section className={styles.section}>
        <details className={styles.disclosure}>
          <summary>All KPIs at a glance — formulas + meaning</summary>
          <div className={styles.disclosureBody}>
            {Object.values(KPI_META).map((m) => (
              <div key={m.key} className={styles.disclosureRow}>
                <div className={styles.disclosureCode}>
                  {m.category === "cost"
                    ? "Cost"
                    : m.category === "drift"
                      ? "Drift"
                      : "Pricing"}
                </div>
                <div className={styles.disclosureName}>{m.label}</div>
                <div className={styles.disclosureDesc}>{m.formula}</div>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
