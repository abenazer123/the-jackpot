"use server";

import { revalidatePath } from "next/cache";

import { supabaseServer } from "@/lib/supabase-server";

export async function createCapex(formData: FormData): Promise<void> {
  const purchase_date = String(formData.get("purchase_date") ?? "").trim();
  if (!purchase_date) return;
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;
  const amount = String(formData.get("amount") ?? "").trim();
  const amount_cents = amount ? Math.round(Number(amount) * 100) : 0;
  if (!Number.isFinite(amount_cents) || amount_cents <= 0) return;
  const lifespan_months = Number(formData.get("lifespan_months"));
  if (!Number.isFinite(lifespan_months) || lifespan_months <= 0) return;
  const category = String(formData.get("category") ?? "").trim() || null;
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabaseServer().from("capex_items").insert({
    purchase_date,
    description,
    amount_cents,
    lifespan_months,
    category,
    vendor,
    notes,
  });
  if (error) {
    console.error("[admin/capex] insert failed", error);
  }
  revalidatePath("/admin/capex");
  revalidatePath("/admin");
}

export async function deleteCapex(formData: FormData): Promise<void> {
  const id = Number(formData.get("item_id"));
  if (!Number.isFinite(id) || id <= 0) return;
  const { error } = await supabaseServer()
    .from("capex_items")
    .delete()
    .eq("item_id", id);
  if (error) {
    console.error("[admin/capex] delete failed", error);
  }
  revalidatePath("/admin/capex");
  revalidatePath("/admin");
}
