"use server";

import { revalidatePath } from "next/cache";

import { supabaseServer } from "@/lib/supabase-server";

function periodMonth(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
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
}
