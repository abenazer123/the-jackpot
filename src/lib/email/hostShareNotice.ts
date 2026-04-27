/**
 * Host share-notice email — fires once when the booker taps
 * "Share with my group" on the quote screen. Idempotent: gated
 * server-side on `inquiries.share_email_sent_at` so re-opening
 * the preview sheet doesn't re-fire.
 *
 * The share itself is a strong intent signal — coordinators who
 * share are more likely to convert than those who just tap "Hold
 * my dates". This email is Abe's heads-up to start watching the
 * inquiry actively.
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "../resend";
import { firstName, formatIsoDate, type InquiryPayload } from "./types";

export interface ShareNoticeContext extends InquiryPayload {
  /** Public trip URL the recipient is sharing. */
  tripUrl: string;
  /** Total stay cost in cents from the quote_snapshot, when available. */
  totalCents?: number | null;
  /** View count at send-time. Usually 0 (the email fires immediately
   *  on share-CTA tap); can be > 0 if Abe's email checks lag. */
  viewCount: number;
}

function fmtTotal(cents?: number | null): string {
  if (cents == null) return "";
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function subjectFor(ctx: ShareNoticeContext): string {
  const total = fmtTotal(ctx.totalCents);
  return `\u{1F4E8} ${firstName(ctx.name)} just shared their trip page${total ? ` \u00B7 ${total}` : ""}`;
}

function renderHtml(ctx: ShareNoticeContext): string {
  const total = fmtTotal(ctx.totalCents);
  const dates = `${formatIsoDate(ctx.arrival)} \u2192 ${formatIsoDate(ctx.departure)} \u00B7 ${ctx.nights} night${ctx.nights === 1 ? "" : "s"}`;
  const headline = `${ctx.name} just sent the trip link to their group.`;
  const viewLine =
    ctx.viewCount > 0
      ? `Already viewed ${ctx.viewCount} time${ctx.viewCount === 1 ? "" : "s"}.`
      : "Views will roll in as the group taps the link.";

  const rows: Array<[string, string]> = [
    ["Dates", dates],
    ["Guests", String(ctx.guests)],
    ["Occasion", ctx.reason],
    ["Phone", `<a href="tel:${ctx.phone}" style="color:#c49025;text-decoration:none">${ctx.phone}</a>`],
    ["Email", `<a href="mailto:${ctx.email}" style="color:#c49025;text-decoration:none">${ctx.email}</a>`],
    ...(total ? [["Quoted total", total] as [string, string]] : []),
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0e4cc;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#a08840;width:110px;vertical-align:top;">${k}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0e4cc;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:14px;color:#7a6030;">${v}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf6ef;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:28px 32px 12px;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;">The Jackpot \u00B7 Trip page shared</div>
          <h1 style="margin:6px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;font-size:22px;line-height:1.3;color:#7a6030;">${headline}</h1>
          <p style="margin:8px 0 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:13px;color:#a08840;font-style:italic;">${viewLine}</p>
        </td></tr>
        <tr><td style="padding:8px 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0e4cc;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <a href="${ctx.tripUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#e8b923,#ff9050);color:#ffffff;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;">See what the group sees</a>
          <div style="margin-top:16px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;color:#b09860;">Triggered ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendHostShareNotice(
  ctx: ShareNoticeContext,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: NOTIFY_EMAIL,
    replyTo: ctx.email,
    subject: subjectFor(ctx),
    html: renderHtml(ctx),
  });
}
