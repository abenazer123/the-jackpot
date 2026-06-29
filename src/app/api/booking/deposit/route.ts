/**
 * POST /api/booking/deposit — creates the deposit PaymentIntent for a
 * booking. $500, USD, with setup_future_usage=off_session so the same card
 * is saved for the later milestone payments and the security hold. Returns
 * the client secret for Stripe Elements to confirm on the page. The card
 * itself never touches our server.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { DEPOSIT_NOW_USD } from "@/lib/booking/agreement";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().regex(/^[0-9A-Za-z_-]{22}$/),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

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
  const { token } = parsed.data;

  const supabase = supabaseServer();
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id, name, email, stripe_customer_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!inquiry) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 });
  }

  try {
    // Reuse the guest's Stripe customer, or create one, so the card is
    // saved and can be charged off-session for the later payments + hold.
    let customerId = (inquiry.stripe_customer_id as string | null) ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (inquiry.email as string | null) ?? undefined,
        name: (inquiry.name as string | null) ?? undefined,
        metadata: { inquiry_id: String(inquiry.id), share_token: token },
      });
      customerId = customer.id;
      await supabase
        .from("inquiries")
        .update({ stripe_customer_id: customerId })
        .eq("id", inquiry.id);
    }

    // Live webhook smoke test: an inquiry under Abe's own email charges the
    // Stripe USD minimum (50 cents) so the live path can be verified with a
    // real card and refunded. Every real guest charges the full deposit.
    const isLiveTest =
      (inquiry.email as string | null)?.toLowerCase() === "abenazer101@gmail.com";
    const amountCents = isLiveTest ? 50 : DEPOSIT_NOW_USD * 100;

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      // Card only, so the saved method can be charged off-session later.
      payment_method_types: ["card"],
      setup_future_usage: "off_session",
      description: `The Jackpot deposit for ${(inquiry.name as string) ?? "guest"}`,
      receipt_email: (inquiry.email as string | null) ?? undefined,
      metadata: {
        share_token: token,
        inquiry_id: String(inquiry.id),
        purpose: "deposit",
      },
    });
    return NextResponse.json({ ok: true, clientSecret: intent.client_secret });
  } catch (err) {
    console.error("[booking/deposit] create failed", err);
    return NextResponse.json({ ok: false, error: "intent_failed" }, { status: 500 });
  }
}
