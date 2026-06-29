"use server";

import { revalidatePath } from "next/cache";

import { DEPOSIT_NOW_USD } from "@/lib/booking/agreement";
import { sendPaymentLinkEmail } from "@/lib/email/paymentLink";
import { siteOrigin } from "@/lib/siteOrigin";
import { supabaseServer } from "@/lib/supabase-server";

import { refreshAllPrices as runRefreshAllPrices } from "./refresh";

/**
 * Server action: refresh listing_prices from PriceLabs for every
 * future-dated inquiry, recompute today's quote per inquiry, and write
 * it to the quote_refreshed_* columns. Triggered by the "Update prices"
 * form button on /admin/inquiries.
 *
 * Returns nothing — the form revalidates the page after success and
 * the new totals show up in the "New" column on next render.
 */
export async function refreshAllPrices(): Promise<void> {
  const result = await runRefreshAllPrices();
  console.log(
    "[admin/inquiries] refreshAllPrices result",
    result,
  );
  revalidatePath("/admin/inquiries");
}

function nightsBetween(arrival: string, departure: string): number {
  const a = new Date(arrival).getTime();
  const b = new Date(departure).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

/**
 * Server action: email a guest their payment link. Abe edits the subject +
 * personal note in the composer; everything else (summary card, secure
 * button, signature) is templated, and the amounts are derived from the
 * inquiry's real total so the email can never disagree with the page.
 * Records when it was sent. Triggered from the inquiry detail composer.
 */
export async function sendPaymentLink(input: {
  token: string;
  subject: string;
  note: string;
}): Promise<{ ok: boolean; error?: string }> {
  const subject = input.subject.trim();
  const note = input.note.trim();
  if (!subject) return { ok: false, error: "subject_required" };
  if (!note) return { ok: false, error: "note_required" };
  if (!/^[0-9A-Za-z_-]{22}$/.test(input.token)) {
    return { ok: false, error: "invalid_token" };
  }

  const supabase = supabaseServer();
  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .select(
      "id, name, email, arrival, departure, guests, quote_total_cents, share_token, payment_link_sent_count",
    )
    .eq("share_token", input.token)
    .maybeSingle();
  if (error || !inquiry) return { ok: false, error: "inquiry_not_found" };
  if (!inquiry.email) return { ok: false, error: "no_email_on_file" };
  if (!inquiry.arrival || !inquiry.departure) {
    return { ok: false, error: "no_dates_on_file" };
  }
  const totalCents = (inquiry.quote_total_cents as number | null) ?? 0;
  if (totalCents <= 0) return { ok: false, error: "no_quote_total" };

  const sent = await sendPaymentLinkEmail({
    to: inquiry.email as string,
    guestName: (inquiry.name as string) ?? "there",
    subject,
    note,
    arrival: inquiry.arrival as string,
    departure: inquiry.departure as string,
    nights: nightsBetween(inquiry.arrival as string, inquiry.departure as string),
    guests: (inquiry.guests as number | null) ?? 14,
    totalCents,
    confirmUrl: `${siteOrigin()}/confirm/${inquiry.share_token}`,
    depositUsd: DEPOSIT_NOW_USD,
    halfCents: Math.round(totalCents / 2),
  });
  if (!sent.ok) return sent;

  await supabase
    .from("inquiries")
    .update({
      payment_link_sent_at: new Date().toISOString(),
      payment_link_sent_count:
        ((inquiry.payment_link_sent_count as number | null) ?? 0) + 1,
    })
    .eq("id", inquiry.id);

  revalidatePath("/admin/inquiries");
  return { ok: true };
}
