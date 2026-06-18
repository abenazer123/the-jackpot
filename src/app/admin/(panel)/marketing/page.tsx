/**
 * /admin/marketing — lead attribution + channel economics.
 *
 * Answers "where are leads coming from, how many per month, and what is
 * each one costing us" from the inquiries table. Batch (utm_source=batch
 * or referrer letsbatch.com) is the one channel with a known monthly
 * spend, so it gets a cost-per-lead. Reserves (reserved_at) are the
 * tracked conversion today; true paid-booking tracking is a later add,
 * so cost-per-booking is intentionally not claimed yet.
 *
 * Read-only, server-rendered, deduped the same way /admin/inquiries does
 * (a partial draft sharing email+dates with a submitted final is one
 * lead, not two).
 */

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../admin.module.css";
import own from "./marketing.module.css";

export const dynamic = "force-dynamic";

/** Known monthly ad spend per channel, in cents. Only channels we pay
 *  for appear here; everything else is organic and has no cost per lead.
 *  Hardcoded for now; move to pricing_config when a second paid channel
 *  shows up or the number changes often. */
const MONTHLY_SPEND_CENTS: Record<string, number> = {
  batch: 43000, // $430/mo, Lets Batch bachelorette/wedding lead gen
};

interface Row {
  status: "partial" | "submitted" | string | null;
  created_at: string | null;
  email: string | null;
  arrival: string | null;
  departure: string | null;
  source: string | null;
  utm_source: string | null;
  referrer: string | null;
  reserved_at: string | null;
  reason: string | null;
  guests: number | null;
  nights: number | null;
}

/** Resolve a lead to one channel. Batch is detected by either the UTM
 *  tag or the letsbatch referrer; otherwise fall back to utm_source, the
 *  legacy source column, then "direct". */
function channelOf(r: Row): string {
  const utm = (r.utm_source ?? "").toLowerCase().trim();
  if (utm === "batch" || /letsbatch/i.test(r.referrer ?? "")) return "batch";
  if (utm) return utm;
  const src = (r.source ?? "").toLowerCase().trim();
  if (src) return src;
  return "direct";
}

function dedupeKey(r: Row): string {
  return `${r.email ?? ""}|${r.arrival ?? ""}|${r.departure ?? ""}`;
}

function monthKey(iso: string | null): string {
  return (iso ?? "").slice(0, 7) || "unknown";
}

function monthLabel(key: string): string {
  if (key === "unknown") return "Unknown";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

/** Count occurrences, blanks folded into "Unknown", sorted by count. */
function distribution(
  values: Array<string | number | null | undefined>,
): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = v == null || v === "" ? "Unknown" : String(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const CHANNEL_LABEL: Record<string, string> = {
  batch: "Batch",
  hero: "Hero (site)",
  chat_share: "Chat share",
  sticky_desktop: "Sticky CTA",
  peek_mobile: "Mobile peek",
  direct: "Direct / untagged",
};

function channelLabel(key: string): string {
  return CHANNEL_LABEL[key] ?? key;
}

/** A labeled horizontal-bar breakdown. Bars scale to the largest row so
 *  small samples still read; the value shows count and share of total. */
function Distribution({
  rows,
  total,
}: {
  rows: Array<[string, number]>;
  total: number;
}) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className={own.dist}>
      {rows.map(([label, n]) => (
        <div key={label} className={own.distRow}>
          <span className={own.distLabel}>{label}</span>
          <span className={own.distBar} aria-hidden="true">
            <span
              className={own.distFill}
              style={{ width: `${Math.round((n / max) * 100)}%` }}
            />
          </span>
          <span className={own.distVal}>
            {n}
            {total ? (
              <span className={own.distPct}> · {Math.round((n / total) * 100)}%</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProfileCard({
  title,
  stat,
  children,
}: {
  title: string;
  stat?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={own.profileCard}>
      <p className={own.profileTitle}>{title}</p>
      {stat ? <p className={own.profileStat}>{stat}</p> : null}
      {children}
    </div>
  );
}

export default async function MarketingPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("inquiries")
    .select(
      "status, created_at, email, arrival, departure, source, utm_source, referrer, reserved_at, reason, guests, nights",
    )
    .order("created_at", { ascending: false });

  const all = (data ?? []) as Row[];

  // Dedupe partial drafts that share a tuple with a submitted final.
  const submittedKeys = new Set(
    all.filter((r) => r.status === "submitted").map(dedupeKey),
  );
  const leads = all.filter(
    (r) => r.status === "submitted" || !submittedKeys.has(dedupeKey(r)),
  );

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // ── By channel ────────────────────────────────────────────────
  const channels = new Map<string, { leads: number; reserves: number }>();
  for (const r of leads) {
    const c = channelOf(r);
    const e = channels.get(c) ?? { leads: 0, reserves: 0 };
    e.leads++;
    if (r.reserved_at) e.reserves++;
    channels.set(c, e);
  }
  const channelRows = [...channels.entries()].sort(
    (a, b) => b[1].leads - a[1].leads,
  );

  // ── By month (overall + Batch) ────────────────────────────────
  const months = new Map<
    string,
    { leads: number; batch: number; reserves: number; batchReserves: number }
  >();
  for (const r of leads) {
    const k = monthKey(r.created_at);
    const e =
      months.get(k) ?? { leads: 0, batch: 0, reserves: 0, batchReserves: 0 };
    e.leads++;
    if (r.reserved_at) e.reserves++;
    if (channelOf(r) === "batch") {
      e.batch++;
      if (r.reserved_at) e.batchReserves++;
    }
    months.set(k, e);
  }
  const monthRows = [...months.entries()].sort((a, b) =>
    a[0] < b[0] ? 1 : -1,
  ); // newest first

  // ── Headline numbers ──────────────────────────────────────────
  const totalLeads = leads.length;
  const batchAll = channels.get("batch")?.leads ?? 0;
  const totalReserves = leads.filter((r) => r.reserved_at).length;
  const thisMonth = months.get(currentMonth) ?? {
    leads: 0,
    batch: 0,
    reserves: 0,
    batchReserves: 0,
  };
  const batchSpend = MONTHLY_SPEND_CENTS.batch ?? 0;
  const batchCplThisMonth =
    thisMonth.batch > 0 ? money(batchSpend / thisMonth.batch) : "—";

  // ── Batch lead profile (who's actually coming from the paid channel) ─
  const batchLeads = leads.filter((r) => channelOf(r) === "batch");
  const bn = batchLeads.length;

  const occasionDist = distribution(batchLeads.map((r) => r.reason));

  const guestNums = batchLeads
    .map((r) => r.guests)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => a - b);
  const guestAvg = guestNums.length
    ? (guestNums.reduce((a, b) => a + b, 0) / guestNums.length).toFixed(1)
    : "—";
  const guestMedian = guestNums.length
    ? guestNums[Math.floor(guestNums.length / 2)]
    : "—";
  const guestDist = distribution(batchLeads.map((r) => r.guests)).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );

  const nightsDist = distribution(batchLeads.map((r) => r.nights)).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );

  const monthMap = new Map<string, number>();
  for (const r of batchLeads) {
    const k = (r.arrival ?? "").slice(0, 7) || "Unknown";
    monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
  }
  const arrivalMonths = [...monthMap.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  );

  const LEAD_BUCKETS: Array<[string, number, number]> = [
    ["Under 2 weeks", 0, 14],
    ["2 to 4 weeks", 14, 30],
    ["1 to 2 months", 30, 60],
    ["2 to 4 months", 60, 120],
    ["4 months+", 120, Infinity],
  ];
  const leadCounts = new Map<string, number>();
  const leadDays: number[] = [];
  for (const r of batchLeads) {
    if (!r.arrival || !r.created_at) continue;
    const d = Math.round(
      (new Date(r.arrival + "T00:00:00").getTime() -
        new Date(r.created_at).getTime()) /
        86_400_000,
    );
    if (d < 0) continue;
    leadDays.push(d);
    for (const [label, lo, hi] of LEAD_BUCKETS) {
      if (d >= lo && d < hi) {
        leadCounts.set(label, (leadCounts.get(label) ?? 0) + 1);
        break;
      }
    }
  }
  leadDays.sort((a, b) => a - b);
  const leadMedian = leadDays.length
    ? leadDays[Math.floor(leadDays.length / 2)]
    : null;
  const leadRows: Array<[string, number]> = LEAD_BUCKETS.map(([label]) => [
    label,
    leadCounts.get(label) ?? 0,
  ]);

  const batchSubmitted = batchLeads.filter(
    (r) => r.status === "submitted",
  ).length;
  const completionRows: Array<[string, number]> = [
    ["Completed inquiry", batchSubmitted],
    ["Partial (dropped)", bn - batchSubmitted],
  ];

  return (
    <div>
      <h1 className={styles.h1}>Marketing</h1>
      <p className={styles.subtitle}>
        Where leads come from and what they cost. Batch is the one paid
        channel ({money(batchSpend)}/mo), so it carries a cost per lead. A
        &ldquo;lead&rdquo; is a deduped inquiry; reserves are the tracked
        conversion today.
      </p>

      {error ? (
        <div className={styles.error}>
          Couldn&apos;t load inquiries: {error.message}
        </div>
      ) : null}

      <section className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Leads this month</p>
          <p className={styles.kpiValue}>{thisMonth.leads}</p>
          <p className={styles.kpiSub}>{thisMonth.batch} from Batch</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Batch cost / lead (this mo)</p>
          <p className={styles.kpiValue}>{batchCplThisMonth}</p>
          <p className={styles.kpiSub}>{money(batchSpend)}/mo · in progress</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Leads all time</p>
          <p className={styles.kpiValue}>{totalLeads}</p>
          <p className={styles.kpiSub}>
            {batchAll} from Batch ({pct(batchAll, totalLeads)})
          </p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>Reserves all time</p>
          <p className={styles.kpiValue}>{totalReserves}</p>
          <p className={styles.kpiSub}>
            {pct(totalReserves, totalLeads)} of leads reserved
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>By channel (all time)</h2>
        <div className={styles.table}>
          <div className={`${styles.tableHeader} ${own.row5}`}>
            <span>Channel</span>
            <span>Leads</span>
            <span>Share</span>
            <span>Reserves</span>
            <span>Reserve rate</span>
          </div>
          {channelRows.map(([key, v]) => (
            <div key={key} className={`${styles.tableRow} ${own.row5}`}>
              <span className={styles.cell}>{channelLabel(key)}</span>
              <span className={styles.cell}>{v.leads}</span>
              <span className={styles.cell}>{pct(v.leads, totalLeads)}</span>
              <span className={styles.cell}>{v.reserves}</span>
              <span className={styles.cell}>{pct(v.reserves, v.leads)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Who&apos;s coming from Batch ({bn} leads)
        </h2>
        <div className={own.profileGrid}>
          <ProfileCard title="Occasion">
            <Distribution rows={occasionDist} total={bn} />
          </ProfileCard>
          <ProfileCard
            title="Group size"
            stat={`avg ${guestAvg} · median ${guestMedian} guests`}
          >
            <Distribution rows={guestDist} total={bn} />
          </ProfileCard>
          <ProfileCard title="Trip length">
            <Distribution rows={nightsDist} total={bn} />
          </ProfileCard>
          <ProfileCard title="When they want to come">
            <Distribution rows={arrivalMonths} total={bn} />
          </ProfileCard>
          <ProfileCard
            title="How far ahead they inquire"
            stat={leadMedian != null ? `median ${leadMedian} days out` : undefined}
          >
            <Distribution rows={leadRows} total={bn} />
          </ProfileCard>
          <ProfileCard title="Inquiry completion">
            <Distribution rows={completionRows} total={bn} />
          </ProfileCard>
        </div>
        <p className={styles.kpiSub} style={{ marginTop: 12 }}>
          Trip length is in nights. Group size and occasion come from the
          inquiry form. Most Batch leads complete the inquiry, then go quiet,
          so the gap is post inquiry, not first touch.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Month over month</h2>
        <div className={styles.table}>
          <div className={`${styles.tableHeader} ${own.row5}`}>
            <span>Month</span>
            <span>Leads</span>
            <span>Batch</span>
            <span>Batch $/lead</span>
            <span>Reserves</span>
          </div>
          {monthRows.map(([key, v]) => {
            const cpl = v.batch > 0 ? money(batchSpend / v.batch) : "—";
            const partial = key === currentMonth;
            return (
              <div key={key} className={`${styles.tableRow} ${own.row5}`}>
                <span className={styles.cell}>
                  {monthLabel(key)}
                  {partial ? (
                    <span className={styles.cellMuted}> · so far</span>
                  ) : null}
                </span>
                <span className={styles.cell}>{v.leads}</span>
                <span className={styles.cell}>{v.batch}</span>
                <span className={styles.cell}>{cpl}</span>
                <span className={styles.cell}>{v.reserves}</span>
              </div>
            );
          })}
        </div>
        <p className={styles.kpiSub} style={{ marginTop: 12 }}>
          Cost per lead assumes a flat {money(batchSpend)}/mo Batch spend,
          divided by that month&apos;s Batch leads. The current month is
          partial, so its cost per lead falls as more leads land. True cost
          per booking needs paid bookings tracked, which reserves stand in
          for today.
        </p>
      </section>
    </div>
  );
}
