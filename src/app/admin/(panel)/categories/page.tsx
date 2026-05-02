/**
 * /admin/categories — list every expense category with its
 * canonical baseline + trailing actuals. Each row is its own
 * form so updates are scoped to one category at a time. Bucket
 * filter at the top.
 *
 * Trailing averages: for `monthly` categories we sum entries per
 * `period_month` then average those monthly totals across the
 * window. For `per_booking` categories we average the entry
 * amounts directly (each entry is one turn). Other frequencies
 * show "—" because the metric doesn't translate.
 */

import Link from "next/link";

import { BUCKETS } from "@/lib/admin/buckets";
import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import { updateCategory } from "./actions";

export const dynamic = "force-dynamic";

const BUCKET_ORDER = [
  "A1",
  "A2",
  "B1",
  "B2",
  "B3",
  "C1",
  "C2",
  "C3",
  "C4",
  "D1",
  "D2",
];

interface Category {
  category_id: string;
  bucket: string;
  display_name: string;
  vendor: string | null;
  baseline_amount_cents: number | null;
  frequency: string | null;
  seasonality_notes: string | null;
  notes: string | null;
  active: boolean;
}

interface EntryRow {
  category_id: string | null;
  period_month: string | null;
  entry_date: string;
  amount_cents: number;
}

interface CategoriesPageProps {
  searchParams: Promise<{ bucket?: string }>;
}

function dollarsFromCents(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toString();
}

function fmt(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function computeTrailing(
  entries: EntryRow[],
  categories: Category[],
  monthsBack: number,
): Map<string, number> {
  const cutoff = isoMonthsAgo(monthsBack - 1);
  const byCategory = new Map<string, Category>();
  for (const c of categories) byCategory.set(c.category_id, c);

  // monthly: sum per (cat, period_month) → avg across distinct months
  const monthly = new Map<string, Map<string, number>>(); // cat → month → cents
  // per_booking: collect entry amounts → avg
  const perBooking = new Map<string, { sum: number; count: number }>();

  for (const e of entries) {
    if (!e.category_id) continue;
    const cat = byCategory.get(e.category_id);
    if (!cat) continue;

    if (cat.frequency === "monthly") {
      if (!e.period_month || e.period_month < cutoff) continue;
      let cm = monthly.get(e.category_id);
      if (!cm) {
        cm = new Map();
        monthly.set(e.category_id, cm);
      }
      cm.set(e.period_month, (cm.get(e.period_month) ?? 0) + e.amount_cents);
    } else if (cat.frequency === "per_booking") {
      // window by entry_date
      if (e.entry_date < cutoff) continue;
      const cur = perBooking.get(e.category_id) ?? { sum: 0, count: 0 };
      cur.sum += e.amount_cents;
      cur.count += 1;
      perBooking.set(e.category_id, cur);
    }
  }

  const out = new Map<string, number>();
  for (const [cat, monthMap] of monthly) {
    const sums = Array.from(monthMap.values());
    if (sums.length === 0) continue;
    const avg = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length);
    out.set(cat, avg);
  }
  for (const [cat, pb] of perBooking) {
    if (pb.count === 0) continue;
    out.set(cat, Math.round(pb.sum / pb.count));
  }
  return out;
}

function variancePill(actual: number | null, baseline: number | null) {
  if (actual == null || baseline == null || baseline === 0) return null;
  const pct = ((actual - baseline) / baseline) * 100;
  const sign = pct > 0 ? "+" : "";
  const label = `${sign}${pct.toFixed(0)}%`;
  let cls = styles.variancePillAt;
  if (pct < -2) cls = styles.variancePillUnder;
  else if (pct > 2) cls = styles.variancePillOver;
  return <span className={`${styles.variancePill} ${cls}`}>{label}</span>;
}

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const sp = await searchParams;
  const filter = sp.bucket?.toUpperCase();

  const sb = supabaseServer();
  const since12 = isoMonthsAgo(11);

  const [catRes, entRes] = await Promise.all([
    sb
      .from("expense_categories")
      .select("*")
      .order("bucket", { ascending: true })
      .order("category_id", { ascending: true }),
    sb
      .from("expense_entries")
      .select("category_id, period_month, entry_date, amount_cents")
      .gte("entry_date", since12),
  ]);

  if (catRes.error) {
    return (
      <div>
        <h1 className={styles.h1}>Categories</h1>
        <p className={styles.error}>Failed to load: {catRes.error.message}</p>
      </div>
    );
  }

  const all = (catRes.data ?? []) as Category[];
  const entries = (entRes.data ?? []) as EntryRow[];
  const trailing3 = computeTrailing(entries, all, 3);
  const trailing12 = computeTrailing(entries, all, 12);

  const rows = filter ? all.filter((c) => c.bucket === filter) : all;
  const buckets = Array.from(new Set(all.map((c) => c.bucket))).sort(
    (a, b) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b),
  );

  const grid = "50px 1fr 130px 90px 90px 90px 90px 60px 80px";

  return (
    <div>
      <h1 className={styles.h1}>Categories</h1>
      <p className={styles.subtitle}>
        Canonical baselines from{" "}
        <code>docs/second-brain/cost-structure.md</code>. <strong>Avg 3mo</strong> /
        <strong> Avg 12mo</strong> are derived from logged entries —{" "}
        <em>monthly</em> categories average the per-month total,{" "}
        <em>per_booking</em> categories average per entry. Variance pill compares
        most recent (3mo) to baseline.
      </p>

      <details className={styles.disclosure} style={{ marginBottom: 14 }}>
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

      <div className={styles.bucketFilter}>
        <Link
          href="/admin/categories"
          className={`${styles.bucketChip} ${!filter ? styles.bucketChipActive : ""}`}
        >
          All ({all.length})
        </Link>
        {buckets.map((b) => (
          <Link
            key={b}
            href={`/admin/categories?bucket=${b}`}
            className={`${styles.bucketChip} ${filter === b ? styles.bucketChipActive : ""}`}
          >
            {b} ({all.filter((c) => c.bucket === b).length})
          </Link>
        ))}
      </div>

      <div className={styles.table}>
        <div
          className={styles.tableHeader}
          style={{ gridTemplateColumns: grid }}
        >
          <div>Bucket</div>
          <div>Category</div>
          <div>Vendor</div>
          <div style={{ textAlign: "right" }}>Baseline</div>
          <div style={{ textAlign: "right" }}>Avg 3mo</div>
          <div style={{ textAlign: "right" }}>Avg 12mo</div>
          <div style={{ textAlign: "right" }}>Δ</div>
          <div style={{ textAlign: "center" }}>Active</div>
          <div style={{ textAlign: "right" }}>Save</div>
        </div>

        {rows.map((c) => {
          const a3 = trailing3.get(c.category_id) ?? null;
          const a12 = trailing12.get(c.category_id) ?? null;
          return (
            <form
              key={c.category_id}
              action={updateCategory}
              className={styles.tableRow}
              style={{ gridTemplateColumns: grid }}
            >
              <input type="hidden" name="category_id" value={c.category_id} />
              <input type="hidden" name="notes" value={c.notes ?? ""} />
              <div>
                <span className={styles.bucketTag}>{c.bucket}</span>
              </div>
              <div className={styles.cell}>
                <strong>{c.display_name}</strong>
                <div className={styles.cellMuted}>
                  {c.frequency} · {c.category_id}
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>
              </div>
              <div>
                <input
                  name="vendor"
                  defaultValue={c.vendor ?? ""}
                  className={styles.input}
                  placeholder="—"
                />
              </div>
              <div style={{ textAlign: "right" }}>
                <input
                  name="baseline_amount_cents"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={dollarsFromCents(c.baseline_amount_cents)}
                  className={styles.input}
                  placeholder="TBD"
                  style={{ textAlign: "right" }}
                />
              </div>
              <div className={styles.cell} style={{ textAlign: "right" }}>
                {fmt(a3)}
              </div>
              <div className={styles.cell} style={{ textAlign: "right" }}>
                {fmt(a12)}
              </div>
              <div style={{ textAlign: "right" }}>
                {variancePill(a3, c.baseline_amount_cents) ?? (
                  <span className={styles.cellMuted}>—</span>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={c.active}
                  style={{ width: 16, height: 16 }}
                />
              </div>
              <div style={{ textAlign: "right" }}>
                <button type="submit" className={styles.button}>
                  Save
                </button>
              </div>
            </form>
          );
        })}
      </div>

    </div>
  );
}
