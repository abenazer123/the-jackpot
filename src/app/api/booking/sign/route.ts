/**
 * POST /api/booking/sign — records a signed booking agreement.
 *
 * The self-built e-signature record: validates that all required
 * acknowledgments are checked + a signature is present, re-derives the
 * agreement hash server-side (never trusts the client), captures IP +
 * user-agent, and writes one append-only row to `booking_agreements`. Then
 * emails a certificate copy to the guest + Abe. Valid under ESIGN/UETA.
 *
 * The deposit (Stripe) is a separate, later step; this records the
 * signature so the booking has a legal record even before the charge.
 */

import { createHash, randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  ACKNOWLEDGMENTS,
  AGREEMENT_VERSION,
  BUSINESS,
  REQUIRED_ACK_IDS,
  STAY,
  agreementCanonicalText,
  planAmountCents,
  planLabel,
} from "@/lib/booking/agreement";
import { buildAgreementPdf } from "@/lib/booking/agreementPdf";
import { sendBookingCertificate } from "@/lib/email/bookingCertificate";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase-server";

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
function isoLong(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().regex(/^[0-9A-Za-z_-]{22}$/),
  signatureName: z
    .string()
    .min(2)
    .max(120)
    .refine((s) => s.trim().split(/\s+/).filter(Boolean).length >= 2, {
      message: "first_and_last_name_required",
    }),
  ackIds: z.array(z.string()).min(1),
  idDocumentPath: z.string().min(1).max(300),
  depositPaymentRef: z.string().min(1).max(120).optional(),
  plan: z.enum(["reserve", "half", "full"]).default("reserve"),
});

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const { token, signatureName, ackIds, idDocumentPath, depositPaymentRef, plan } =
    parsed.data;

  // Every required acknowledgment must be present.
  const checked = new Set(ackIds);
  const missing = REQUIRED_ACK_IDS.filter((id) => !checked.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "incomplete_acknowledgments" },
      { status: 400 },
    );
  }

  const supabase = supabaseServer();

  // Bind to the inquiry this token belongs to.
  const { data: inquiry, error: fetchErr } = await supabase
    .from("inquiries")
    .select("id, name, email, arrival, departure, guests, quote_total_cents")
    .eq("share_token", token)
    .maybeSingle();
  if (fetchErr || !inquiry) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 });
  }

  // Authoritative hash of the exact agreement text (server-derived).
  const agreementHash = createHash("sha256")
    .update(agreementCanonicalText())
    .digest("hex");

  const acks = ACKNOWLEDGMENTS.filter((a) => checked.has(a.id)).map((a) => ({
    id: a.id,
    label: `${a.lead} ${a.rest}`,
  }));

  const signedAtIso = new Date().toISOString();
  // Amount paid today is derived from the chosen plan + the real total, the
  // same way the deposit PaymentIntent computed it.
  const total = (inquiry.quote_total_cents as number | null) ?? 0;
  const depositCents = planAmountCents(total, plan);
  // The main guest of record is whoever signs, by their full legal name,
  // not the friendly first name the chat captured (e.g. "Kat").
  const guestName = signatureName;

  const bookingLines: Array<{ k: string; v: string }> = [
    { k: "Guest", v: guestName },
    { k: "Property", v: `The Jackpot, ${BUSINESS.address}` },
    {
      k: "Dates",
      v: `${isoLong(inquiry.arrival as string)} to ${isoLong(inquiry.departure as string)}`,
    },
    { k: "Check in", v: `${STAY.checkIn} (${STAY.checkInNote})` },
    { k: "Check out", v: `${STAY.checkOut} (${STAY.checkOutNote})` },
    { k: "Guests", v: `${(inquiry.guests as number) ?? STAY.maxGuests} max` },
    { k: "Payment plan", v: planLabel(plan) },
    { k: "Paid today", v: usd(depositCents) },
  ];
  if (inquiry.quote_total_cents) {
    bookingLines.push({ k: "Weekend total", v: usd(inquiry.quote_total_cents as number) });
  }

  // Generate + privately store the signed-agreement PDF. Best-effort: a
  // failure here never blocks recording the signature.
  let pdfBytes: Uint8Array | null = null;
  let pdfPath: string | null = null;
  try {
    pdfBytes = await buildAgreementPdf({
      guestName,
      signatureName,
      signedAtIso,
      ip: clientIp(req),
      agreementVersion: AGREEMENT_VERSION,
      agreementHash,
      acks,
      bookingLines,
      idOnFile: true,
    });
    pdfPath = `${token}/agreement-${randomUUID()}.pdf`;
    const up = await supabase.storage
      .from("booking-ids")
      .upload(pdfPath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: false,
      });
    if (up.error) {
      console.error("[booking/sign] pdf upload failed", up.error.message);
      pdfPath = null;
    }
  } catch (e) {
    console.error("[booking/sign] pdf generation failed", e);
    pdfBytes = null;
    pdfPath = null;
  }

  const { data: row, error: insertErr } = await supabase
    .from("booking_agreements")
    .insert({
      inquiry_id: inquiry.id,
      share_token: token,
      guest_name: signatureName,
      signature_name: signatureName,
      agreement_version: AGREEMENT_VERSION,
      agreement_hash: agreementHash,
      acknowledgments: acks,
      signed_at: signedAtIso,
      ip: clientIp(req),
      user_agent: req.headers.get("user-agent"),
      id_document_path: idDocumentPath,
      payment_plan: plan,
      deposit_amount_cents: depositCents,
      deposit_payment_ref: depositPaymentRef ?? null,
      status: depositPaymentRef ? "deposit_paid" : "signed",
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[booking/sign] insert failed", insertErr);
    return NextResponse.json({ ok: false, error: "record_failed" }, { status: 500 });
  }

  // Back-fill the PDF path (best effort; no-ops gracefully if the column
  // migration has not been applied yet).
  if (pdfPath) {
    const { error: pdfColErr } = await supabase
      .from("booking_agreements")
      .update({ agreement_pdf_path: pdfPath })
      .eq("id", row.id);
    if (pdfColErr) console.warn("[booking/sign] pdf path not stored:", pdfColErr.message);
  }

  // Capture the saved card (payment method) for the later milestone charges
  // + hold. Best-effort; the webhook also reconciles this.
  if (depositPaymentRef) {
    try {
      const stripe = getStripe();
      if (stripe) {
        const pi = await stripe.paymentIntents.retrieve(depositPaymentRef);
        const pm = typeof pi.payment_method === "string" ? pi.payment_method : null;
        if (pm) {
          await supabase
            .from("booking_agreements")
            .update({ stripe_payment_method_id: pm })
            .eq("id", row.id);
        }
      }
    } catch (e) {
      console.warn("[booking/sign] could not capture payment method", e);
    }
  }

  // The chat only captured a first name; the signature is her full legal
  // name. Promote it onto the lead so the record is complete (best effort).
  await supabase
    .from("inquiries")
    .update({ name: signatureName })
    .eq("id", inquiry.id);

  // Certificate copy + signed PDF to guest + Abe (best effort).
  await sendBookingCertificate({
    guestEmail: (inquiry.email as string | null) ?? null,
    guestName,
    signatureName,
    agreementVersion: AGREEMENT_VERSION,
    agreementHash,
    acknowledgments: acks,
    signedAtIso,
    ip: clientIp(req),
    depositAmountCents: depositCents,
    depositPaymentRef: depositPaymentRef ?? null,
    bookingLines,
    idOnFile: true,
    pdfBase64: pdfBytes ? Buffer.from(pdfBytes).toString("base64") : null,
  });

  return NextResponse.json({ ok: true, id: row.id });
}
