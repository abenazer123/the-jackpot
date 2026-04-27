/**
 * Guest confirmation email — warm "we got your request" note sent to the
 * person who submitted the form. Inline styles only (email-client safe).
 */

import { FROM_EMAIL, getResend } from "../resend";
import { firstName, formatIsoDate, type InquiryPayload } from "./types";

function renderHtml(p: InquiryPayload): string {
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
          <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;font-size:28px;line-height:1.2;color:#7a6030;">Thanks, ${firstName(p.name)}.</h1>
        </td></tr>
        <tr><td style="padding:12px 36px 0;text-align:center;">
          <p style="margin:0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:300;font-size:15px;line-height:1.6;color:#7a6030;">
            We got your request. Here&rsquo;s your trip page &mdash; share it with your group whenever you&rsquo;re ready. Abe will be in touch personally.
          </p>
        </td></tr>
        ${p.tripUrl
          ? `
        <tr><td style="padding:24px 36px 0;text-align:center;">
          <a href="${p.tripUrl}" style="display:inline-block;padding:13px 26px;background:#c49025;color:#ffffff;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;">View your trip page &rarr;</a>
        </td></tr>`
          : ""}
        <tr><td style="padding:28px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;border-radius:12px;padding:20px 22px;">
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;padding-bottom:4px;">Dates</td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:15px;color:#7a6030;padding-bottom:14px;">
              ${formatIsoDate(p.arrival)} &rarr; ${formatIsoDate(p.departure)}
              <span style="color:#b09860;"> &middot; ${p.nights} night${p.nights === 1 ? "" : "s"}</span>
            </td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;padding-bottom:4px;">Guests</td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:15px;color:#7a6030;padding-bottom:14px;">
              ${p.guests} ${p.guests === 1 ? "guest" : "guests"}
            </td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;padding-bottom:4px;">Occasion</td></tr>
            <tr><td style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:15px;color:#7a6030;">
              ${p.reason}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 36px 0;text-align:center;">
          <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:17px;color:#7a6030;">&mdash; Abe</p>
          <p style="margin:4px 0 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:300;font-size:11px;letter-spacing:1.6px;color:#a08840;text-transform:uppercase;">Your host &middot; The Jackpot, Chicago</p>
        </td></tr>
        <tr><td style="padding:28px 36px 36px;text-align:center;">
          <a href="https://thejackpotchi.com" style="display:inline-block;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;color:#c49025;text-decoration:none;border-bottom:1px solid rgba(212,169,48,0.35);padding-bottom:2px;">Keep exploring &rarr;</a>
        </td></tr>
      </table>
      <div style="max-width:520px;margin:16px auto 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:1.2px;color:#b09860;text-align:center;">
        You&rsquo;re receiving this because you submitted an inquiry at thejackpotchi.com.
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendGuestConfirmation(p: InquiryPayload): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: p.email,
    subject: "We got your request — Abe will be in touch",
    html: renderHtml(p),
  });
}
