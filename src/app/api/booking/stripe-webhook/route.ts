/**
 * POST /api/booking/stripe-webhook — Stripe's server-to-server confirmation.
 *
 * The source of truth for a deposit, independent of the guest's browser. On
 * payment_intent.succeeded we mark the matching signed agreement deposit_paid
 * and store the saved card (idempotent). If a payment ever lands with no
 * recorded agreement (browser dropped before signing), we alert Abe so he
 * can follow up, because the webhook alone can't reconstruct the signature.
 *
 * Hook up: STRIPE_WEBHOOK_SECRET in env. Local: `stripe listen --forward-to
 * localhost:3000/api/booking/stripe-webhook`. Prod: a Dashboard endpoint at
 * the deployed URL.
 */

import { NextResponse, type NextRequest } from "next/server";

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "@/lib/resend";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!stripe || !secret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  if (!sig) {
    return NextResponse.json({ ok: false, error: "no_signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const token = pi.metadata?.share_token;
    const purpose = pi.metadata?.purpose;
    if (token && purpose === "deposit") {
      const supabase = supabaseServer();
      const { data: rows } = await supabase
        .from("booking_agreements")
        .select("id, status, stripe_payment_method_id")
        .eq("share_token", token)
        .order("id", { ascending: false })
        .limit(1);
      const row = rows?.[0];

      if (row) {
        // Reconcile: mark paid + store the saved card (idempotent).
        await supabase
          .from("booking_agreements")
          .update({
            status: "deposit_paid",
            deposit_payment_ref: pi.id,
            stripe_payment_method_id:
              row.stripe_payment_method_id ??
              (typeof pi.payment_method === "string" ? pi.payment_method : null),
          })
          .eq("id", row.id);
      } else {
        // Paid, but no signed agreement on record. Alert Abe to follow up.
        console.warn("[stripe-webhook] deposit paid with no agreement row:", token);
        const resend = getResend();
        if (resend) {
          await resend.emails
            .send({
              from: FROM_EMAIL,
              to: [NOTIFY_EMAIL],
              subject: "Deposit paid with no signed agreement on file",
              html: `<p>A $${Math.round(pi.amount / 100)} deposit succeeded (token ${token}, ${pi.id}) but no signed agreement was recorded. The guest's browser may have dropped after the charge. Follow up to capture the signature.</p>`,
            })
            .catch((e) => console.warn("[stripe-webhook] alert failed", e));
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
