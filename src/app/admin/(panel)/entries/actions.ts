"use server";

import { revalidatePath } from "next/cache";

import { supabaseServer } from "@/lib/supabase-server";

function periodMonth(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

function lastDayOfMonth(year: number, month1: number): string {
  // month1 is 1-based. Day 0 of next month = last day of current.
  const last = new Date(year, month1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

export async function createEntry(formData: FormData): Promise<void> {
  const category_id =
    String(formData.get("category_id") ?? "").trim() || null;
  const entry_date = String(formData.get("entry_date") ?? "").trim();
  if (!entry_date) return;
  const amount = String(formData.get("amount") ?? "").trim();
  const amount_cents = amount ? Math.round(Number(amount) * 100) : 0;
  if (!Number.isFinite(amount_cents) || amount_cents < 0) return;

  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const reservation_id =
    String(formData.get("reservation_id") ?? "").trim() || null;

  const { error } = await supabaseServer().from("expense_entries").insert({
    category_id,
    entry_date,
    period_month: periodMonth(entry_date),
    amount_cents,
    vendor,
    description,
    reservation_id,
    created_by: "operator",
  });
  if (error) {
    console.error("[admin/entries] insert failed", error);
  }
  revalidatePath("/admin/entries");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/monthly");
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const id = Number(formData.get("entry_id"));
  if (!Number.isFinite(id) || id <= 0) return;
  const { error } = await supabaseServer()
    .from("expense_entries")
    .delete()
    .eq("entry_id", id);
  if (error) {
    console.error("[admin/entries] delete failed", error);
  }
  revalidatePath("/admin/entries");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/monthly");
}

/**
 * Bulk insert one entry per filled-in `amount_<category_id>`
 * field, all stamped with the same period_month + entry_date
 * (last day of the chosen month). Empty inputs are skipped so
 * partial months work.
 */
export async function createMonthlySnapshot(
  formData: FormData,
): Promise<void> {
  const period = String(formData.get("period") ?? "").trim();
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return;
  const year = Number(m[1]);
  const month1 = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month1)) return;
  const period_month = `${m[1]}-${m[2]}-01`;
  const entry_date = lastDayOfMonth(year, month1);

  type Insert = {
    category_id: string;
    entry_date: string;
    period_month: string;
    amount_cents: number;
    description: string | null;
    created_by: string;
  };

  const inserts: Insert[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amount_")) continue;
    const cat = key.slice("amount_".length);
    const raw = String(value).trim();
    if (!raw) continue;
    const cents = Math.round(Number(raw) * 100);
    if (!Number.isFinite(cents) || cents < 0) continue;
    inserts.push({
      category_id: cat,
      entry_date,
      period_month,
      amount_cents: cents,
      description: `Monthly snapshot ${period}`,
      created_by: "operator",
    });
  }

  if (inserts.length === 0) return;

  const { error } = await supabaseServer()
    .from("expense_entries")
    .insert(inserts);
  if (error) {
    console.error("[admin/entries] monthly snapshot insert failed", error);
  }
  revalidatePath("/admin/entries");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/monthly");
}
