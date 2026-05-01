/**
 * /admin/entries — log money-out events.
 *
 * Two creation flows:
 *   - Bulk monthly snapshot: one form, one row per active monthly
 *     category, picks a period and writes every filled row at
 *     once. For backfilling past months and for end-of-month
 *     reconciliation.
 *   - Single entry: one-off costs (B1 turns, C1 repairs, etc.)
 *     where you want to attach a vendor / reservation_id /
 *     custom date.
 *
 * Recent entries below with delete. ?period_month=YYYY-MM-01
 * filters the recent list to a single month.
 */

import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import {
  createEntry,
  createMonthlySnapshot,
  deleteEntry,
} from "./actions";

export const dynamic = "force-dynamic";

interface Category {
  category_id: string;
  display_name: string;
  bucket: string;
  active: boolean;
  baseline_amount_cents: number | null;
  frequency: string | null;
}

interface Entry {
  entry_id: number;
  category_id: string | null;
  entry_date: string;
  period_month: string | null;
  amount_cents: number;
  vendor: string | null;
  description: string | null;
  reservation_id: string | null;
}

interface EntriesPageProps {
  searchParams: Promise<{ period_month?: string }>;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thisMonthYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function EntriesPage({ searchParams }: EntriesPageProps) {
  const sp = await searchParams;
  const periodFilter = sp.period_month ?? null;

  const sb = supabaseServer();
  const [catRes, entRes] = await Promise.all([
    sb
      .from("expense_categories")
      .select(
        "category_id, display_name, bucket, active, baseline_amount_cents, frequency",
      )
      .eq("active", true)
      .order("bucket", { ascending: true })
      .order("display_name", { ascending: true }),
    (() => {
      let q = sb
        .from("expense_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("entry_id", { ascending: false })
        .limit(periodFilter ? 500 : 100);
      if (periodFilter) q = q.eq("period_month", periodFilter);
      return q;
    })(),
  ]);

  const categories = (catRes.data ?? []) as Category[];
  const entries = (entRes.data ?? []) as Entry[];
  const monthlyCategories = categories.filter(
    (c) => c.frequency === "monthly",
  );

  return (
    <div>
      <h1 className={styles.h1}>Entries</h1>
      <p className={styles.subtitle}>
        Log money-out events. Use the <strong>monthly snapshot</strong> form for
        recurring bills (one click per period); use the{" "}
        <strong>single entry</strong> form for per-booking variable costs,
        repairs, or anything that needs a vendor / reservation tag.
      </p>

      {/* ───── Bulk monthly snapshot ───── */}
      <form
        action={createMonthlySnapshot}
        className={styles.formCard}
        style={{
          display: "block",
          gridTemplateColumns: "none",
        }}
      >
        <p className={styles.sectionTitle} style={{ marginTop: 0 }}>
          Monthly snapshot
        </p>
        <div
          className={styles.field}
          style={{ maxWidth: 220, marginBottom: 14 }}
        >
          <label className={styles.fieldLabel}>Period</label>
          <input
            name="period"
            type="month"
            required
            defaultValue={thisMonthYM()}
            className={styles.input}
          />
        </div>

        {monthlyCategories.length === 0 ? (
          <p className={styles.empty}>
            No monthly categories active. Toggle some on in{" "}
            <Link href="/admin/categories">Categories</Link>.
          </p>
        ) : (
          <>
            {monthlyCategories.map((c) => (
              <div key={c.category_id} className={styles.bulkRow}>
                <div className={styles.bulkRowLabel}>
                  <span className={styles.bucketTag}>{c.bucket}</span>{" "}
                  <strong style={{ marginLeft: 6 }}>{c.display_name}</strong>
                </div>
                <div className={styles.bulkRowBaseline}>
                  {c.baseline_amount_cents != null
                    ? `Baseline ${fmt(c.baseline_amount_cents)}`
                    : "no baseline"}
                </div>
                <div>
                  <input
                    name={`amount_${c.category_id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={
                      c.baseline_amount_cents != null
                        ? (c.baseline_amount_cents / 100).toString()
                        : "0.00"
                    }
                    className={styles.input}
                  />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <button type="submit" className={styles.button}>
                Save snapshot
              </button>
              <span
                className={styles.cellMuted}
                style={{ marginLeft: 12, fontSize: 12 }}
              >
                Empty rows are skipped — partial months are fine.
              </span>
            </div>
          </>
        )}
      </form>

      {/* ───── Single entry ───── */}
      <p className={styles.sectionTitle}>Single entry</p>
      <form action={createEntry} className={styles.formCard}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Date</label>
          <input
            name="entry_date"
            type="date"
            required
            defaultValue={todayIso()}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Category</label>
          <select name="category_id" required className={styles.select}>
            <option value="">Pick a category…</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                [{c.bucket}] {c.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Amount ($)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Vendor</label>
          <input
            name="vendor"
            type="text"
            placeholder="Plumber, ComEd, Amazon…"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Description</label>
          <input
            name="description"
            type="text"
            placeholder="Optional details"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Reservation ID</label>
          <input
            name="reservation_id"
            type="text"
            placeholder="(optional, for B1)"
            className={styles.input}
          />
        </div>
        <button type="submit" className={styles.button}>
          Log entry
        </button>
      </form>

      <p className={styles.sectionTitle}>
        {periodFilter
          ? `Entries for ${periodFilter.slice(0, 7)} — ${entries.length}`
          : `Recent — last ${entries.length}`}
        {periodFilter ? (
          <Link
            href="/admin/entries"
            className={styles.bucketChip}
            style={{ marginLeft: 12 }}
          >
            clear filter
          </Link>
        ) : null}
      </p>
      {entries.length === 0 ? (
        <p className={styles.empty}>No entries.</p>
      ) : (
        <div className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{
              gridTemplateColumns: "100px 130px 130px 1fr 110px 70px",
            }}
          >
            <div>Date</div>
            <div>Category</div>
            <div>Vendor</div>
            <div>Description</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div style={{ textAlign: "right" }}>×</div>
          </div>

          {entries.map((e) => (
            <div
              key={e.entry_id}
              className={styles.tableRow}
              style={{
                gridTemplateColumns: "100px 130px 130px 1fr 110px 70px",
              }}
            >
              <div className={styles.cell}>{e.entry_date}</div>
              <div className={styles.cell}>
                <span className={styles.bucketTag}>
                  {e.category_id ?? "—"}
                </span>
              </div>
              <div className={styles.cell}>{e.vendor ?? "—"}</div>
              <div className={styles.cell}>
                {e.description ?? ""}
                {e.reservation_id ? (
                  <span className={styles.cellMuted}>
                    {" "}
                    · res {e.reservation_id.slice(0, 8)}…
                  </span>
                ) : null}
              </div>
              <div className={styles.cell} style={{ textAlign: "right" }}>
                {fmt(e.amount_cents)}
              </div>
              <div style={{ textAlign: "right" }}>
                <form action={deleteEntry}>
                  <input
                    type="hidden"
                    name="entry_id"
                    value={e.entry_id}
                  />
                  <button
                    type="submit"
                    className={styles.buttonDanger}
                    title="Delete"
                  >
                    ×
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
