/**
 * /admin — overview. Counts + this-month spend at-a-glance,
 * plus links into each section.
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

export default async function AdminHome() {
  const sb = supabaseServer();
  const [catsRes, entriesRes, capexRes, monthRes, recentRes] =
    await Promise.all([
      sb.from("expense_categories").select("category_id", { count: "exact", head: true }),
      sb.from("expense_entries").select("entry_id", { count: "exact", head: true }),
      sb.from("capex_items").select("monthly_amortization_cents"),
      sb
        .from("expense_entries")
        .select("amount_cents")
        .gte("entry_date", startOfMonth()),
      sb
        .from("expense_entries")
        .select("entry_id, entry_date, amount_cents, vendor, description, category_id")
        .order("entry_date", { ascending: false })
        .limit(8),
    ]);

  const categoriesCount = catsRes.count ?? 0;
  const entriesCount = entriesRes.count ?? 0;

  const capexRows = (capexRes.data ?? []) as Array<{
    monthly_amortization_cents: number | null;
  }>;
  const capexMonthly = capexRows.reduce(
    (s, r) => s + (r.monthly_amortization_cents ?? 0),
    0,
  );

  const monthRows = (monthRes.data ?? []) as Array<{ amount_cents: number }>;
  const monthSpend = monthRows.reduce((s, r) => s + r.amount_cents, 0);

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
        Categories live in <Link href="/admin/categories">/admin/categories</Link>.
        Money-out entries in <Link href="/admin/entries">/admin/entries</Link>.
        Long-lived purchases in <Link href="/admin/capex">/admin/capex</Link>.
      </p>

      <section className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Categories</p>
          <p className={styles.kpiValue}>{categoriesCount}</p>
          <p className={styles.kpiSub}>baselines + placeholders</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Entries logged</p>
          <p className={styles.kpiValue}>{entriesCount}</p>
          <p className={styles.kpiSub}>all time</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>This month spend</p>
          <p className={styles.kpiValue}>{fmt(monthSpend)}</p>
          <p className={styles.kpiSub}>
            from {monthRows.length} entr{monthRows.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Capex monthly carry</p>
          <p className={styles.kpiValue}>{fmt(capexMonthly)}</p>
          <p className={styles.kpiSub}>
            {capexRows.length} item{capexRows.length === 1 ? "" : "s"} amortized
          </p>
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
