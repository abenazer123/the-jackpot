/**
 * /admin/entries — log a money-out event. New form at the top,
 * recent entries below with delete.
 */

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import { createEntry, deleteEntry } from "./actions";

export const dynamic = "force-dynamic";

interface Category {
  category_id: string;
  display_name: string;
  bucket: string;
  active: boolean;
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

export default async function EntriesPage() {
  const sb = supabaseServer();
  const [catRes, entRes] = await Promise.all([
    sb
      .from("expense_categories")
      .select("category_id, display_name, bucket, active")
      .eq("active", true)
      .order("bucket", { ascending: true })
      .order("display_name", { ascending: true }),
    sb
      .from("expense_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("entry_id", { ascending: false })
      .limit(100),
  ]);

  const categories = (catRes.data ?? []) as Category[];
  const entries = (entRes.data ?? []) as Entry[];

  return (
    <div>
      <h1 className={styles.h1}>Entries</h1>
      <p className={styles.subtitle}>
        Log every money-out event as it happens. Tag the category;
        attach a <code>reservation_id</code> for per-booking variable
        costs (B1).
      </p>

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

      <p className={styles.sectionTitle}>Recent — last {entries.length}</p>
      {entries.length === 0 ? (
        <p className={styles.empty}>No entries yet.</p>
      ) : (
        <div className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{
              gridTemplateColumns:
                "100px 130px 130px 1fr 110px 70px",
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
                gridTemplateColumns:
                  "100px 130px 130px 1fr 110px 70px",
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
