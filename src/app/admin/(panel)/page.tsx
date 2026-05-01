/**
 * /admin — overview. The "what's the typical month?" view:
 *   - Baseline implied (A1 monthly fixed + capex amortization) —
 *     what we expect a month to cost before any variable B1 turns.
 *   - Avg monthly (3mo) — derived: actual entries grouped by
 *     period_month, averaged across last 3 calendar months that
 *     had any entries. The "current avg" the operator watches.
 *   - Avg monthly (12mo) — same shape, longer window.
 *   - This month — running total for the current period.
 *
 * Plus the 8 most-recent entries below.
 */

import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";

import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function variancePill(actual: number, baseline: number) {
  if (baseline === 0) return null;
  const pct = ((actual - baseline) / baseline) * 100;
  const sign = pct > 0 ? "+" : "";
  let cls = styles.variancePillAt;
  if (pct < -2) cls = styles.variancePillUnder;
  else if (pct > 2) cls = styles.variancePillOver;
  return (
    <span className={`${styles.variancePill} ${cls}`}>
      {sign}
      {pct.toFixed(0)}% vs baseline
    </span>
  );
}

export default async function AdminHome() {
  const sb = supabaseServer();
  const since12 = isoMonthsAgo(11);

  const [catsRes, entriesCountRes, capexRes, monthRes, trailingRes, recentRes] =
    await Promise.all([
      sb
        .from("expense_categories")
        .select(
          "category_id, display_name, bucket, frequency, baseline_amount_cents, active",
        ),
      sb
        .from("expense_entries")
        .select("entry_id", { count: "exact", head: true }),
      sb.from("capex_items").select("monthly_amortization_cents"),
      sb
        .from("expense_entries")
        .select("amount_cents")
        .gte("entry_date", startOfMonth()),
      sb
        .from("expense_entries")
        .select("period_month, amount_cents")
        .gte("period_month", since12)
        .not("period_month", "is", null),
      sb
        .from("expense_entries")
        .select(
          "entry_id, entry_date, amount_cents, vendor, description, category_id",
        )
        .order("entry_date", { ascending: false })
        .limit(8),
    ]);

  const categories = (catsRes.data ?? []) as Array<{
    category_id: string;
    display_name: string;
    bucket: string;
    frequency: string | null;
    baseline_amount_cents: number | null;
    active: boolean;
  }>;
  const entriesCount = entriesCountRes.count ?? 0;

  const capexRows = (capexRes.data ?? []) as Array<{
    monthly_amortization_cents: number | null;
  }>;
  const capexMonthly = capexRows.reduce(
    (s, r) => s + (r.monthly_amortization_cents ?? 0),
    0,
  );

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
  const a1Tbd = categories.filter(
    (c) =>
      c.bucket === "A1" &&
      c.active &&
      c.frequency === "monthly" &&
      c.baseline_amount_cents == null,
  );
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

  // Trailing averages — group entries by period_month, sum, then
  // average the monthly totals across last 3 / 12 months that had data.
  const trailing = (trailingRes.data ?? []) as Array<{
    period_month: string;
    amount_cents: number;
  }>;
  const monthSums = new Map<string, number>();
  for (const e of trailing) {
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
      ? Math.round(
          months3.reduce((s, [, c]) => s + c, 0) / months3.length,
        )
      : null;
  const avg12 =
    months12.length > 0
      ? Math.round(
          months12.reduce((s, [, c]) => s + c, 0) / months12.length,
        )
      : null;

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
        <Link href="/admin/categories?bucket=A1" className={styles.kpi}>
          <p className={styles.kpiLabel}>Baseline implied</p>
          <p className={styles.kpiValue}>{fmt(baselineImplied)}</p>
          <p className={styles.kpiSub}>
            {fmt(baselineA1)} A1 fixed + {fmt(capexMonthly)} capex amortization
          </p>
        </Link>
        <Link href="/admin/monthly" className={styles.kpi}>
          <p className={styles.kpiLabel}>Avg monthly (3mo)</p>
          <p className={styles.kpiValue}>
            {avg3 == null ? "—" : fmt(avg3)}
          </p>
          <p className={styles.kpiSub}>
            {months3.length === 0
              ? "no entries yet"
              : `from ${months3.length} month${months3.length === 1 ? "" : "s"} of data`}
            {avg3 != null && baselineImplied > 0 ? (
              <>
                {" · "}
                {variancePill(avg3, baselineImplied)}
              </>
            ) : null}
          </p>
        </Link>
        <Link href="/admin/monthly" className={styles.kpi}>
          <p className={styles.kpiLabel}>Avg monthly (12mo)</p>
          <p className={styles.kpiValue}>
            {avg12 == null ? "—" : fmt(avg12)}
          </p>
          <p className={styles.kpiSub}>
            {months12.length === 0
              ? "no entries yet"
              : `from ${months12.length} month${months12.length === 1 ? "" : "s"} of data`}
          </p>
        </Link>
        <Link
          href={`/admin/entries?period_month=${startOfMonth()}`}
          className={styles.kpi}
        >
          <p className={styles.kpiLabel}>This month spend</p>
          <p className={styles.kpiValue}>{fmt(monthSpend)}</p>
          <p className={styles.kpiSub}>
            from {monthRows.length} entr{monthRows.length === 1 ? "y" : "ies"}
          </p>
        </Link>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Cost structure</p>
        <div className={styles.breakdownGrid}>
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
    </div>
  );
}
