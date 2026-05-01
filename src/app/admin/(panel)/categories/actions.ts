"use server";

import { revalidatePath } from "next/cache";

import { supabaseServer } from "@/lib/supabase-server";

export async function updateCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("category_id") ?? "");
  if (!id) return;

  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const baselineRaw = String(formData.get("baseline_amount_cents") ?? "").trim();
  const baseline = baselineRaw ? Math.round(Number(baselineRaw) * 100) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const { error } = await supabaseServer()
    .from("expense_categories")
    .update({
      vendor,
      baseline_amount_cents: baseline,
      notes,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("category_id", id);

  if (error) {
    console.error("[admin/categories] update failed", error);
  }
  revalidatePath("/admin/categories");
  revalidatePath("/admin");
}
