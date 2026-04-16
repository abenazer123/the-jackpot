/**
 * Resend SDK singleton. If RESEND_API_KEY is absent, `getResend()` returns
 * null and the email send helpers no-op — the API route keeps working.
 */

import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;

let client: Resend | null = null;

export function getResend(): Resend | null {
  if (!API_KEY) return null;
  if (client) return client;
  client = new Resend(API_KEY);
  return client;
}

/** Sandbox default; swap to bookings@thejackpotchi.com once the domain is
 *  verified in Resend. */
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ??
  "The Jackpot <onboarding@resend.dev>";

/** Abe's inbox. */
export const NOTIFY_EMAIL =
  process.env.NOTIFY_EMAIL ?? "abenazer101@gmail.com";
