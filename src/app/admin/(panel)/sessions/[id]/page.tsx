/**
 * /admin/sessions/[id] — full chat-session viewer.
 *
 * The home for everything Olivia captured in one /chat visit: contact +
 * trip slots, the qualify-beat signals, reserve / call details, and the
 * complete transcript. The notification emails ("Open the full session")
 * and the inquiries row both link here.
 *
 * Read-only, server-rendered. Joins the linked inquiry (when the session
 * became a lead) for reserve + quote details.
 */

import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";

import styles from "../../admin.module.css";
import inq from "../../inquiries/inquiries.module.css";
import own from "./sessions.module.css";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

type Msg = { role: string; body: string; ts: string };

const TIMELINE_LABEL: Record<string, string> = {
  immediate: "Ready to lock now",
  this_week: "Deciding this week",
  this_month: "Deciding this month",
  flexible: "Flexible / early",
  unknown: "Unknown",
};
const DECIDER_LABEL: Record<string, string> = {
  solo: "Decides solo",
  partner: "Decides with partner",
  crew: "Needs the crew",
  unknown: "Unknown",
};

function str(v: unknown): string | null {
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

function money(cents: unknown): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SessionViewer({ params }: PageProps) {
  const { id } = await params;
  const sb = supabaseServer();

  const { data: session, error } = await sb
    .from("inquiry_session")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div>
        <h1 className={styles.h1}>Session</h1>
        <div className={styles.error}>Couldn&apos;t load session: {error.message}</div>
      </div>
    );
  }
  if (!session) {
    return (
      <div>
        <Link href="/admin/inquiries" className={own.back}>
          ← Inquiries
        </Link>
        <h1 className={styles.h1}>Session not found</h1>
        <p className={styles.subtitle}>No session with id {id}.</p>
      </div>
    );
  }

  const slots = (session.slots ?? {}) as Record<string, unknown>;
  const signals = (session.signals ?? {}) as Record<string, unknown>;
  const transcript = (session.transcript ?? []) as Msg[];

  let inquiry: Record<string, unknown> | null = null;
  if (session.inquiry_id) {
    const { data } = await sb
      .from("inquiries")
      .select(
        "id, status, source, reserved_at, reserve_call_window, quote_total_cents, share_token, share_views",
      )
      .eq("id", session.inquiry_id)
      .maybeSingle();
    inquiry = data ?? null;
  }

  const guestName = str(slots.name) ?? "Guest";
  const occasion = str(slots.occasion);

  // Contact + trip
  const contactRows: Array<[string, string]> = [];
  const pushC = (l: string, v: unknown) => {
    const s = str(v);
    if (s) contactRows.push([l, s]);
  };
  pushC("Name", slots.name);
  pushC("Email", slots.email);
  pushC("Phone", slots.phone);
  pushC(
    "Dates",
    slots.arrival && slots.departure
      ? `${slots.arrival} → ${slots.departure}`
      : null,
  );
  pushC("Guests", slots.guest_count);
  pushC("Occasion", slots.occasion);

  // Qualify + passive signals
  const signalRows: Array<[string, string]> = [];
  const pushS = (l: string, v: unknown) => {
    const s = str(v);
    if (s) signalRows.push([l, s]);
  };
  {
    const t = str(signals.decision_timeline);
    if (t) signalRows.push(["Timeline", TIMELINE_LABEL[t] ?? t]);
    const d = str(signals.decision_makers);
    if (d) signalRows.push(["Deciding power", DECIDER_LABEL[d] ?? d]);
  }
  pushS("Stage", signals.stage);
  pushS("Urgency", signals.urgency);
  pushS("Fit", signals.fit);
  pushS("Sentiment", signals.sentiment);
  pushS("Intent", signals.intent);
  pushS("Price reaction", slots.price_response ?? signals.price_response);
  pushS("Objections", signals.objections ?? slots.objections);

  // Reserve / call
  const reserveRows: Array<[string, string]> = [];
  if (inquiry) {
    const pushR = (l: string, v: unknown) => {
      const s = str(v);
      if (s) reserveRows.push([l, s]);
    };
    pushR("Status", inquiry.status);
    pushR("Source", inquiry.source);
    pushR("Reserved", formatExact((inquiry.reserved_at as string) ?? null));
    pushR("Call booked", inquiry.reserve_call_window);
    const m = money(inquiry.quote_total_cents);
    if (m) reserveRows.push(["Held quote", m]);
  }

  return (
    <div>
      <Link href="/admin/inquiries" className={own.back}>
        ← Inquiries
      </Link>
      <h1 className={styles.h1}>
        {guestName}
        {occasion ? ` · ${occasion}` : ""}
      </h1>
      <p className={styles.subtitle}>
        Phase {session.phase} · started {formatExact(session.created_at)} · last
        activity {formatExact(session.last_activity_at)}
        {inquiry?.id ? (
          <>
            {" "}
            ·{" "}
            <Link href="/admin/inquiries" className={inq.detailLink}>
              linked inquiry
            </Link>
          </>
        ) : null}
      </p>

      <div className={own.columns}>
        <div className={own.col}>
          <Section title="Contact & trip" rows={contactRows} />
          {signalRows.length > 0 ? (
            <Section title="Qualify & signals" rows={signalRows} />
          ) : null}
          {reserveRows.length > 0 ? (
            <Section title="Reserve & call" rows={reserveRows} highlight />
          ) : null}
          {(session.utm || session.user_agent || session.ip) && (
            <div className={inq.detailSection}>
              <span className={inq.detailSectionLabel}>Attribution</span>
              <dl className={inq.attrList}>
                {session.ip ? (
                  <div className={inq.attrRow}>
                    <dt>ip</dt>
                    <dd>{session.ip}</dd>
                  </div>
                ) : null}
                {session.user_agent ? (
                  <div className={inq.attrRow}>
                    <dt>user_agent</dt>
                    <dd>{session.user_agent}</dd>
                  </div>
                ) : null}
                {session.utm ? (
                  <div className={inq.attrRow}>
                    <dt>utm</dt>
                    <dd>{JSON.stringify(session.utm)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}
        </div>

        <div className={own.col}>
          <span className={inq.detailSectionLabel}>
            Transcript · {transcript.length} message
            {transcript.length === 1 ? "" : "s"}
          </span>
          {transcript.length === 0 ? (
            <p className={own.empty}>No messages recorded.</p>
          ) : (
            <div className={own.thread}>
              {transcript.map((m, i) => {
                const role =
                  m.role === "olivia"
                    ? "olivia"
                    : m.role === "user"
                      ? "user"
                      : "system";
                return (
                  <div
                    key={`${i}-${m.ts}`}
                    className={`${own.msg} ${own[`msg_${role}`]}`}
                  >
                    <div className={own.msgMeta}>
                      {role === "olivia"
                        ? "Olivia"
                        : role === "user"
                          ? "Guest"
                          : "System"}{" "}
                      · {formatTime(m.ts)}
                    </div>
                    <div className={own.msgBody}>{m.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={inq.detailSection}>
        <span className={inq.detailSectionLabel}>Session ID</span>
        <span className={inq.detailValueMono}>{session.id}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  highlight,
}: {
  title: string;
  rows: Array<[string, string]>;
  highlight?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className={`${own.section} ${highlight ? own.sectionHighlight : ""}`}>
      <span className={inq.detailSectionLabel}>{title}</span>
      <div className={inq.detailGrid}>
        {rows.map(([label, value]) => (
          <div key={label} className={inq.detailField}>
            <span className={inq.detailLabel}>{label}</span>
            <span className={inq.detailValue}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
