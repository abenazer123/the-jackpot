/**
 * /confirm/[token] — guest booking confirmation + deposit page.
 *
 * Server-fetches the inquiry by share_token (same pattern as /trip/[token]),
 * builds the real reservation + payment schedule, and hands the interactive
 * body (agreement modal, acknowledgments, signature, secure payment) to the
 * ConfirmBooking client island.
 *
 * The payment box is a secure Stripe-ready mount, never a raw card field.
 * Live charging is wired once a Stripe account is connected.
 */

import { notFound } from "next/navigation";

import { ConfirmBooking } from "@/components/booking/ConfirmBooking";
import { BUSINESS, STAY, paymentSchedule } from "@/lib/booking/agreement";
import { supabaseServer } from "@/lib/supabase-server";

import styles from "@/components/booking/confirm.module.css";

interface ConfirmPageProps {
  params: Promise<{ token: string }>;
}

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;

function weekdayLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function dateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** A date `days` before the iso arrival, formatted long. */
function minusDaysLong(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function nightsBetween(arrival: string, departure: string): number {
  const a = new Date(arrival).getTime();
  const b = new Date(departure).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export default async function ConfirmPage({ params }: ConfirmPageProps) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const { data, error } = await supabaseServer()
    .from("inquiries")
    .select(
      "id, name, arrival, departure, guests, reason, quote_total_cents, quote_snapshot",
    )
    .eq("share_token", token)
    .maybeSingle();

  if (error) {
    console.error("[confirm] fetch failed", error);
    notFound();
  }
  if (!data) notFound();

  const arrival = data.arrival as string;
  const departure = data.departure as string;
  const totalCents = (data.quote_total_cents as number | null) ?? 0;

  // Milestones: final 50% due 40 days before arrival; the to-50% step a few
  // weeks earlier. Provisional, Abe can set exact dates.
  const milestone1 = minusDaysLong(arrival, 66);
  const milestone2 = minusDaysLong(arrival, 40);

  const booking = {
    token,
    guestName: (data.name as string) ?? "Guest",
    firstName: firstNameOf((data.name as string) ?? "Guest"),
    address: BUSINESS.address,
    arrivalLong: weekdayLong(arrival),
    departureLong: weekdayLong(departure),
    arrivalDateLong: dateLong(arrival),
    departureDateLong: dateLong(departure),
    nights: nightsBetween(arrival, departure),
    checkIn: STAY.checkIn,
    checkInNote: STAY.checkInNote,
    checkOut: STAY.checkOut,
    checkOutNote: STAY.checkOutNote,
    guests: (data.guests as number | null) ?? STAY.maxGuests,
    maxGuests: STAY.maxGuests,
    bookingRef: `JP ${String(data.id).slice(0, 4).toUpperCase()}`,
    totalCents,
    holdUsd: STAY.holdUsd,
    schedule: paymentSchedule(totalCents, milestone1, milestone2),
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.wordmark}>
          <span className={styles.pip} aria-hidden="true">
            &#10038;
          </span>
          The Jackpot
        </div>
        <div className={styles.secure}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Secure booking
        </div>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Your weekend &middot; Confirmation</p>
          <h1 className={styles.heroTitle}>
            It&rsquo;s official, <em>{booking.firstName}</em>. Your Jackpot
            weekend awaits.
          </h1>
          <p className={styles.heroSub}>
            Review your dates and terms below, then place your deposit to lock
            in the home for your crew. Everything is laid out plainly.
          </p>
        </div>
      </header>

      <ConfirmBooking booking={booking} />
    </div>
  );
}
