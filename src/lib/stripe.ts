/**
 * Stripe server client. If STRIPE_SECRET_KEY is absent, getStripe() returns
 * null and the deposit route responds "not configured" so the page degrades
 * gracefully instead of crashing.
 */

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!KEY) return null;
  if (client) return client;
  client = new Stripe(KEY);
  return client;
}
