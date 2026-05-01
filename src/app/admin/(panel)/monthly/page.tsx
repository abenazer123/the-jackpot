/**
 * /admin/monthly — month-over-month totals by bucket.
 *
 * Groups expense_entries by period_month + the parent category's
 * bucket. Last 24 months. Click a row to drill into
 * /admin/entries?period_month=YYYY-MM-01 for that month.
 *
 * Baseline-implied total assumes every active monthly category
 * comes in at its baseline + per_booking categories ×
 * (entries-with-reservation count for that month).
 */

import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

interface Category {
  category_id: string;
  bucket: string;
  baseline_amount_cents: number | null;
  frequency: string | null;
  active: boolean;
}

interface EntryRow {
  category_id: string | null;
  period_month: string | null;
  amount_cents: number;
  reservation_id: string | null;
}

const BUCKET_LABELS: Record<string, string> = {
  A1: "A1 fixed (mo)",
  A2: "A2 annual",
  B1: "B1 turn",
  B2: "B2 channel",
  B3: "B3 payment",
  C1: "C1 repair",
  C3: "C3 compliance",
  C4: "C4 marketing",
};

const BUCKET_ORDER = ["A1", "A2", "B1", "B2", "B3", "C1", "C3", "C4"];

function fmt(cents: number): string {
  if (cents === 0) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(periodMonth: string): string {
  const m = /^(\d{4})-(\d{2})-/.exec(periodMonth);
  if (!m) return periodMonth;
  const year = m[1];
  const monthIdx = Number(m[2]) - 1;
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${names[monthIdx] ?? "—"} ${year}`;
}

export default async function MonthlyPage() {
  const sb = supabaseServer();
  const since = isoMonthsAgo(23); // last 24 months inclusive

  const [catRes, entRes] = await Promise.all([
    sb
      .from("expense_categories")
      .select(
        "category_id, bucket, baseline_amount_cents, frequency, active",
      ),
    sb
      .from("expense_entries")
      .select("category_id, period_month, amount_cents, reservation_id")
      .gte("period_month", since)
      .order("period_month", { ascending: false }),
  ]);

  const categories = (catRes.data ?? []) as Category[];
  const entries = (entRes.data ?? []) as EntryRow[];
  const byCat = new Map<string, Category>();
  for (const c of categories) byCat.set(c.category_id, c);

  // Build month → bucket → cents
  type BucketSums = Record<string, number>;
  const months = new Map<string, BucketSums>();
  // For each month, also count distinct reservations seen (proxy for turns)
  const turnsByMonth = new Map<string, Set<string>>();

  for (const e of entries) {
    if (!e.period_month || !e.category_id) continue;
    const cat = byCat.get(e.category_id);
    if (!cat) continue;
    const bucketSums = months.get(e.period_month) ?? {};
    bucketSums[cat.bucket] = (bucketSums[cat.bucket] ?? 0) + e.amount_cents;
    months.set(e.period_month, bucketSums);
    if (cat.bucket === "B1" && e.reservation_id) {
      const turns = turnsByMonth.get(e.period_month) ?? new Set<string>();
      turns.add(e.reservation_id);
      turnsByMonth.set(e.period_month, turns);
    }
  }

  // Baseline-implied monthly fixed + per-booking
  const baselineA1 = categories
    .filter((c) => c.bucket === "A1" && c.active && c.frequency === "monthly")
    .reduce((s, c) => s + (c.baseline_amount_cents ?? 0), 0);
  const baselineB1PerBooking = categories
    .filter((c) => c.bucket === "B1" && c.active && c.frequency === "per_booking")
    .reduce((s, c) => s + (c.baseline_amount_cents ?? 0), 0);

  const monthRows = Array.from(months.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([period, bucketSums]) => {
      const grand = Object.values(bucketSums).reduce((s, n) => s + n, 0);
      const turns = turnsByMonth.get(period)?.size ?? 0;
      const impliedBaseline = baselineA1 + turns * baselineB1PerBooking;
      const variance =
        impliedBaseline > 0
          ? Math.round(((grand - impliedBaseline) / impliedBaseline) * 100)
          : null;
      return { period, bucketSums, grand, turns, impliedBaseline, variance };
    });

  const grid = `120px ${BUCKET_ORDER.map(() => "minmax(80px, 1fr)").join(" ")} 110px 90px`;

  return (
    <div>
      <h1 className={styles.h1}>Monthly</h1>
      <p className={styles.subtitle}>
        Total spend per month by bucket (last 24 months). Δ compares the grand
        total to the baseline-implied total ({fmt(baselineA1)} fixed +{" "}
        {fmt(baselineB1PerBooking)} × turns observed).
      </p>

      {monthRows.length === 0 ? (
        <p className={styles.empty}>
          No entries logged yet. Add some via{" "}
          <Link href="/admin/entries">Entries</Link> and they&rsquo;ll roll up
          here.
        </p>
      ) : (
        <div className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{ gridTemplateColumns: grid }}
          >
            <div>Month</div>
            {BUCKET_ORDER.map((b) => (
              <div key={b} style={{ textAlign: "right" }}>
                {BUCKET_LABELS[b] ?? b}
              </div>
            ))}
            <div style={{ textAlign: "right" }}>Total</div>
            <div style={{ textAlign: "right" }}>Δ</div>
          </div>

          {monthRows.map((r) => (
            <Link
              key={r.period}
              href={`/admin/entries?period_month=${r.period}`}
              className={styles.tableRow}
              style={{
                gridTemplateColumns: grid,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div className={styles.cell}>{monthLabel(r.period)}</div>
              {BUCKET_ORDER.map((b) => (
                <div
                  key={b}
                  className={styles.cell}
                  style={{ textAlign: "right" }}
                >
                  {fmt(r.bucketSums[b] ?? 0)}
                </div>
              ))}
              <div className={styles.cell} style={{ textAlign: "right" }}>
                <strong>{fmt(r.grand)}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                {r.variance == null ? (
                  <span className={styles.cellMuted}>—</span>
                ) : (
                  <span
                    className={`${styles.variancePill} ${
                      r.variance < -2
                        ? styles.variancePillUnder
                        : r.variance > 2
                          ? styles.variancePillOver
                          : styles.variancePillAt
                    }`}
                  >
                    {r.variance > 0 ? "+" : ""}
                    {r.variance}%
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
