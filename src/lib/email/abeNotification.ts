/**
 * Abe notification email — fired when the inquiry agent decides Abe
 * should look at a /chat session. Olivia proposes the action; the
 * harness fires this from src/lib/inquiry-agent/tools/notify_abe.ts.
 *
 * The email is the single source of context. Abe should be able to
 * decide what to do without clicking out:
 *   1. Glance-line banner at the top with urgency + reason.
 *   2. Slot summary (name, contact, dates, guest count, occasion,
 *      price response, current objections).
 *   3. Last few transcript messages.
 *   4. Session ID + admin viewer link (placeholder for now).
 *
 * Inline styles only. Brand palette. No dashes anywhere — this is
 * AI-driven copy and the rule applies. Reply-to is set to the guest's
 * email when we have it so Abe can text/email straight back.
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "../resend";

export type AbeNotificationUrgency = "low" | "normal" | "high";

export interface AbeNotificationInput {
  sessionId: string;
  reason: string;
  urgency: AbeNotificationUrgency;
  /** Where Abe can review the full session. Placeholder until the
   *  admin session viewer ships. */
  transcriptUrl: string;
  /** Snapshot of slots from inquiry_session.slots. */
  slots: Record<string, unknown>;
  /** Snapshot of signals from inquiry_session.signals. */
  signals: Record<string, unknown>;
  /** Last N transcript messages (most recent last). */
  recentTranscript: Array<{ role: string; body: string; ts: string }>;
}

const URGENCY_LABEL: Record<AbeNotificationUrgency, { emoji: string; label: string }> = {
  low: { emoji: "🔔", label: "Heads up" },
  normal: { emoji: "🔔", label: "Olivia flagged" },
  high: { emoji: "🚨", label: "Olivia needs you" },
};

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function s(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) {
    const xs = v.map(String).filter(Boolean);
    return xs.length ? xs.join(", ") : null;
  }
  return null;
}

function renderSlotRows(slots: Record<string, unknown>): string {
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: unknown) => {
    const v = s(value);
    if (v) rows.push([label, v]);
  };

  push("Name", slots.name);
  push("Email", slots.email);
  push("Phone", slots.phone);
  push("Dates", slots.arrival && slots.departure ? `${slots.arrival} to ${slots.departure}` : null);
  push("Guests", slots.guest_count);
  push("Occasion", slots.occasion);
  push("Price reaction", slots.price_response);
  push("Date flexibility", slots.date_flexibility);
  push("Decision maker", slots.decision_makers);
  push("Timeline", slots.decision_timeline);
  push("Objections", slots.objections);
  push("Comparing", slots.alternatives_considered);

  return rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:12px;color:#a08840;text-transform:uppercase;letter-spacing:1px;font-weight:500;white-space:nowrap;vertical-align:top;">${escape(label)}</td>
        <td style="padding:6px 0;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:14px;color:#7a6030;">${escape(value)}</td>
      </tr>`,
    )
    .join("");
}

function renderTranscript(
  msgs: AbeNotificationInput["recentTranscript"],
): string {
  if (msgs.length === 0) return "";
  return msgs
    .map((m) => {
      const isOlivia = m.role === "olivia";
      const bg = isOlivia ? "#faf6ef" : "#fbf6ea";
      const align = isOlivia ? "left" : "right";
      const label = isOlivia ? "Olivia" : m.role === "user" ? "Guest" : "System";
      return `
      <div style="margin:8px 0;text-align:${align};">
        <div style="display:inline-block;max-width:80%;text-align:left;padding:10px 14px;background:${bg};border:1px solid #f0e4cc;border-radius:14px;">
          <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:10px;color:#a08840;text-transform:uppercase;letter-spacing:1px;font-weight:500;margin-bottom:4px;">${escape(label)}</div>
          <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:14px;color:#7a6030;line-height:1.5;white-space:pre-wrap;">${escape(m.body)}</div>
        </div>
      </div>`;
    })
    .join("");
}

function renderHtml(p: AbeNotificationInput): string {
  const urgency = URGENCY_LABEL[p.urgency];

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf6ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf6ef;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #f0e4cc;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 32px 0;">
        <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#7a6030;background:#fbf6ea;border:1px solid #f0e4cc;border-radius:10px;padding:14px 18px;">
          ${urgency.emoji} <strong style="font-weight:600;">${urgency.label}.</strong> ${escape(p.reason)}
        </div>
      </td></tr>

      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${renderSlotRows(p.slots)}
        </table>
      </td></tr>

      ${
        p.recentTranscript.length
          ? `<tr><td style="padding:24px 24px 0;">
              <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;color:#a08840;text-transform:uppercase;letter-spacing:1.4px;font-weight:500;margin-bottom:8px;padding:0 8px;">Recent thread</div>
              ${renderTranscript(p.recentTranscript)}
            </td></tr>`
          : ""
      }

      <tr><td style="padding:20px 32px 28px;">
        <a href="${escape(p.transcriptUrl)}" style="display:inline-block;font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;color:#ffffff;background-image:linear-gradient(135deg,#e8b923,#ff9050);text-decoration:none;padding:12px 22px;border-radius:9999px;letter-spacing:0.4px;">Open the full session</a>
        <div style="font-family:'Outfit',Helvetica,Arial,sans-serif;font-size:11px;color:#a08840;margin-top:14px;letter-spacing:0.5px;">Session: ${escape(p.sessionId)}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function renderText(p: AbeNotificationInput): string {
  const urgency = URGENCY_LABEL[p.urgency];
  const slotLines = Object.entries(p.slots)
    .filter(([, v]) => s(v))
    .map(([k, v]) => `${k}: ${s(v)}`)
    .join("\n");
  const thread = p.recentTranscript
    .map((m) => `${m.role.toUpperCase()}: ${m.body}`)
    .join("\n\n");
  return [
    `${urgency.emoji} ${urgency.label}. ${p.reason}`,
    "",
    slotLines,
    "",
    thread ? "RECENT THREAD" : "",
    thread,
    "",
    `Session: ${p.sessionId}`,
    `Full view: ${p.transcriptUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendAbeNotification(
  input: AbeNotificationInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_not_configured" };

  const urgency = URGENCY_LABEL[input.urgency];
  const subjectGist = input.reason.length > 80 ? input.reason.slice(0, 77) + "…" : input.reason;
  const subject = `${urgency.emoji} ${urgency.label}: ${subjectGist}`;
  const replyTo = (s(input.slots.email) ?? "").toString();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
      html: renderHtml(input),
      text: renderText(input),
      ...(replyTo ? { replyTo: [replyTo] } : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
