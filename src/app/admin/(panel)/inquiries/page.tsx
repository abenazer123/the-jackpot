/**
 * /admin/inquiries — list of leads from the booking funnel.
 *
 * Server-rendered table, most recent first. Default view shows the last
 * 100 inquiries across both statuses; ?status=submitted | ?status=partial
 * filters to one bucket. Each row is expandable via <details> to reveal
 * the full record (phone, attribution, reveal-screen text, share token,
 * quote snapshot, user-agent / IP).
 *
 * Read-only. No mutations yet — Abe still uses Supabase Table Editor for
 * anything that needs an edit (delete, status flip, etc.).
 */

import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import { refreshAllPrices } from "./actions";
import { refreshAvailabilityCache } from "./refresh";
import own from "./inquiries.module.css";

export const dynamic = "force-dynamic";

interface InquiryRow {
  id: string;
  created_at: string;
  status: "partial" | "submitted";
  arrival: string | null;
  departure: string | null;
  nights: number | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  guests: number | null;
  reason: string | null;
  source: string | null;
  venue: string | null;
  quote_total_cents: number | null;
  quote_snapshot: unknown;
  // Attribution
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  referrer: string | null;
  landing_path: string | null;
  current_path: string | null;
  user_agent: string | null;
  ip: string | null;
  // Reveal-screen interactions
  primary_cta_path: "interested" | "share" | "appeal" | null;
  appeal_text: string | null;
  appeal_stretch_level: "close" | "far" | null;
  alt_dates_requested: boolean | null;
  share_requested: boolean | null;
  split_pay_requested: boolean | null;
  // Trip portal
  share_token: string | null;
  share_views: number | null;
  shared_at: string | null;
  // Refreshed quote (admin re-quote button writes these; trip page
  // still gates display on direction)
  quote_refreshed_total_cents: number | null;
  quote_refreshed_at: string | null;
}

interface PageProps {
  searchParams: Promise<{ status?: string; available?: string }>;
}

/** Per-inquiry availability status, derived by checking every night in
 *  [arrival, departure) against listing_prices.
 *
 *  past    — arrival is before today; no longer an actionable lead
 *  open    — every night has a row + is available + not unbookable
 *  booked  — at least one night is unbookable / not available
 *  unknown — at least one night is missing from listing_prices and the
 *            rest don't decide the verdict (no cache coverage)
 */
type DateStatus = "past" | "open" | "booked" | "unknown";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Enumerates the nights of a stay: arrival inclusive, departure
 *  exclusive (the checkout day is not a paid night). */
function nightsBetween(arrival: string, departure: string): string[] {
  const out: string[] = [];
  const [ay, am, ad] = arrival.split("-").map(Number);
  const [dy, dm, dd] = departure.split("-").map(Number);
  const cur = new Date(ay, am - 1, ad);
  const end = new Date(dy, dm - 1, dd);
  while (cur < end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

interface PriceCell {
  unbookable: boolean;
  available: boolean;
}

function classifyDates(
  arrival: string | null,
  departure: string | null,
  today: string,
  priceMap: Map<string, PriceCell>,
): DateStatus {
  if (!arrival || !departure) return "unknown";
  if (arrival < today) return "past";
  let hasUnknown = false;
  for (const n of nightsBetween(arrival, departure)) {
    const cell = priceMap.get(n);
    if (!cell) {
      hasUnknown = true;
      continue;
    }
    if (cell.unbookable || !cell.available) return "booked";
  }
  return hasUnknown ? "unknown" : "open";
}

function availabilityClass(status: DateStatus): string {
  if (status === "open") return own.availOpen;
  if (status === "booked") return own.availBooked;
  if (status === "past") return own.availPast;
  return own.availUnknown;
}

function availabilityLabel(status: DateStatus): string {
  if (status === "open") return "Open";
  if (status === "booked") return "Booked";
  if (status === "past") return "Past";
  return "—";
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "partial", label: "Partial" },
] as const;

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const delta = Math.max(0, Math.round((now - t) / 1000));
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 7 * 86_400) return `${Math.floor(delta / 86_400)}d ago`;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatExact(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRange(arrival: string | null, departure: string | null): string {
  if (!arrival || !departure) return "—";
  return `${formatDate(arrival)} \u2192 ${formatDate(departure)}`;
}

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function statusClass(status: string): string {
  if (status === "submitted") return own.statusSubmitted;
  if (status === "partial") return own.statusPartial;
  return own.statusOther;
}

function pathClass(path: string | null): string {
  if (path === "interested") return own.pathInterested;
  if (path === "share") return own.pathShare;
  if (path === "appeal") return own.pathAppeal;
  return own.pathNone;
}

function pathLabel(path: string | null): string {
  if (path === "interested") return "Interested";
  if (path === "share") return "Shared";
  if (path === "appeal") return "Appealed";
  return "—";
}

const ATTRIBUTION_KEYS: Array<{
  key: keyof InquiryRow;
  label: string;
}> = [
  { key: "utm_source", label: "utm_source" },
  { key: "utm_medium", label: "utm_medium" },
  { key: "utm_campaign", label: "utm_campaign" },
  { key: "utm_term", label: "utm_term" },
  { key: "utm_content", label: "utm_content" },
  { key: "gclid", label: "gclid" },
  { key: "fbclid", label: "fbclid" },
  { key: "msclkid", label: "msclkid" },
  { key: "referrer", label: "referrer" },
  { key: "landing_path", label: "landing_path" },
  { key: "current_path", label: "current_path" },
];

/** Dedup key — partial drafts and submitted finals share this tuple
 *  when they're the same guest's same attempt. Email is already lower-
 *  cased server-side and dates are ISO YYYY-MM-DD, so a plain string
 *  concat is safe as a Set key. */
function dedupeKey(row: Pick<InquiryRow, "email" | "arrival" | "departure">): string {
  return `${row.email ?? ""}|${row.arrival ?? ""}|${row.departure ?? ""}`;
}

export default async function InquiriesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requested = sp.status === "submitted" || sp.status === "partial"
    ? sp.status
    : "all";
  const showOpenOnly = sp.available === "open";

  const sb = supabaseServer();

  // Pull every row in one shot, sorted newest-first. We do the dedup +
  // status filter in memory because the partial/submitted twins live on
  // separate rows that share an (email, arrival, departure) tuple, and
  // expressing that in a single Postgres query is fiddly. At today's
  // scale (low-hundreds of rows) this is fine.
  //
  // The listing_prices read in parallel feeds the per-inquiry "are
  // these nights still open?" badge + the "Open dates only" filter.
  // Bounded by stay_date >= today so we never pull historical noise.
  const today = todayIso();
  const [{ data, error }, listingCfg, pricesRes] = await Promise.all([
    sb
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false }),
    sb
      .from("pricing_config")
      .select("value_text")
      .eq("key", "pricelabs_listing_id")
      .maybeSingle(),
    sb
      .from("listing_prices")
      .select("stay_date, listing_id, unbookable, available")
      .gte("stay_date", today),
  ]);

  const listingId = listingCfg.data?.value_text ?? null;

  // Build the date → cell map. We scope to the active listing if it's
  // configured; otherwise fall through with whatever rows we got
  // (single-listing project, but defensive in case the config drifts).
  const priceMap = new Map<string, PriceCell>();
  for (const row of (pricesRes.data ?? []) as Array<{
    stay_date: string;
    listing_id: string;
    unbookable: boolean | null;
    available: boolean | null;
  }>) {
    if (listingId && row.listing_id !== listingId) continue;
    priceMap.set(row.stay_date, {
      unbookable: row.unbookable === true,
      available: row.available !== false,
    });
  }

  const allRows = ((data ?? []) as InquiryRow[]) || [];

  // When the open-dates filter is on, hit PriceLabs once to refresh
  // the cache for the combined future-window of all inquiries, then
  // re-pull listing_prices so classification reflects today's reality.
  // Skipped on the default view to keep page loads cheap.
  if (showOpenOnly) {
    const futureRows = allRows
      .filter((r) => r.arrival && r.departure)
      .map((r) => ({
        id: r.id,
        arrival: r.arrival,
        departure: r.departure,
        guests: r.guests,
        reason: r.reason,
      }));
    await refreshAvailabilityCache(futureRows);
    const refreshed = await sb
      .from("listing_prices")
      .select("stay_date, listing_id, unbookable, available")
      .gte("stay_date", today);
    if (!refreshed.error) {
      priceMap.clear();
      for (const row of (refreshed.data ?? []) as Array<{
        stay_date: string;
        listing_id: string;
        unbookable: boolean | null;
        available: boolean | null;
      }>) {
        if (listingId && row.listing_id !== listingId) continue;
        priceMap.set(row.stay_date, {
          unbookable: row.unbookable === true,
          available: row.available !== false,
        });
      }
    }
  }

  // Build the set of tuples that have a submitted row. Any partial that
  // shares a tuple with a submitted is the precursor draft and gets
  // hidden — the submitted carries strictly more info anyway.
  const submittedKeys = new Set(
    allRows.filter((r) => r.status === "submitted").map(dedupeKey),
  );

  const deduped = allRows.filter((r) => {
    if (r.status === "submitted") return true;
    return !submittedKeys.has(dedupeKey(r));
  });

  // Tag every deduped row with its current date-availability status —
  // needed by both the badge in the row and the "Open dates only" toggle.
  const availability = new Map<string, DateStatus>();
  for (const r of deduped) {
    availability.set(r.id, classifyDates(r.arrival, r.departure, today, priceMap));
  }

  const countAll = deduped.length;
  const countSubmitted = deduped.filter((r) => r.status === "submitted").length;
  const countPartial = deduped.filter((r) => r.status === "partial").length;
  const countOpen = deduped.filter((r) => availability.get(r.id) === "open").length;
  const hiddenAsDupe = allRows.length - deduped.length;

  // Apply status filter, then (optionally) the open-dates filter, then
  // cap at 100 visible rows.
  const statusFiltered =
    requested === "all"
      ? deduped
      : deduped.filter((r) => r.status === requested);
  const afterAvailability = showOpenOnly
    ? statusFiltered.filter((r) => availability.get(r.id) === "open")
    : statusFiltered;
  const rows = afterAvailability.slice(0, 100);

  return (
    <div>
      <h1 className={styles.h1}>Inquiries</h1>
      <p className={styles.subtitle}>
        Recent leads from the booking funnel. Showing the latest 100
        {requested !== "all" ? ` ${requested}` : ""} inquiries.
        {hiddenAsDupe > 0
          ? ` ${hiddenAsDupe} partial draft${hiddenAsDupe === 1 ? "" : "s"} hidden as duplicates of submitted finals.`
          : ""}
      </p>

      {error ? (
        <div className={styles.error}>
          Couldn&apos;t load inquiries: {error.message}
        </div>
      ) : null}

      {(() => {
        // Latest quote_refreshed_at across the visible set — surfaces
        // staleness so Abe knows how recent the "New" column is.
        const stamps = deduped
          .map((r) => r.quote_refreshed_at)
          .filter((v): v is string => !!v);
        const latest =
          stamps.length > 0
            ? stamps.reduce((a, b) => (a > b ? a : b))
            : null;
        return (
          <div className={own.actionRow}>
            <form action={refreshAllPrices}>
              <button type="submit" className={styles.button}>
                Update prices
              </button>
            </form>
            <span className={own.actionHint}>
              {latest
                ? `Prices last refreshed ${formatRelative(latest)}. Hits PriceLabs live.`
                : "Click to pull today's PriceLabs rates and recompute every future-dated quote."}
            </span>
          </div>
        );
      })()}

      <div className={styles.bucketFilter}>
        {STATUS_FILTERS.map((f) => {
          const isActive = f.key === requested;
          const count =
            f.key === "all"
              ? countAll
              : f.key === "submitted"
                ? (countSubmitted ?? 0)
                : (countPartial ?? 0);
          // Preserve the open-dates toggle when switching status. Both
          // filters live as independent URL params and stack.
          const params = new URLSearchParams();
          if (f.key !== "all") params.set("status", f.key);
          if (showOpenOnly) params.set("available", "open");
          const qs = params.toString();
          const href = qs ? `/admin/inquiries?${qs}` : "/admin/inquiries";
          return (
            <Link
              key={f.key}
              href={href}
              className={`${styles.bucketChip} ${isActive ? styles.bucketChipActive : ""}`}
            >
              {f.label} · {count}
            </Link>
          );
        })}

        {(() => {
          // "Open dates only" toggle — orthogonal to the status filter,
          // preserves whichever status is currently active when toggled.
          const params = new URLSearchParams();
          if (requested !== "all") params.set("status", requested);
          if (!showOpenOnly) params.set("available", "open");
          const qs = params.toString();
          const href = qs ? `/admin/inquiries?${qs}` : "/admin/inquiries";
          return (
            <Link
              href={href}
              className={`${styles.bucketChip} ${showOpenOnly ? styles.bucketChipActive : ""} ${own.openToggle}`}
              title="Show only inquiries whose dates are still bookable on the calendar"
            >
              {showOpenOnly ? "\u2713 " : ""}Open dates only · {countOpen}
            </Link>
          );
        })()}
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>No inquiries match this filter.</div>
      ) : (
        <div className={styles.table}>
          <div className={`${styles.tableHeader} ${own.row}`}>
            <span>When</span>
            <span>Status</span>
            <span>Guest</span>
            <span>Dates</span>
            <span>Group</span>
            <span>Original</span>
            <span>New</span>
            <span>Source</span>
            <span>Path</span>
          </div>
          {rows.map((row) => (
            <details key={row.id} className={own.detailsRow}>
              <summary className={`${styles.tableRow} ${own.row} ${own.summary}`}>
                <span className={styles.cell} title={formatExact(row.created_at)}>
                  {formatRelative(row.created_at)}
                </span>
                <span className={styles.cell}>
                  <span className={`${own.statusTag} ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </span>
                <span className={styles.cell}>
                  <span className={own.guestName}>{row.name || "—"}</span>
                  <span className={own.guestEmail}>{row.email || "—"}</span>
                </span>
                <span className={styles.cell}>
                  {formatRange(row.arrival, row.departure)}
                  {row.nights ? (
                    <span className={own.nightsTag}>
                      {row.nights}n
                    </span>
                  ) : null}
                  {(() => {
                    const s = availability.get(row.id) ?? "unknown";
                    if (s === "unknown" && !row.arrival) return null;
                    return (
                      <span className={`${own.availTag} ${availabilityClass(s)}`}>
                        {availabilityLabel(s)}
                      </span>
                    );
                  })()}
                </span>
                <span className={styles.cell}>
                  {row.guests ? `${row.guests} guests` : "—"}
                  {row.reason ? (
                    <span className={styles.cellMuted}> · {row.reason}</span>
                  ) : null}
                </span>
                <span className={styles.cell}>{formatMoney(row.quote_total_cents)}</span>
                <span className={styles.cell}>
                  {row.quote_refreshed_total_cents == null ? (
                    <span className={own.priceMuted}>—</span>
                  ) : (
                    (() => {
                      const delta =
                        row.quote_total_cents != null
                          ? row.quote_refreshed_total_cents - row.quote_total_cents
                          : null;
                      const cls =
                        delta == null
                          ? own.priceFlat
                          : delta < 0
                            ? own.priceDown
                            : delta > 0
                              ? own.priceUp
                              : own.priceFlat;
                      const arrow =
                        delta == null ? "" : delta < 0 ? "\u2193" : delta > 0 ? "\u2191" : "\u00b7";
                      return (
                        <span className={cls}>
                          <span>{formatMoney(row.quote_refreshed_total_cents)}</span>
                          {delta != null && delta !== 0 ? (
                            <span className={own.priceDelta}>
                              {arrow} {formatMoney(Math.abs(delta))}
                            </span>
                          ) : null}
                        </span>
                      );
                    })()
                  )}
                </span>
                <span className={styles.cell}>
                  {row.source || row.venue || row.utm_source || "—"}
                </span>
                <span className={styles.cell}>
                  <span className={`${own.pathTag} ${pathClass(row.primary_cta_path)}`}>
                    {pathLabel(row.primary_cta_path)}
                  </span>
                </span>
              </summary>
              <InquiryDetail row={row} />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function InquiryDetail({ row }: { row: InquiryRow }) {
  const flags: string[] = [];
  if (row.share_requested) flags.push("share_requested");
  if (row.alt_dates_requested) flags.push("alt_dates_requested");
  if (row.split_pay_requested) flags.push("split_pay_requested");

  const attribution = ATTRIBUTION_KEYS.filter(
    (k) => (row[k.key] as string | null | undefined) != null,
  );

  return (
    <div className={own.detail}>
      <div className={own.detailGrid}>
        <DetailField label="Inquiry ID" value={row.id} mono />
        <DetailField label="Created" value={formatExact(row.created_at)} />
        <DetailField label="Phone" value={row.phone || "—"} />
        <DetailField label="Venue" value={row.venue || "—"} />
        <DetailField
          label="Stretch level"
          value={row.appeal_stretch_level || "—"}
        />
        <DetailField label="Share views" value={row.share_views?.toString() ?? "—"} />
        <DetailField
          label="Shared at"
          value={row.shared_at ? formatExact(row.shared_at) : "—"}
        />
        <DetailField
          label="Trip URL"
          value={
            row.share_token ? (
              <a
                href={`/trip/${row.share_token}`}
                target="_blank"
                rel="noreferrer"
                className={own.detailLink}
              >
                /trip/{row.share_token.slice(0, 8)}…
              </a>
            ) : (
              "—"
            )
          }
        />
        <DetailField label="IP" value={row.ip || "—"} mono />
        <DetailField label="User agent" value={row.user_agent || "—"} mono />
      </div>

      {flags.length > 0 ? (
        <div className={own.detailSection}>
          <span className={own.detailSectionLabel}>Reveal flags</span>
          <div className={own.flagList}>
            {flags.map((f) => (
              <span key={f} className={own.flag}>
                {f}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {row.appeal_text ? (
        <div className={own.detailSection}>
          <span className={own.detailSectionLabel}>Appeal text</span>
          <p className={own.appealText}>{row.appeal_text}</p>
        </div>
      ) : null}

      {attribution.length > 0 ? (
        <div className={own.detailSection}>
          <span className={own.detailSectionLabel}>Attribution</span>
          <dl className={own.attrList}>
            {attribution.map((k) => (
              <div key={k.key} className={own.attrRow}>
                <dt>{k.label}</dt>
                <dd>{String(row[k.key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {row.quote_snapshot ? (
        <div className={own.detailSection}>
          <span className={own.detailSectionLabel}>Quote snapshot</span>
          <pre className={own.json}>
            {JSON.stringify(row.quote_snapshot, null, 2)}
          </pre>
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
