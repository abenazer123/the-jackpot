/**
 * Host signal email — fires when a visitor takes a specific reaction
 * path on the Quote Reveal success screen ("Hold my dates" or
 * "Tell me what works"). The first-touch hostNotification email
 * already went out when they submitted Step 3; this is a smaller
 * follow-up that tells Abe "they just took action — go reach out."
 *
 * Glance-line subject is the whole point: Abe should see what
 * happened without opening the email. Body carries just enough to
 * action it (name, phone, dates, total, appeal context if any).
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "../resend";
import { formatIsoDate, type InquiryPayload } from "./types";

export type SignalPath = "interested" | "appeal";

export interface PathSignalContext extends InquiryPayload {
  path: SignalPath;
  /** Total in cents from the quote snapshot, when available. */
  totalCents?: number | null;
  /** Appeal-only — how far off the price was. */
  stretchLevel?: "close" | "far" | null;
  /** Appeal-only — visitor's free-text "what would work". */
  appealText?: string | null;
}

function formatTotal(cents?: number | null): string {
  if (cents == null) return "";
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function subjectFor(ctx: PathSignalContext): string {
  const total = formatTotal(ctx.totalCents);
  const dates = `${formatIsoDate(ctx.arrival)} \u2192 ${formatIsoDate(ctx.departure)}`;
  if (ctx.path === "interested") {
    return `\u{1F7E2} ${ctx.name} wants to hold ${dates}${total ? ` \u00B7 ${total}` : ""}`;
  }
  // appeal
  const stretch = ctx.stretchLevel === "far" ? "pretty far off" : "close";
  return `\u{1F7E1} ${ctx.name} needs flex (${stretch})${total ? ` \u00B7 ${total}` : ""}`;
}

function renderHtml(ctx: PathSignalContext): string {
  const total = formatTotal(ctx.totalCents);
  const dates = `${formatIsoDate(ctx.arrival)} \u2192 ${formatIsoDate(ctx.departure)}  \u00B7  ${ctx.nights} night${ctx.nights === 1 ? "" : "s"}`;

  const headline =
    ctx.path === "interested"
      ? `${ctx.name} tapped <strong>Hold my dates</strong>.`
      : `${ctx.name} sent an appeal \u2014 <strong>${ctx.stretchLevel === "far" ? "pretty far off" : "close"}</strong>.`;

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

  const appealBlock =
    ctx.path === "appeal" && ctx.appealText
      ? `
        <tr><td style="padding:16px 32px 4px;">
          <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#a08840;margin-bottom:6px;">What would work</div>
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16px;line-height:1.5;color:#7a6030;background:#fbf6ea;border-left:3px solid #d4a930;padding:12px 16px;border-radius:6px;">${escapeHtml(ctx.appealText)}</div>
        </td></tr>`
      : "";

  const eyebrow =
    ctx.path === "interested"
      ? "The Jackpot \u00B7 Hold-my-dates signal"
      : "The Jackpot \u00B7 Appeal received";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf6ef;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:28px 32px 12px;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#a08840;">${eyebrow}</div>
          <h1 style="margin:6px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;font-size:22px;line-height:1.3;color:#7a6030;">${headline}</h1>
        </td></tr>
        ${appealBlock}
        <tr><td style="padding:8px 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0e4cc;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <a href="tel:${ctx.phone}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#e8b923,#ff9050);color:#ffffff;font-family:'Outfit',Helvetica,Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:0.4px;text-decoration:none;border-radius:999px;">Call ${ctx.name.split(" ")[0]}</a>
          <div style="margin-top:16px;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;color:#b09860;">Triggered ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendHostPathSignal(ctx: PathSignalContext): Promise<void> {
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
