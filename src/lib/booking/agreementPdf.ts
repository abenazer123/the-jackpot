/**
 * Builds the signed-agreement PDF: the full Jackpot rental agreement + the
 * booking summary, the guest's acknowledgments, the typed signature with
 * date + IP, an "ID on file" note, and the document fingerprint. Generated
 * server-side with pdf-lib (no headless browser), stored privately, and
 * attached to the certificate email. This is the openable signed document.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { AGREEMENT_SECTIONS } from "./agreement";

const INK = rgb(0.35, 0.27, 0.13);
const GOLD = rgb(0.77, 0.565, 0.145);
const MUTED = rgb(0.6, 0.52, 0.34);

export interface AgreementPdfData {
  guestName: string;
  signatureName: string;
  signedAtIso: string;
  ip?: string | null;
  agreementVersion: string;
  agreementHash: string;
  acks: ReadonlyArray<{ label: string }>;
  bookingLines: ReadonlyArray<{ k: string; v: string }>;
  idOnFile: boolean;
}

export async function buildAgreementPdf(
  data: AgreementPdfData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 56;
  const CW = W - M * 2;

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  function ensure(h: number) {
    if (y - h < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  }

  function write(
    text: string,
    opts: { f?: PDFFont; size?: number; color?: typeof INK; gap?: number; indent?: number } = {},
  ) {
    const f = opts.f ?? font;
    const size = opts.size ?? 10.5;
    const color = opts.color ?? INK;
    const indent = opts.indent ?? 0;
    const maxW = CW - indent;
    const lh = size * 1.4;

    const words = text.split(/\s+/);
    let cur = "";
    const lines: string[] = [];
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(trial, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur);

    for (const ln of lines) {
      ensure(lh);
      page.drawText(ln, { x: M + indent, y: y - size, size, font: f, color });
      y -= lh;
    }
    y -= opts.gap ?? 4;
  }

  function heading(text: string) {
    ensure(26);
    y -= 8;
    write(text, { f: bold, size: 12, color: GOLD, gap: 5 });
  }

  // Title
  write("The Jackpot", { f: bold, size: 20, color: GOLD, gap: 1 });
  write("Rental Agreement and House Rules", { f: bold, size: 13, color: INK, gap: 12 });

  // Booking summary
  for (const row of data.bookingLines) {
    write(`${row.k}:  ${row.v}`, { size: 10.5, gap: 2 });
  }
  y -= 8;

  // Full agreement
  for (const s of AGREEMENT_SECTIONS) {
    heading(s.h);
    for (const b of s.body) {
      write(s.h === "Fees" ? `· ${b}` : b, { gap: 4, indent: s.h === "Fees" ? 10 : 0 });
    }
  }

  // Acknowledgments
  heading("Acknowledged by the guest");
  for (const a of data.acks) {
    write(`· ${a.label}`, { size: 10, gap: 3, indent: 10 });
  }

  // Signature block
  heading("Signature");
  const when = new Date(data.signedAtIso).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  write(`Signed by: ${data.signatureName}`, { f: bold, gap: 2 });
  write(`Guest of record: ${data.guestName}`, { gap: 2 });
  write(`Signed at: ${when}`, { gap: 2 });
  if (data.ip) write(`Signed from: ${data.ip}`, { gap: 2 });
  write(`Photo ID on file: ${data.idOnFile ? "Yes" : "No"}`, { gap: 2 });
  write(`Agreement version: ${data.agreementVersion}`, { gap: 8 });

  // Fingerprint
  write(`Document fingerprint (SHA-256): ${data.agreementHash}`, {
    size: 8,
    color: MUTED,
    gap: 0,
  });

  return doc.save();
}
