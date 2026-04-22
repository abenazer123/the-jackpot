/**
 * HeroBookingBar — intent-capture form in the hero.
 *
 * Step 1 of a two-step funnel: user picks arrival + departure dates and drops
 * their email, then the "Check availability" CTA opens BookingPricingModal
 * (step 2) where we collect the rest of the lead info. Dates enforce a
 * 2-night minimum. Submission is mocked — every date range is "available."
 */

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { BookingPricingModal } from "./BookingPricingModal";
import { todayIso } from "./Calendar";
import { DateField, type DateFieldHandle } from "./DateField";
import { HostPresence } from "./HostPresence";
import { capture } from "./PostHogProvider";
import { readDraft, writeDraft } from "@/lib/funnel-draft";
import styles from "./HeroBookingBar.module.css";

interface HeroBookingBarProps {
  /** Optional node rendered below the submit button (e.g. GroundingLine). */
  trailing?: ReactNode;
}

const NIGHTLY_MIN = 620;
const MIN_NIGHTS = 2;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function HeroBookingBar({ trailing }: HeroBookingBarProps) {
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  // Bumped each time the modal opens so the child remounts and all its
  // internal state (form fields, success flag) starts fresh.
  const [modalKey, setModalKey] = useState(0);
  const departureRef = useRef<DateFieldHandle>(null);

  // Hydrate from the shared funnel-draft on mount. If a guest half-filled
  // the hero earlier (or on the mobile peek, or the sticky top bar) we
  // pre-fill their work instead of asking them to start over. See
  // src/lib/funnel-draft.ts for the storage model. Deferred via a 0ms
  // setTimeout to stay off the effect's synchronous path (matches the
  // pattern used in UtmProvider — react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const d = readDraft();
      if (d.arrival) setArrival(d.arrival);
      if (d.departure) setDeparture(d.departure);
      if (d.email) setEmail(d.email);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // No past dates anywhere. Departure must be at least MIN_NIGHTS after
  // arrival (when chosen); otherwise it also floors at today so the guest
  // can't pick a departure before they've thought about an arrival.
  const today = todayIso();
  const minDeparture = useMemo(
    () => (arrival ? addDaysIso(arrival, MIN_NIGHTS) : today),
    [arrival, today],
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!arrival || !departure || !email.trim()) return;
    capture("booking_cta_clicked", { surface: "hero" });
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.pricingNote}>
          From ${NIGHTLY_MIN}/night · {MIN_NIGHTS}-night minimum
        </p>

        <div className={styles.dateRow}>
          <DateField
            label="Arrival"
            value={arrival}
            onChange={(iso) => {
              setArrival(iso);
              writeDraft({ arrival: iso });
              // Auto-open Departure so the user doesn't have to hunt for
              // the second field. Small delay lets the Arrival popover
              // close gracefully before the Departure one pops.
              window.setTimeout(() => departureRef.current?.open(), 150);
            }}
            min={today}
          />
          <DateField
            ref={departureRef}
            label="Departure"
            value={departure}
            onChange={(iso) => {
              setDeparture(iso);
              writeDraft({ departure: iso });
            }}
            min={minDeparture}
            rangeStart={arrival}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => {
              const v = e.target.value;
              setEmail(v);
              writeDraft({ email: v.trim() });
            }}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
          />
        </label>

        <div className={styles.submitRow}>
          <button
            type="submit"
            className={styles.submit}
            disabled={!arrival || !departure || !email.trim()}
          >
            <span className={styles.submitText}>Check availability</span>
          </button>
          <HostPresence variant="compact" tone="light" />
          {trailing}
        </div>
      </form>

      <BookingPricingModal
        key={modalKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        arrival={arrival}
        departure={departure}
        email={email}
        source="hero"
      />
    </>
  );
}
