/**
 * Host notification email — sent to Abe when a new inquiry comes in.
 * Reply-to is set to the guest's email so hitting "Reply" in the inbox
 * goes straight back to them.
 *
 * Inline styles only (email clients strip <style> tags inconsistently).
 * Palette stays in the brand family — warm gold, olive, linen.
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "../resend";
import { channelLabel } from "./channelLabel";
import { formatIsoDate, type InquiryPayload } from "./types";

function renderHtml(p: InquiryPayload): string {
  const rows: Array<[string, string]> = [
    ["Dates", `${formatIsoDate(p.arrival)} → ${formatIsoDate(p.departure)}  ·  ${p.nights} night${p.nights === 1 ? "" : "s"}`],
    ["Guests", String(p.guests)],
    ["Occasion", p.reason],
    ...(p.venue ? [["Venue", p.venue] as [string, string]] : []),
    ["Name", p.name],
    ["Email", `<a href="mailto:${p.email}" style="color:#c49025;text-decoration:none">${p.email}</a>`],
    ["Phone", `<a href="tel:${p.phone}" style="color:#c49025;text-decoration:none">${p.phone}</a>`],
    ...(p.source ? [["Source", p.source] as [string, string]] : []),
  ];

  // Glance-line banner: "📍 This lead came from: {channel} ({campaign})".
  // Only rendered when we have a UTM source. No banner = direct traffic.
  const channel = channelLabel(
    p.attribution?.utm_source,
    p.attribution?.utm_medium,
  );
  const campaign = p.attribution?.utm_campaign;
  const bannerHtml = channel
    ? `
    <tr><td style="padding:0 32px 4px;">
      <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#7a6030;background:#fbf6ea;border:1px solid #f0e4cc;border-radius:10px;padding:12px 16px;">
        📍 <strong style="font-weight:600;">This lead came from: ${channel}</strong>${campaign ? ` <span style="font-style:italic;color:#a08840;">(${campaign})</span>` : ""}
      </div>
    </td></tr>`
    : "";

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
        <tr><td style="padding:28px 32px 20px;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;">The Jackpot · New Inquiry</div>
          <h1 style="margin:6px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;font-size:24px;line-height:1.2;color:#7a6030;">${p.name} · ${p.nights} night${p.nights === 1 ? "" : "s"} · ${p.reason}</h1>
        </td></tr>
        ${bannerHtml}
        <tr><td style="padding:0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0e4cc;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <a href="mailto:${p.email}?subject=${encodeURIComponent("Your Jackpot pricing guide")}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#e8b923,#ff9050);color:#ffffff;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;">Reply to ${p.name.split(" ")[0]}</a>
          <div style="margin-top:16px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;color:#b09860;">Submitted ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendHostNotification(p: InquiryPayload): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: NOTIFY_EMAIL,
    replyTo: p.email,
    subject: `New inquiry · ${p.name} · ${p.nights} night${p.nights === 1 ? "" : "s"} · ${p.reason}`,
    html: renderHtml(p),
  });
}
