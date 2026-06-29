/**
 * Booking signature certificate email. Sent to the guest and to Abe on a
 * signed agreement, the mutual contemporaneous record of what was agreed,
 * by whom, when, and the SHA-256 of the exact terms. Mirrors the
 * guestConfirmation email pattern; no-ops if Resend is not configured.
 */

import { FROM_EMAIL, NOTIFY_EMAIL, getResend } from "@/lib/resend";

export interface BookingCertificatePayload {
  guestEmail: string | null;
  guestName: string;
  signatureName: string;
  agreementVersion: string;
  agreementHash: string;
  acknowledgments: ReadonlyArray<{ id: string; label: string }>;
  signedAtIso: string;
  ip?: string | null;
  depositAmountCents?: number | null;
  depositPaymentRef?: string | null;
  bookingLines?: ReadonlyArray<{ k: string; v: string }>;
  idOnFile?: boolean;
  /** base64 of the signed-agreement PDF, attached when present. */
  pdfBase64?: string | null;
}

/** Placeholder/test addresses we must never actually email. */
function isTestEmail(email: string | null): boolean {
  return !!email && /@example\.(com|org|net)$/i.test(email);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendBookingCertificate(
  p: BookingCertificatePayload,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false, skipped: true };

  const when = new Date(p.signedAtIso).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const deposit =
    p.depositAmountCents != null
      ? `$${Math.round(p.depositAmountCents / 100).toLocaleString("en-US")}`
      : "pending";

  const acks = p.acknowledgments
    .map((a) => `<li style="margin:0 0 6px">${esc(a.label)}</li>`)
    .join("");

  const bookingRows = (p.bookingLines ?? [])
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;color:#9a8456">${esc(r.k)}</td><td style="padding:6px 0;text-align:right">${esc(r.v)}</td></tr>`,
    )
    .join("");

  const html = `
  <div style="font-family:Helvetica,Arial,sans-serif;color:#5a4420;max-width:560px;margin:0 auto;padding:24px;background:#faf6ef">
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#5a4420;margin:0 0 6px">Signed agreement on file</h1>
    <p style="color:#7a6030;margin:0 0 18px">A copy of your signed Jackpot agreement, for your records. The full signed document is attached as a PDF.</p>
    <table style="width:100%;font-size:14px;color:#5a4420;border-collapse:collapse">
      ${bookingRows}
      <tr><td style="padding:6px 0;color:#9a8456">Signed by</td><td style="padding:6px 0;text-align:right">${esc(p.signatureName)}</td></tr>
      <tr><td style="padding:6px 0;color:#9a8456">Signed at</td><td style="padding:6px 0;text-align:right">${esc(when)}</td></tr>
      <tr><td style="padding:6px 0;color:#9a8456">Deposit</td><td style="padding:6px 0;text-align:right">${deposit}${p.depositPaymentRef ? " (paid)" : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#9a8456">Photo ID on file</td><td style="padding:6px 0;text-align:right">${p.idOnFile ? "Yes" : "No"}</td></tr>
      <tr><td style="padding:6px 0;color:#9a8456">Agreement version</td><td style="padding:6px 0;text-align:right">${esc(p.agreementVersion)}</td></tr>
      ${p.ip ? `<tr><td style="padding:6px 0;color:#9a8456">Signed from</td><td style="padding:6px 0;text-align:right">${esc(p.ip)}</td></tr>` : ""}
      ${p.depositPaymentRef ? `<tr><td style="padding:6px 0;color:#9a8456">Payment ref</td><td style="padding:6px 0;text-align:right">${esc(p.depositPaymentRef)}</td></tr>` : ""}
    </table>
    <p style="font-size:12px;color:#9a8456;margin:16px 0 6px">You acknowledged:</p>
    <ul style="font-size:13px;color:#6b5a3a;padding-left:18px;margin:0 0 16px">${acks}</ul>
    <p style="font-size:11px;color:#9a8456;word-break:break-all;border-top:1px solid #e7ddd2;padding-top:12px">
      Document fingerprint (SHA-256): ${esc(p.agreementHash)}
    </p>
  </div>`;

  // Always send Abe his copy; only email the guest when it is a real
  // address (never the @example.com placeholder used while testing).
  const to = [NOTIFY_EMAIL];
  if (p.guestEmail && !isTestEmail(p.guestEmail)) {
    to.push(p.guestEmail);
  } else if (isTestEmail(p.guestEmail ?? null)) {
    console.warn("[booking-certificate] guest email skipped (test address):", p.guestEmail);
  }

  const attachments = p.pdfBase64
    ? [{ filename: "jackpot-signed-agreement.pdf", content: p.pdfBase64 }]
    : undefined;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Signed agreement on file, ${p.guestName}`,
      html,
      attachments,
    });
    return { ok: true };
  } catch (err) {
    console.warn("[booking-certificate] send failed:", err);
    return { ok: false };
  }
}
