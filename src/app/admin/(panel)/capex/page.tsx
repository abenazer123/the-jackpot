/**
 * /admin/capex — long-lived purchases. Each row carries a
 * generated monthly amortization so reports can sum the true
 * monthly carry across all items.
 */

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import { createCapex, deleteCapex } from "./actions";

export const dynamic = "force-dynamic";

interface CapexItem {
  item_id: number;
  purchase_date: string;
  description: string;
  amount_cents: number;
  lifespan_months: number;
  category: string | null;
  vendor: string | null;
  notes: string | null;
  monthly_amortization_cents: number;
}

const CATEGORY_OPTIONS = [
  "furniture",
  "appliance",
  "mattress",
  "electronics",
  "hot_tub",
  "linens",
  "outdoor",
  "game_room",
  "kitchen",
  "other",
];

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CapexPage() {
  const { data, error } = await supabaseServer()
    .from("capex_items")
    .select("*")
    .order("purchase_date", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className={styles.h1}>Capex</h1>
        <p className={styles.error}>Failed to load: {error.message}</p>
      </div>
    );
  }

  const items = (data ?? []) as CapexItem[];
  const totalMonthly = items.reduce(
    (s, i) => s + i.monthly_amortization_cents,
    0,
  );
  const totalSpend = items.reduce((s, i) => s + i.amount_cents, 0);

  return (
    <div>
      <h1 className={styles.h1}>Capex</h1>
      <p className={styles.subtitle}>
        Long-lived purchases. Each carries a derived monthly
        amortization so the &ldquo;true&rdquo; cost-per-night picture
        doesn&rsquo;t miss the furniture / mattresses / electronics
        carrying cost.
      </p>

      <section className={styles.kpiGrid} style={{ marginBottom: 24 }}>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Items tracked</p>
          <p className={styles.kpiValue}>{items.length}</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Total spend</p>
          <p className={styles.kpiValue}>{fmt(totalSpend)}</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Monthly carry</p>
          <p className={styles.kpiValue}>{fmt(totalMonthly)}</p>
          <p className={styles.kpiSub}>amortized across lifespans</p>
        </div>
      </section>

      <form action={createCapex} className={styles.formCard}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Purchase date</label>
          <input
            name="purchase_date"
            type="date"
            required
            defaultValue={todayIso()}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Description</label>
          <input
            name="description"
            type="text"
            required
            placeholder="e.g. King mattress for Bedroom 1"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Amount ($)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Lifespan (months)</label>
          <input
            name="lifespan_months"
            type="number"
            min="1"
            required
            placeholder="e.g. 60 for 5 yrs"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Category</label>
          <select name="category" className={styles.select}>
            <option value="">—</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Vendor</label>
          <input name="vendor" type="text" className={styles.input} />
        </div>
        <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
          <label className={styles.fieldLabel}>Notes</label>
          <input name="notes" type="text" className={styles.input} />
        </div>
        <button type="submit" className={styles.button}>
          Add capex item
        </button>
      </form>

      <p className={styles.sectionTitle}>Inventory</p>
      {items.length === 0 ? (
        <p className={styles.empty}>
          No capex items yet. Furniture, mattresses, hot tub, electronics,
          appliances — anything with a multi-year lifespan goes here.
        </p>
      ) : (
        <div className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{
              gridTemplateColumns:
                "100px 1fr 110px 110px 110px 90px 70px",
            }}
          >
            <div>Bought</div>
            <div>Description</div>
            <div>Category</div>
            <div style={{ textAlign: "right" }}>Spend</div>
            <div style={{ textAlign: "right" }}>Lifespan</div>
            <div style={{ textAlign: "right" }}>Monthly</div>
            <div style={{ textAlign: "right" }}>×</div>
          </div>

          {items.map((i) => (
            <div
              key={i.item_id}
              className={styles.tableRow}
              style={{
                gridTemplateColumns:
                  "100px 1fr 110px 110px 110px 90px 70px",
              }}
            >
              <div className={styles.cell}>{i.purchase_date}</div>
              <div className={styles.cell}>
                <strong>{i.description}</strong>
                {i.vendor ? (
                  <div className={styles.cellMuted}>via {i.vendor}</div>
                ) : null}
              </div>
              <div className={styles.cell}>
                {i.category ? (
                  <span className={styles.bucketTag}>{i.category}</span>
                ) : (
                  "—"
                )}
              </div>
              <div className={styles.cell} style={{ textAlign: "right" }}>
                {fmt(i.amount_cents)}
              </div>
              <div className={styles.cell} style={{ textAlign: "right" }}>
                {i.lifespan_months} mo
              </div>
              <div className={styles.cell} style={{ textAlign: "right" }}>
                {fmt(i.monthly_amortization_cents)}
              </div>
              <div style={{ textAlign: "right" }}>
                <form action={deleteCapex}>
                  <input
                    type="hidden"
                    name="item_id"
                    value={i.item_id}
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
