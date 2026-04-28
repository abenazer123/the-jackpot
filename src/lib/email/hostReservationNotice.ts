/**
 * Host reservation-notice email — fires when a friend taps
 * "Reserve my stay" on the trip portal and leaves their name +
 * email. NOT the same as the booker's confirmation; this is a
 * "your friend X just signed on" signal so Abe can manually loop
 * them into the split-pay or coordinate logistics.
 *
 * Idempotency is handled at the row level: the (inquiry_id,
 * viewer_id) primary key on trip_reservations means a friend
 * updating their reservation overwrites the previous row, but the
 * email fires fresh each time. Volume is naturally low (maybe
 * 5-10 friends per inquiry).
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "../resend";
import { firstName, formatIsoDate } from "./types";

export interface ReservationNoticeContext {
  /** The booker — whose trip this is. */
  bookerName: string;
  bookerEmail: string;
  arrival: string;
  departure: string;
  nights: number;
  /** The friend who just reserved. */
  friendName: string;
  friendEmail: string;
  /** Public trip URL — Abe can click to see the same page the
   *  group is looking at. */
  tripUrl: string;
}

function subjectFor(ctx: ReservationNoticeContext): string {
  const dates = `${formatIsoDate(ctx.arrival)} \u2192 ${formatIsoDate(ctx.departure)}`;
  return `\u{1F389} ${firstName(ctx.friendName)} reserved a spot on ${firstName(ctx.bookerName)}\u2019s trip \u00B7 ${dates}`;
}

function renderHtml(ctx: ReservationNoticeContext): string {
  const dates = `${formatIsoDate(ctx.arrival)} \u2192 ${formatIsoDate(ctx.departure)} \u00B7 ${ctx.nights} night${ctx.nights === 1 ? "" : "s"}`;

  const rows: Array<[string, string]> = [
    ["Trip", `${firstName(ctx.bookerName)}\u2019s group \u00B7 ${dates}`],
    ["Friend", ctx.friendName],
    [
      "Friend email",
      `<a href="mailto:${ctx.friendEmail}" style="color:#c49025;text-decoration:none">${ctx.friendEmail}</a>`,
    ],
    [
      "Booker",
      `${ctx.bookerName} \u00B7 <a href="mailto:${ctx.bookerEmail}" style="color:#c49025;text-decoration:none">${ctx.bookerEmail}</a>`,
    ],
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0e4cc;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#a08840;width:120px;vertical-align:top;">${k}</td>
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
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;">The Jackpot \u00B7 Friend reserved</div>
          <h1 style="margin:6px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;font-size:22px;line-height:1.3;color:#7a6030;">${ctx.friendName} just reserved a spot on ${firstName(ctx.bookerName)}\u2019s trip.</h1>
        </td></tr>
        <tr><td style="padding:8px 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0e4cc;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <a href="${ctx.tripUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#e8b923,#ff9050);color:#ffffff;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;">See the group page</a>
          <div style="margin-top:16px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;color:#b09860;">Triggered ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendHostReservationNotice(
  ctx: ReservationNoticeContext,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: NOTIFY_EMAIL,
    replyTo: ctx.friendEmail,
    subject: subjectFor(ctx),
    html: renderHtml(ctx),
  });
}
