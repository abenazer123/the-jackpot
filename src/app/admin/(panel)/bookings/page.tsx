/**
 * /admin/bookings — the signed-booking ledger.
 *
 * One row per `booking_agreements` record (a guest who signed the
 * agreement on /confirm), newest first. Each row expands to the full
 * submission: signature + guest of record, the exact agreement version +
 * SHA-256 hash they agreed to, every acknowledgment they checked, the
 * deposit + Stripe identifiers, IP / user-agent, and short-lived signed
 * URLs to the private photo ID and the generated signed-agreement PDF.
 *
 * Read-only. The private files live in the `booking-ids` bucket and are
 * never public — we mint a fresh signed URL per page load (30 min TTL).
 */

import { isPaymentPlan, planLabel } from "@/lib/booking/agreement";
import { siteOrigin } from "@/lib/siteOrigin";
import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import own from "./bookings.module.css";

export const dynamic = "force-dynamic";

interface InquiryLite {
  name: string | null;
  email: string | null;
  phone: string | null;
  arrival: string | null;
  departure: string | null;
  guests: number | null;
  reason: string | null;
  quote_total_cents: number | null;
  stripe_customer_id: string | null;
}

interface Ack {
  id?: string;
  label?: string;
}

interface BookingRow {
  id: number;
  created_at: string;
  inquiry_id: string | null;
  share_token: string;
  guest_name: string | null;
  signature_name: string;
  agreement_version: string;
  agreement_hash: string;
  acknowledgments: Ack[] | null;
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  id_document_path: string | null;
  agreement_pdf_path: string | null;
  payment_plan: string | null;
  deposit_payment_ref: string | null;
  deposit_amount_cents: number | null;
  stripe_payment_method_id: string | null;
  status: "signed" | "deposit_paid" | "void";
  inquiry: InquiryLite | null;
}

const SIGNED_URL_TTL = 60 * 30; // 30 minutes

function formatExact(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(arrival: string | null, departure: string | null): string {
  if (!arrival && !departure) return "—";
  return `${formatDate(arrival)} → ${formatDate(departure)}`;
}

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusClass(status: string): string {
  if (status === "deposit_paid") return own.statusPaid;
  if (status === "signed") return own.statusSigned;
  return own.statusVoid;
}

function statusLabel(status: string): string {
  if (status === "deposit_paid") return "Deposit paid";
  if (status === "signed") return "Signed";
  return status;
}

export default async function BookingsPage() {
  const sb = supabaseServer();

  const { data, error } = await sb
    .from("booking_agreements")
    .select(
      "*, inquiry:inquiries(name, email, phone, arrival, departure, guests, reason, quote_total_cents, stripe_customer_id)",
    )
    .order("signed_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as BookingRow[];

  // Mint short-lived signed URLs for the private documents of every visible
  // row, in one batch. Paths that don't resolve simply come back null and
  // render as "not on file".
  const paths = new Set<string>();
  for (const r of rows) {
    if (r.id_document_path) paths.add(r.id_document_path);
    if (r.agreement_pdf_path) paths.add(r.agreement_pdf_path);
  }
  const signedUrls = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (p) => {
      const { data: signed } = await sb.storage
        .from("booking-ids")
        .createSignedUrl(p, SIGNED_URL_TTL);
      if (signed?.signedUrl) signedUrls.set(p, signed.signedUrl);
    }),
  );

  const paidCount = rows.filter((r) => r.status === "deposit_paid").length;

  return (
    <div>
      <h1 className={styles.h1}>Bookings</h1>
      <p className={styles.subtitle}>
        Signed booking agreements, newest first. {rows.length} on record
        {rows.length ? `, ${paidCount} with the deposit paid` : ""}. Expand a
        row for the full signed record, documents, and payment details.
      </p>

      {error ? (
        <div className={styles.error}>
          Couldn&apos;t load bookings: {error.message}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className={styles.empty}>No signed bookings yet.</div>
      ) : (
        <div className={styles.table}>
          <div className={`${styles.tableHeader} ${own.row}`}>
            <span>Signed</span>
            <span>Status</span>
            <span>Guest</span>
            <span>Dates</span>
            <span>Deposit</span>
            <span>Payment ref</span>
          </div>
          {rows.map((row) => (
            <details key={row.id} className={own.detailsRow}>
              <summary className={`${styles.tableRow} ${own.row} ${own.summary}`}>
                <span className={styles.cell} title={formatExact(row.signed_at)}>
                  {formatRelative(row.signed_at)}
                </span>
                <span className={styles.cell}>
                  <span className={`${own.statusTag} ${statusClass(row.status)}`}>
                    {statusLabel(row.status)}
                  </span>
                </span>
                <span className={styles.cell}>
                  <span className={own.guestName}>
                    {row.signature_name || row.guest_name || "—"}
                  </span>
                  <span className={own.guestEmail}>
                    {row.inquiry?.email || "—"}
                  </span>
                </span>
                <span className={styles.cell}>
                  {formatRange(
                    row.inquiry?.arrival ?? null,
                    row.inquiry?.departure ?? null,
                  )}
                </span>
                <span className={styles.cell}>
                  <span className={own.depositTag}>
                    {formatMoney(row.deposit_amount_cents)}
                  </span>
                </span>
                <span className={`${styles.cell} ${own.refMono}`}>
                  {row.deposit_payment_ref || "—"}
                </span>
              </summary>
              <BookingDetail row={row} signedUrls={signedUrls} />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingDetail({
  row,
  signedUrls,
}: {
  row: BookingRow;
  signedUrls: Map<string, string>;
}) {
  const idUrl = row.id_document_path ? signedUrls.get(row.id_document_path) : undefined;
  const pdfUrl = row.agreement_pdf_path
    ? signedUrls.get(row.agreement_pdf_path)
    : undefined;
  const acks = Array.isArray(row.acknowledgments) ? row.acknowledgments : [];

  return (
    <div className={own.detail}>
      <div className={own.detailGrid}>
        <DetailField label="Signature" value={row.signature_name} />
        <DetailField label="Guest of record" value={row.guest_name || "—"} />
        <DetailField label="Signed at" value={formatExact(row.signed_at)} />
        <DetailField label="Status" value={statusLabel(row.status)} />
        <DetailField label="Email" value={row.inquiry?.email || "—"} />
        <DetailField label="Phone" value={row.inquiry?.phone || "—"} />
        <DetailField
          label="Dates"
          value={formatRange(
            row.inquiry?.arrival ?? null,
            row.inquiry?.departure ?? null,
          )}
        />
        <DetailField
          label="Group"
          value={
            row.inquiry?.guests
              ? `${row.inquiry.guests} guests${row.inquiry.reason ? ` · ${row.inquiry.reason}` : ""}`
              : (row.inquiry?.reason ?? "—")
          }
        />
        <DetailField
          label="Weekend total"
          value={formatMoney(row.inquiry?.quote_total_cents ?? null)}
        />
        <DetailField
          label="Payment plan"
          value={isPaymentPlan(row.payment_plan) ? planLabel(row.payment_plan) : "—"}
        />
        <DetailField
          label="Paid today"
          value={formatMoney(row.deposit_amount_cents)}
        />
        <DetailField label="Agreement version" value={row.agreement_version} />
        <DetailField label="Booking ID" value={String(row.id)} mono />
        <DetailField label="Inquiry ID" value={row.inquiry_id || "—"} mono />
        <DetailField label="IP" value={row.ip || "—"} mono />
        <DetailField label="Payment ref" value={row.deposit_payment_ref || "—"} mono />
        <DetailField
          label="Stripe customer"
          value={row.inquiry?.stripe_customer_id || "—"}
          mono
        />
        <DetailField
          label="Saved card"
          value={row.stripe_payment_method_id || "—"}
          mono
        />
        <DetailField label="Agreement hash (SHA-256)" value={row.agreement_hash} mono />
        <DetailField label="User agent" value={row.user_agent || "—"} mono />
        <DetailField
          label="Payment link"
          value={
            <a
              href={`/confirm/${row.share_token}`}
              target="_blank"
              rel="noreferrer"
              className={own.detailLink}
            >
              {siteOrigin()}/confirm/{row.share_token}
            </a>
          }
        />
      </div>

      <div className={own.detailSection}>
        <span className={own.detailSectionLabel}>Documents</span>
        <div className={own.docRow}>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className={own.docButton}
            >
              ⬇ Signed agreement PDF
            </a>
          ) : (
            <span className={own.docMissing}>Signed PDF not on file</span>
          )}
          {idUrl ? (
            <a href={idUrl} target="_blank" rel="noreferrer" className={own.docButton}>
              ⬇ Photo ID
            </a>
          ) : (
            <span className={own.docMissing}>Photo ID not on file</span>
          )}
        </div>
      </div>

      {acks.length > 0 ? (
        <div className={own.detailSection}>
          <span className={own.detailSectionLabel}>
            Acknowledgments ({acks.length})
          </span>
          <ul className={own.ackList}>
            {acks.map((a, i) => (
              <li key={a.id ?? i} className={own.ackItem}>
                <span className={own.ackCheck}>✓</span>
                <span>{a.label ?? a.id ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={own.detailField}>
      <span className={own.detailLabel}>{label}</span>
      <span className={mono ? own.detailValueMono : own.detailValue}>{value}</span>
    </div>
  );
}
