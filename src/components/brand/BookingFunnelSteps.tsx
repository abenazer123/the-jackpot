/**
 * BookingFunnelSteps — shared step content rendered inside either
 * BookingPricingModal (desktop) or BookingBottomSheet (mobile). Three
 * meaningful beats:
 *
 *   1. "collect" — conditionally gather what the entry point didn't
 *      capture (dates + email for the mobile peek; email only for the
 *      desktop top bar).
 *   2. "checking" — a branded starburst pulse (~900ms), then a resolve
 *      into "Your dates are available" with a warm gold glow. Every
 *      inquiry gets to this reveal; actual availability is handled in
 *      the host's personal follow-up.
 *   3. "form" — name / phone / guests / reason chips → success.
 *
 * Entry points pass `initialStep`: hero bar (dates+email captured) lands
 * at "checking"; desktop top bar (dates only) and mobile peek (nothing)
 * land at "collect".
 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { todayIso } from "./Calendar";
import { DateField, type DateFieldHandle } from "./DateField";
import { HostPresence } from "./HostPresence";
import { useOccasion } from "./OccasionProvider";
import { capture, identify } from "./PostHogProvider";
import { Starburst } from "./Starburst";
import { useUtm } from "./UtmProvider";
import styles from "./BookingFunnelSteps.module.css";

/** Which surface triggered the funnel — forwarded to analytics + the API
 *  route so we can attribute leads to their acquisition point. */
export type BookingSource = "hero" | "sticky_desktop" | "peek_mobile";

const REASON_OPTIONS = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Bachelor/ette",
  "Family trip",
  "Work retreat",
  "Getaway",
  "Other",
] as const;

type Reason = (typeof REASON_OPTIONS)[number];
export type FunnelStep = "collect" | "checking" | "form" | "success";

interface BookingFunnelStepsProps {
  /** Prefilled at the entry point; may be empty. */
  arrival: string;
  departure: string;
  email: string;
  /** Which step to land on when the funnel opens. */
  initialStep: FunnelStep;
  /** Acquisition surface — tagged onto analytics events + the Supabase row. */
  source?: BookingSource;
  /** Called when the user chooses "Keep exploring" in the success state. */
  onClose: () => void;
}

const MIN_NIGHTS = 2;
const CHECKING_MS = 900;
const REVEAL_HOLD_MS = 600;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function nightsBetween(arrival: string, departure: string): number {
  if (!arrival || !departure) return 0;
  const a = new Date(arrival + "T00:00:00");
  const b = new Date(departure + "T00:00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function BookingFunnelSteps({
  arrival: arrivalProp,
  departure: departureProp,
  email: emailProp,
  initialStep,
  source,
  onClose,
}: BookingFunnelStepsProps) {
  const [step, setStep] = useState<FunnelStep>(initialStep);
  const [resolving, setResolving] = useState(false);

  // Collected values — may be overridden by Step 1 inputs.
  const [arrival, setArrival] = useState(arrivalProp);
  const [departure, setDeparture] = useState(departureProp);
  const [emailInput, setEmailInput] = useState(emailProp);

  // Step 3 form state.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(2);
  const [reason, setReason] = useState<Reason | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Wedding venue lives in the page-level OccasionProvider so both the
  // OccasionSelector and the funnel can access it. Non-wedding visitors
  // leave it empty.
  const { occasion, venue } = useOccasion();

  // UTM + referrer + landing/current path — captured at first-landing in
  // UtmProvider (localStorage, 30-day sliding window) and read here at
  // submit time. Spread into the POST body so the API route can attach
  // attribution to the Supabase row, host email, and PostHog event.
  const attribution = useUtm();

  // Departure auto-open handle — fired after arrival is picked in Step 1.
  const departureRef = useRef<DateFieldHandle>(null);

  // ID returned by the draft POST (Step 2 entry). Threaded into the Step 3
  // finalize request so the server updates the same row instead of inserting
  // a new one. Null until the draft round-trip resolves; null also means
  // "fall back to legacy one-shot INSERT" on finalize.
  const inquiryIdRef = useRef<string | null>(null);
  // Prevents the draft from firing twice if the "checking" effect re-runs.
  const draftFiredRef = useRef(false);

  const needsDates = !arrivalProp || !departureProp;
  const needsEmail = !emailProp;

  // Every step transition is a tracked event — primary funnel signal.
  useEffect(() => {
    capture("booking_funnel_step_viewed", { step, source });
  }, [step, source]);

  // Step 2 beat: pulse → resolve → auto-advance to Step 3. Both
  // state changes happen inside setTimeout callbacks to stay off the
  // effect's synchronous path (react-hooks/set-state-in-effect).
  //
  // We also fire the DRAFT POST here — the moment we have dates + email
  // and have landed on the "checking" step, we can prefetch the quote
  // and park a partial row in Supabase. Runs in parallel with the
  // animation so the guest never waits on it. Response stored in
  // inquiryIdRef for the Step 3 finalize call to thread back.
  useEffect(() => {
    if (step !== "checking") return;
    const reduced = prefersReducedMotion();
    const resolveDelay = reduced ? 0 : CHECKING_MS;
    const advanceDelay = resolveDelay + REVEAL_HOLD_MS;
    const t1 = window.setTimeout(() => setResolving(true), resolveDelay);
    const t2 = window.setTimeout(() => setStep("form"), advanceDelay);

    const draftEmail = (emailProp || emailInput).trim();
    if (
      !draftFiredRef.current &&
      arrival &&
      departure &&
      draftEmail &&
      inquiryIdRef.current === null
    ) {
      draftFiredRef.current = true;
      const controller = new AbortController();
      fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: true,
          arrival,
          departure,
          email: draftEmail,
          source,
          attribution,
        }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { inquiry_id?: string } | null) => {
          if (data?.inquiry_id) inquiryIdRef.current = data.inquiry_id;
        })
        .catch((err: unknown) => {
          if ((err as { name?: string }).name !== "AbortError") {
            console.warn("[funnel] draft POST failed", err);
          }
        });
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        controller.abort();
      };
    }

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [step, arrival, departure, emailProp, emailInput, source, attribution]);

  const dateRange =
    arrival && departure
      ? `${isoToDisplay(arrival)} – ${isoToDisplay(departure)}`
      : "";
  const nights = nightsBetween(arrival, departure);
  // No past dates anywhere. Departure floors at arrival+MIN_NIGHTS when
  // arrival is set, otherwise at today.
  const today = todayIso();
  const minDeparture = arrival ? addDaysIso(arrival, MIN_NIGHTS) : today;

  const handleCollectSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (needsDates && (!arrival || !departure)) return;
    if (needsEmail && !emailInput.trim()) return;
    setStep("checking");
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !reason) return;
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    const effectiveEmail = (emailProp || emailInput).trim();
    // Tie this anonymous session to the guest's email in PostHog.
    identify(effectiveEmail, { name, phone });
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // If the draft POST (fired during Step 2) succeeded, this id
          // lets the server update that same row instead of inserting a
          // new one. Absent = legacy one-shot path.
          inquiry_id: inquiryIdRef.current ?? undefined,
          arrival,
          departure,
          email: effectiveEmail,
          name,
          phone,
          guests,
          reason,
          source,
          // Wedding-only field — venue name from OccasionSelector's input.
          venue: occasion === "wedding" ? venue.trim() : "",
          attribution,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `HTTP ${res.status}`);
      }
      setStep("success");
    } catch (err) {
      console.error("inquiry submit failed", err);
      setSubmitError(
        "We couldn\u2019t send that \u2014 give it another try, or email abe@thejackpotchi.com directly.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      {/* ================= STEP 1 — COLLECT ================= */}
      {step === "collect" ? (
        <div className={styles.step} key="collect">
          <div className={styles.intro}>
            <h2 className={styles.heading}>
              {needsDates
                ? "Let\u2019s check your dates."
                : "One more thing before we check."}
            </h2>
            <p className={styles.subHeadline}>
              We&rsquo;ll build you a personal pricing guide &mdash; itemized,
              accurate, within minutes.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleCollectSubmit} noValidate>
            {needsDates ? (
              <div className={styles.row2}>
                <DateField
                  label="Arrival"
                  value={arrival}
                  onChange={(iso) => {
                    setArrival(iso);
                    window.setTimeout(
                      () => departureRef.current?.open(),
                      150,
                    );
                  }}
                  min={today}
                />
                <DateField
                  ref={departureRef}
                  label="Departure"
                  value={departure}
                  onChange={setDeparture}
                  min={minDeparture}
                />
              </div>
            ) : null}

            {needsEmail ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email</span>
                <input
                  type="email"
                  className={styles.input}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                />
              </label>
            ) : null}

            <button
              type="submit"
              className={styles.submit}
              disabled={
                (needsDates && (!arrival || !departure)) ||
                (needsEmail && !emailInput.trim())
              }
            >
              Check availability
            </button>
          </form>
        </div>
      ) : null}

      {/* ================= STEP 2 — CHECKING BEAT ================= */}
      {step === "checking" ? (
        <div className={styles.step} key="checking">
          <div className={styles.checking} aria-live="polite">
            <span
              className={`${styles.pulseWrap} ${resolving ? styles.resolving : styles.pulsing}`}
            >
              <Starburst
                size={14}
                tier={8}
                color="#d4a930"
                secondary="#e8a040"
                center="#ff9050"
                axisOpacity={1}
                diagOpacity={0.75}
                terOpacity={0.55}
              />
            </span>
            {resolving ? (
              <>
                <p className={styles.revealText}>Your dates are available</p>
                {dateRange ? (
                  <p className={styles.revealRange}>
                    {dateRange} &middot; {nights} night{nights === 1 ? "" : "s"}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ================= STEP 3 — FORM ================= */}
      {step === "form" ? (
        <div className={styles.step} key="form">
          <div className={styles.intro}>
            <h2 className={styles.heading}>
              A few details for your pricing guide
            </h2>
            <p className={styles.subHeadline}>
              So we can make it accurate and personal.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleFormSubmit} noValidate>
            <div className={styles.row2}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Name</span>
                <input
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Phone</span>
                <input
                  type="tel"
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Guests</span>
              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                >
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
                <svg
                  className={styles.selectChevron}
                  viewBox="0 0 12 8"
                  aria-hidden="true"
                >
                  <path
                    d="M1 1l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </label>

            <div className={styles.reasonGroup}>
              <span className={styles.reasonLabel}>
                What are you celebrating?
              </span>
              <div className={styles.chips} role="radiogroup" aria-label="Reason for booking">
                {REASON_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={reason === opt}
                    className={`${styles.chip} ${reason === opt ? styles.chipActive : ""}`}
                    onClick={() => setReason(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <HostPresence variant="full" />

            <button
              type="submit"
              className={styles.submit}
              disabled={!name.trim() || !phone.trim() || !reason || submitting}
            >
              {submitting ? "Sending\u2026" : "Send my pricing guide"}
            </button>

            {submitError ? (
              <p className={styles.submitError} role="alert">
                {submitError}
              </p>
            ) : null}

            <p className={styles.consent}>
              By submitting, you agree to receive your pricing guide via email.
            </p>
          </form>
        </div>
      ) : null}

      {/* ================= SUCCESS ================= */}
      {step === "success" ? (
        <div className={styles.success} key="success">
          <span className={styles.successMark}>
            <Starburst
              size={16}
              tier={8}
              color="#d4a930"
              secondary="#e8a040"
              center="#ff9050"
              axisOpacity={1}
              diagOpacity={0.75}
              terOpacity={0.55}
            />
          </span>
          <h2 className={styles.successHeading}>
            Your pricing guide is on its way
          </h2>
          <p className={styles.successBody}>
            We&rsquo;ll send it to{" "}
            <span className={styles.successEmail}>
              {emailProp || emailInput}
            </span>{" "}
            within minutes.
          </p>
          <button
            type="button"
            className={styles.successLink}
            onClick={onClose}
          >
            In the meantime, keep exploring &rarr;
          </button>
        </div>
      ) : null}
    </div>
  );
}
