/**
 * /admin/categories — list every expense category with its
 * canonical baseline. Each row is its own form so updates are
 * scoped to one category at a time. Bucket filter at the top.
 */

import Link from "next/link";

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

interface CategoriesPageProps {
  searchParams: Promise<{ bucket?: string }>;
}

function dollarsFromCents(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toString();
}

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const sp = await searchParams;
  const filter = sp.bucket?.toUpperCase();

  const { data, error } = await supabaseServer()
    .from("expense_categories")
    .select("*")
    .order("bucket", { ascending: true })
    .order("category_id", { ascending: true });

  if (error) {
    return (
      <div>
        <h1 className={styles.h1}>Categories</h1>
        <p className={styles.error}>Failed to load: {error.message}</p>
      </div>
    );
  }

  const all = (data ?? []) as Category[];
  const rows = filter ? all.filter((c) => c.bucket === filter) : all;
  const buckets = Array.from(new Set(all.map((c) => c.bucket))).sort(
    (a, b) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b),
  );

  return (
    <div>
      <h1 className={styles.h1}>Categories</h1>
      <p className={styles.subtitle}>
        Canonical baseline values seeded from{" "}
        <code>docs/second-brain/cost-structure.md</code>. Edit any field
        inline. Empty <code>baseline</code> means we haven&rsquo;t locked
        a number yet — fill it in once you know.
      </p>

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
          style={{
            gridTemplateColumns:
              "60px 200px 160px 120px 1fr 80px 90px",
          }}
        >
          <div>Bucket</div>
          <div>Category</div>
          <div>Vendor</div>
          <div>Baseline ($)</div>
          <div>Notes</div>
          <div style={{ textAlign: "center" }}>Active</div>
          <div style={{ textAlign: "right" }}>Save</div>
        </div>

        {rows.map((c) => (
          <form
            key={c.category_id}
            action={updateCategory}
            className={styles.tableRow}
            style={{
              gridTemplateColumns:
                "60px 200px 160px 120px 1fr 80px 90px",
            }}
          >
            <input type="hidden" name="category_id" value={c.category_id} />
            <div>
              <span className={styles.bucketTag}>{c.bucket}</span>
            </div>
            <div className={styles.cell}>
              <strong>{c.display_name}</strong>
              <div className={styles.cellMuted}>
                {c.frequency} · {c.category_id}
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
            <div>
              <input
                name="baseline_amount_cents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={dollarsFromCents(c.baseline_amount_cents)}
                className={styles.input}
                placeholder="TBD"
              />
            </div>
            <div>
              <input
                name="notes"
                defaultValue={c.notes ?? ""}
                className={styles.input}
                placeholder="—"
              />
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
        ))}
      </div>
    </div>
  );
}
