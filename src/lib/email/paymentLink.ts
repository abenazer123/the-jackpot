/**
 * Payment-link email — sent from the admin (per inquiry) to invite a guest
 * to secure their dates on the /confirm/[token] page. Abe writes a short
 * personal note + subject; the summary card, the secure button, and the
 * signature are templated so every send stays on brand and links correctly.
 *
 * Inline styles only (email-client safe). Brand voice: no dashes anywhere.
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "../resend";
import { firstName, formatIsoDate } from "./types";

export interface PaymentLinkEmailInput {
  to: string;
  guestName: string;
  subject: string;
  /** Abe's personal note, plain text (newlines become line breaks). */
  note: string;
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  nights: number;
  guests: number;
  totalCents: number;
  confirmUrl: string;
  depositUsd: number;
  halfCents: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Whole dollars stay clean ($3,771); a half payment keeps its cents. */
function money(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function noteToHtml(note: string): string {
  return esc(note.trim())
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 12px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:300;font-size:15px;line-height:1.6;color:#7a6030;">${para.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function renderHtml(p: PaymentLinkEmailInput): string {
  const optionsLine = `Secure checkout. You choose how much to pay today: reserve for ${money(
    p.depositUsd * 100,
  )}, pay half (${money(p.halfCents)}), or pay in full (${money(p.totalCents)}).`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf6ef;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:36px 36px 4px;text-align:center;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:14px;letter-spacing:3.6px;text-transform:uppercase;color:#c49025;">The Jackpot</div>
        </td></tr>
        <tr><td style="padding:16px 36px 8px;text-align:center;">
          <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;font-size:28px;line-height:1.2;color:#7a6030;">Your weekend is ready, ${esc(firstName(p.guestName))}.</h1>
        </td></tr>
        <tr><td style="padding:18px 36px 0;">
          ${noteToHtml(p.note)}
        </td></tr>
        <tr><td style="padding:14px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;border-radius:12px;padding:20px 22px;">
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;padding-bottom:4px;">Dates</td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:15px;color:#7a6030;padding-bottom:14px;">
              ${formatIsoDate(p.arrival)} to ${formatIsoDate(p.departure)}
              <span style="color:#b09860;"> &middot; ${p.nights} night${p.nights === 1 ? "" : "s"}</span>
            </td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;padding-bottom:4px;">Guests</td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:15px;color:#7a6030;padding-bottom:14px;">
              ${p.guests} ${p.guests === 1 ? "guest" : "guests"}
            </td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;padding-bottom:4px;">Weekend total</td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:15px;color:#7a6030;">
              ${money(p.totalCents)} <span style="color:#b09860;">all inclusive</span>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:26px 36px 0;text-align:center;">
          <a href="${esc(p.confirmUrl)}" style="display:inline-block;padding:14px 30px;background:#c49025;color:#ffffff;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:600;font-size:15px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;">Reserve your dates &rarr;</a>
        </td></tr>
        <tr><td style="padding:14px 40px 0;text-align:center;">
          <p style="margin:0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:300;font-size:12.5px;line-height:1.55;color:#a08840;">${optionsLine}</p>
        </td></tr>
        <tr><td style="padding:26px 36px 0;text-align:center;">
          <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:17px;color:#7a6030;">Abe</p>
          <p style="margin:4px 0 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:300;font-size:11px;letter-spacing:1.6px;color:#a08840;text-transform:uppercase;">Your host &middot; The Jackpot, Chicago</p>
        </td></tr>
        <tr><td style="padding:24px 36px 36px;text-align:center;">
          <p style="margin:0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#b09860;">Reply to this email anytime with questions. Your dates are held while you decide.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Sends the payment-link email. Skips obvious test addresses. Returns a
 *  result so the admin can show success or the reason it did not send. */
export async function sendPaymentLinkEmail(
  p: PaymentLinkEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "email_not_configured" };
  if (/@example\.(com|org|net)$/i.test(p.to)) {
    return { ok: false, error: "test_email_skipped" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: p.to,
      bcc: [NOTIFY_EMAIL],
      subject: p.subject,
      html: renderHtml(p),
    });
    if (error) return { ok: false, error: error.message ?? "send_failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}
