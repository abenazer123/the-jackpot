/**
 * BookingFunnelSteps — shared step content rendered inside either
 * BookingPricingModal (desktop) or BookingBottomSheet (mobile).
 *
 *   1. "collect"  — conditionally gather what the entry point didn't
 *                   capture (dates + email).
 *   2. "checking" — branded starburst pulse → "Your dates are available."
 *                   Quote computes silently in background via draft POST.
 *   3. "form"     — name / phone / guests / reason chips.
 *   4. "success"  — quote reveal: per-person-per-night hero, total,
 *                   savings line. Three reaction paths capture intent +
 *                   budget signal implicitly: "I'm interested" /
 *                   "Send this to my group" / appeal-with-stretch.
 *
 * Entry points pass `initialStep`: hero bar (dates+email captured) lands
 * at "checking"; desktop top bar and mobile peek land at "collect".
 */

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { todayIso } from "./Calendar";
import { DateField, type DateFieldHandle } from "./DateField";
import { HostPresence } from "./HostPresence";
import { useOccasion } from "./OccasionProvider";
import { capture, identify } from "./PostHogProvider";
import { Starburst } from "./Starburst";
import { useUtm } from "./UtmProvider";
import { eventForDates } from "@/lib/chicagoEvents";
import { clearDraft, readDraft, writeDraft } from "@/lib/funnel-draft";
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

interface QuoteNightly {
  date: string;
  rateCents: number;
}

interface QuoteResponse {
  currency: "USD";
  arrival: string;
  departure: string;
  nights: number;
  guests: number;
  nightly: QuoteNightly[];
  subtotalCents: number;
  cleaningCents: number;
  preTaxCents: number;
  taxEnabled: boolean;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  perGuestCents: number;
  savedVsAirbnbCents: number;
  savedVsVrboCents: number;
  pricesAsOf: string;
  stale: boolean;
}

/** Per-person-per-night threshold for the sticker-shock nudge. Default
 *  $300/person/night until we wire pricing_config in to the client. */
const ALT_DATES_THRESHOLD_CENTS = 30000;

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
// Step 2 beat timings — each beat reveals a new layer (pulse → insight →
// teaser frame → resolved checkmark). The window doubles as in-flight
// time for the draft POST; by the time we advance to Step 3 the quote
// JSON is usually already in state.
//
// Cadence intent: this is a "thinking" sequence, not a loading spinner.
// We hold each beat long enough for the visitor to actually read it
// (insight = display italic 7-word line) and to feel that the pulse
// represents real consideration. ~5.3s total — beat 4 (the resolved
// "available" reveal) gets the longest hold so the celebration lands
// before we whisk them off to Step 3.
const STEP2_INSIGHT_MS = 1100;
const STEP2_TEASER_MS = 2300;
const STEP2_RESOLVE_MS = 3500;
const STEP2_ADVANCE_MS = 5300;

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
  // Step 2 beat — drives the staged reveal (pulse → insight → teaser → resolve).
  const [beat, setBeat] = useState<"pulse" | "insight" | "teaser" | "resolve">(
    "pulse",
  );

  // Collected values — may be overridden by Step 1 inputs. Initialized
  // from props; hydrated from the shared draft on mount if props were
  // empty (see first useEffect below).
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

  // Rehydrate from the shared funnel-draft on mount. Parent-provided
  // props (from HeroBookingBar / StickyBookingBar) take precedence so a
  // live-edited value isn't overwritten; anything the parent DIDN'T
  // pre-fill gets pulled from the draft. Runs once per mount — the
  // parent bumps `key` to force a fresh mount per modal open.
  // Deferred via 0ms setTimeout to stay off the effect's synchronous
  // path (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const d = readDraft();
      if (!arrival && d.arrival) setArrival(d.arrival);
      if (!departure && d.departure) setDeparture(d.departure);
      if (!emailInput && d.email) setEmailInput(d.email);
      if (d.name) setName(d.name);
      if (d.phone) setPhone(d.phone);
      if (typeof d.guests === "number" && d.guests >= 1 && d.guests <= 14) {
        setGuests(d.guests);
      }
      if (d.reason && (REASON_OPTIONS as readonly string[]).includes(d.reason)) {
        setReason(d.reason as Reason);
      }
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quote returned from the finalize POST (drives the success-screen
  // reveal). Optional — null if compute failed.
  const [quote, setQuote] = useState<QuoteResponse | null>(null);

  // Reveal-screen interaction state. Each represents a path the visitor
  // can take on the success screen — they map onto Supabase columns +
  // PostHog events for funnel analytics.
  const [appealText, setAppealText] = useState("");
  const [appealStretchLevel, setAppealStretchLevel] = useState<
    "close" | "far" | null
  >(null);
  const [appealSent, setAppealSent] = useState(false);
  const [altDatesSent, setAltDatesSent] = useState(false);
  const [shareRequested, setShareRequested] = useState(false);
  const [interestSent, setInterestSent] = useState(false);

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
  // Server-computed gate signal (true if any night is high-demand or in
  // an active event window). Combined client-side with guests/reason
  // checks to decide whether Step 4 ("shape") should render.
  const needsDates = !arrivalProp || !departureProp;
  const needsEmail = !emailProp;

  // Every step transition is a tracked event — primary funnel signal.
  useEffect(() => {
    capture("booking_funnel_step_viewed", { step, source });
  }, [step, source]);

  // Step 2 beat — staged reveal: pulse → insight → teaser → resolve →
  // advance to Step 3. Each beat fades in a new layer of context so the
  // wait time becomes useful (market signal + savings teaser) instead of
  // an empty spinner.
  //
  // The draft POST fires alongside this animation. If its response lands
  // before the teaser beat, the empty-frame placeholders fill in with
  // real numbers (savedVsAirbnbCents). If it lands later, the teaser
  // resolves with hairlines and the real numbers show up on the success
  // screen.
  //
  // All state changes are wrapped in setTimeout to stay off the effect's
  // synchronous path (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (step !== "checking") return;
    const reduced = prefersReducedMotion();
    const t = reduced
      ? {
          insight: 0,
          teaser: 0,
          resolve: 0,
          advance: 200,
        }
      : {
          insight: STEP2_INSIGHT_MS,
          teaser: STEP2_TEASER_MS,
          resolve: STEP2_RESOLVE_MS,
          advance: STEP2_ADVANCE_MS,
        };
    const tInsight = window.setTimeout(() => setBeat("insight"), t.insight);
    const tTeaser = window.setTimeout(() => setBeat("teaser"), t.teaser);
    const tResolve = window.setTimeout(() => {
      setBeat("resolve");
      setResolving(true);
    }, t.resolve);
    const tAdvance = window.setTimeout(() => setStep("form"), t.advance);

    const draftEmail = (emailProp || emailInput).trim();
    let abortController: AbortController | null = null;
    if (
      !draftFiredRef.current &&
      arrival &&
      departure &&
      draftEmail &&
      inquiryIdRef.current === null
    ) {
      draftFiredRef.current = true;
      abortController = new AbortController();
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
        signal: abortController.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (data: {
            inquiry_id?: string;
            quote?: QuoteResponse | null;
          } | null) => {
            if (data?.inquiry_id) inquiryIdRef.current = data.inquiry_id;
            // Cache the draft quote so the teaser frame + success reveal
            // can render instantly even if the user blasts through Step 3.
            if (data?.quote) setQuote(data.quote);
          },
        )
        .catch((err: unknown) => {
          if ((err as { name?: string }).name !== "AbortError") {
            console.warn("[funnel] draft POST failed", err);
          }
        });
    }

    return () => {
      window.clearTimeout(tInsight);
      window.clearTimeout(tTeaser);
      window.clearTimeout(tResolve);
      window.clearTimeout(tAdvance);
      abortController?.abort();
    };
  }, [step, arrival, departure, emailProp, emailInput, source, attribution]);

  // Reset the Step 2 beat whenever the step transitions away — guarantees
  // the next entry to "checking" replays the staged sequence cleanly.
  useEffect(() => {
    if (step !== "checking") {
      setBeat("pulse");
      setResolving(false);
    }
  }, [step]);

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

  /** Posts to the finalize endpoint with the assembled payload, parses
   *  the response, stores the quote in state. */
  const submitFinalize = async (): Promise<boolean> => {
    const effectiveEmail = (emailProp || emailInput).trim();
    identify(effectiveEmail, { name, phone });
    const body = {
      inquiry_id: inquiryIdRef.current ?? undefined,
      arrival,
      departure,
      email: effectiveEmail,
      name,
      phone,
      guests,
      reason,
      source,
      venue: occasion === "wedding" ? venue.trim() : "",
      attribution,
    };
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `HTTP ${res.status}`);
    }
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      inquiry_id?: string;
      quote?: QuoteResponse | null;
    } | null;
    if (data?.quote) setQuote(data.quote);
    // Capture the row id so success-screen CTA flag updates have
    // something to patch. The DRAFT POST already does this in its
    // own effect — this covers the LEGACY/finalize path that fires
    // when draft was skipped (e.g. funnel jumped straight from
    // collect → form).
    if (data?.inquiry_id && !inquiryIdRef.current) {
      inquiryIdRef.current = data.inquiry_id;
    }
    return true;
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !reason) return;
    if (submitting) return;
    setSubmitError(null);

    setSubmitting(true);
    try {
      await submitFinalize();
      clearDraft();
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

  /** Patches reveal/path fields onto an existing inquiry row.
   *  Sends `flag_update: true` so the API treats it as a sparse PATCH
   *  (no duplicate row, no re-fired host/guest emails — just an update
   *  to the columns this caller cares about, plus a path-signal email
   *  when applicable). */
  const flagInquiry = async (
    fields: Record<string, unknown>,
  ): Promise<void> => {
    if (!inquiryIdRef.current) return;
    try {
      await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flag_update: true,
          inquiry_id: inquiryIdRef.current,
          ...fields,
        }),
      });
    } catch (err) {
      console.warn(`[funnel] flag POST failed`, err);
    }
  };

  const handleAltDates = () => {
    if (altDatesSent) return;
    setAltDatesSent(true);
    capture("alt_dates_nudge_clicked", { source });
    void flagInquiry({ alt_dates_requested: true });
  };

  const handleInterestClick = () => {
    if (interestSent) return;
    setInterestSent(true);
    capture("primary_cta_clicked", {
      path: "interested",
      surface: "quote_reveal",
      total_cents: quote?.totalCents,
      guests,
      nights,
    });
    void flagInquiry({ primary_cta_path: "interested" });
    window.setTimeout(onClose, 4000);
  };

  const handleShareRequest = () => {
    if (shareRequested) return;
    setShareRequested(true);
    capture("share_cta_clicked", {
      path: "share",
      source,
      total_cents: quote?.totalCents,
      guests,
      nights,
    });
    void flagInquiry({
      share_requested: true,
      primary_cta_path: "share",
    });
  };

  const handleAppealSubmit = async () => {
    const text = appealText.trim();
    if (!text || appealSent) return;
    setAppealSent(true);
    capture("appeal_submitted", {
      path: "appeal",
      stretch_level: appealStretchLevel,
      length: text.length,
      source,
    });
    void flagInquiry({
      appeal_text: text,
      appeal_stretch_level: appealStretchLevel ?? undefined,
      primary_cta_path: "appeal",
    });
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
                    writeDraft({ arrival: iso });
                    // Clear stale departure if it's now before the new
                    // minimum — otherwise the auto-opened picker seeds
                    // off the old value and lands on the wrong month.
                    const minNewDep = addDaysIso(iso, MIN_NIGHTS);
                    if (departure && departure < minNewDep) {
                      setDeparture("");
                      writeDraft({ departure: "" });
                    }
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
                  onChange={(iso) => {
                    setDeparture(iso);
                    writeDraft({ departure: iso });
                  }}
                  min={minDeparture}
                  rangeStart={arrival}
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmailInput(v);
                    writeDraft({ email: v.trim() });
                  }}
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

      {/* ================= STEP 2 — CHECKING BEAT =================
          All four beats render as siblings inside a single positioned
          stack — only the active one is opaque + pointer-eventable, the
          rest are opacity 0 and visually hidden. Cross-fade is achieved
          via a CSS opacity transition on every beat (300ms ease), so
          when `beat` flips from A to B you get a 300ms overlap where
          A fades out while B fades in. Avoids the hard-swap pop.       */}
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

            <div className={styles.beatStack}>
              {/* Beat 1 — pulse: just a status line */}
              <div
                className={`${styles.beatLayer} ${beat === "pulse" ? styles.beatActive : ""}`}
              >
                <p className={styles.checkingText}>
                  Checking availability&hellip;
                </p>
              </div>

              {/* Beat 2 — insight pull-quote (demand-aware when quote loaded). */}
              <div
                className={`${styles.beatLayer} ${beat === "insight" ? styles.beatActive : ""}`}
              >
                <div className={styles.insightCard}>
                  <p className={styles.insightText}>
                    {quote
                      ? "High-demand weekend for homes like yours"
                      : "Looking up demand for your dates\u2026"}
                  </p>
                </div>
              </div>

              {/* Beat 3 — empty-frame teaser. Real numbers if the quote
                  arrived in time; gold hairlines otherwise. */}
              <div
                className={`${styles.beatLayer} ${beat === "teaser" ? styles.beatActive : ""}`}
              >
                <div className={styles.teaserCard} aria-hidden="true">
                  <p className={styles.teaserLabel}>Your savings</p>
                  <div className={styles.teaserRows}>
                    <div className={styles.teaserRow}>
                      <span className={styles.teaserRowLabel}>On Airbnb</span>
                      <span className={styles.teaserRowValue}>
                        {quote ? (
                          `$${Math.round((quote.totalCents + quote.savedVsAirbnbCents) / 100).toLocaleString()}`
                        ) : (
                          <span className={styles.teaserHairline} />
                        )}
                      </span>
                    </div>
                    <div className={styles.teaserRow}>
                      <span className={styles.teaserRowLabel}>
                        Direct to Abe
                      </span>
                      <span className={styles.teaserRowValue}>
                        {quote ? (
                          `$${Math.round(quote.totalCents / 100).toLocaleString()}`
                        ) : (
                          <span className={styles.teaserHairline} />
                        )}
                      </span>
                    </div>
                  </div>
                  <span className={styles.srOnly}>
                    Calculating your personalized quote.
                  </span>
                </div>
              </div>

              {/* Beat 4 — resolve. */}
              <div
                className={`${styles.beatLayer} ${beat === "resolve" ? styles.beatActive : ""}`}
              >
                <p className={styles.revealText}>Your dates are available</p>
                {dateRange ? (
                  <p className={styles.revealRange}>
                    {dateRange} &middot; {nights} night{nights === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setName(v);
                    writeDraft({ name: v });
                  }}
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setPhone(v);
                    writeDraft({ phone: v });
                  }}
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
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setGuests(n);
                    writeDraft({ guests: n });
                  }}
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
                    onClick={() => {
                      setReason(opt);
                      writeDraft({ reason: opt });
                    }}
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

      {/* ================= SUCCESS — quote reveal ================= */}
      {step === "success" ? (
        <div className={styles.success} key="success">
          <h2 className={styles.successHeading}>
            Here&rsquo;s your weekend.
          </h2>
          {dateRange ? (
            <p className={styles.successBody}>
              {dateRange} &middot; {nights} night{nights === 1 ? "" : "s"} &middot;{" "}
              {guests} {guests === 1 ? "guest" : "guests"}
            </p>
          ) : null}

          {quote ? (
            <QuoteReveal
              quote={quote}
              utmSource={attribution.utm_source}
              altDatesSent={altDatesSent}
              onAltDates={handleAltDates}
              shareRequested={shareRequested}
              onShareRequest={handleShareRequest}
              appealText={appealText}
              setAppealText={setAppealText}
              appealStretchLevel={appealStretchLevel}
              setAppealStretchLevel={setAppealStretchLevel}
              onAppealSubmit={handleAppealSubmit}
              appealSent={appealSent}
              interestSent={interestSent}
              onInterestClick={handleInterestClick}
              onClose={onClose}
            />
          ) : (
            <>
              <p className={styles.successBody}>
                I&rsquo;ll send your personalized quote to{" "}
                <span className={styles.successEmail}>
                  {emailProp || emailInput}
                </span>{" "}
                within the day.
              </p>
              <button
                type="button"
                className={styles.successLink}
                onClick={onClose}
              >
                In the meantime, keep exploring &rarr;
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// QuoteReveal — the success-screen quote card + expanders + nudges.
// Kept as an inline component so it can stay close to the parent state
// without needing a new file. See docs/guest-experience-ux.md §5 for
// the design rationale and §11.5 for the sticker-shock safety valve.

interface QuoteRevealProps {
  quote: QuoteResponse;
  utmSource?: string;
  // Premium-dates nudge
  altDatesSent: boolean;
  onAltDates: () => void;
  // Path 2 — Send to my group
  shareRequested: boolean;
  onShareRequest: () => void;
  // Path 3 — appeal flow
  appealText: string;
  setAppealText: (s: string) => void;
  appealStretchLevel: "close" | "far" | null;
  setAppealStretchLevel: (lvl: "close" | "far") => void;
  onAppealSubmit: () => void | Promise<void>;
  appealSent: boolean;
  /** Path 1 — "I'm interested" closes the modal/sheet after a brief
   *  acknowledgement. The inquiry email has already fired upstream;
   *  this click is the path commitment + dismissal. Parent fires
   *  analytics + flags the row before calling close. */
  onInterestClick: () => void;
  /** Direct close (used by acknowledgement timer) — same callback the
   *  shell already wires. */
  onClose: () => void;
  /** Tracks whether the primary "I'm interested" CTA has been clicked
   *  so the button can flip to its acknowledgement label. */
  interestSent: boolean;
}

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** Renders a dollar amount with the `$` sign typographically demoted —
 *  smaller and top-aligned — so the digits dominate. Use only for the
 *  hero + secondary numbers in the quote card; plain `fmt()` is fine
 *  elsewhere where the symbol can match the surrounding text size. */
function fmtMoney(cents: number): React.ReactElement {
  const digits = Math.round(cents / 100).toLocaleString("en-US");
  return (
    <>
      <span className={styles.quoteCurrency}>$</span>
      {digits}
    </>
  );
}

/** Which row of the "The details" accordion is open. Single-open
 *  accordion — opening one collapses the others. */
type DetailRow = "nightly" | "included" | "hotel";

function QuoteReveal({
  quote,
  utmSource,
  altDatesSent,
  onAltDates,
  shareRequested,
  onShareRequest,
  appealText,
  setAppealText,
  appealStretchLevel,
  setAppealStretchLevel,
  onAppealSubmit,
  appealSent,
  interestSent,
  onInterestClick,
}: QuoteRevealProps) {
  const splitN = quote.guests;
  const totalCents = quote.totalCents;
  const perPersonTotal = Math.round(totalCents / splitN);
  const perPersonNight = Math.round(perPersonTotal / Math.max(1, quote.nights));

  // For extreme per-person rates with tiny groups, total leads. Default
  // for groups: per-person leads (the number coordinators paste into
  // the group chat).
  const totalLeads = splitN <= 2 && perPersonNight >= 50000;

  // Sticker-shock nudge — fires when the per-person rate is high.
  const showAltNudge = perPersonNight >= ALT_DATES_THRESHOLD_CENTS;

  // Suppress savings-vs-Airbnb when guest came from Airbnb
  const showAirbnbSavings =
    utmSource !== "airbnb" && quote.savedVsAirbnbCents > 0;

  // Hotel-room comparison anchor. $250/night is a mid-market Chicago
  // downtown rate — conservative (on peak dates actual hotels run much
  // higher). We assume 1 room per guest, matching how group coordinators
  // tend to mentally bracket hotel-block math. Only shown when the
  // comparison flatters the quote (≥ 20% advantage).
  const HOTEL_ROOM_NIGHTLY_CENTS = 25000;
  const hotelTotalCents =
    quote.guests * HOTEL_ROOM_NIGHTLY_CENTS * quote.nights;
  const HOTEL_ANCHOR_MIN_ADVANTAGE = 1.2;
  const showHotelAnchor =
    hotelTotalCents > totalCents * HOTEL_ANCHOR_MIN_ADVANTAGE;

  // If the stay overlaps a known Chicago demand event, replace the
  // generic "peak dates" copy with specific context. Suppresses the
  // "suggest alternatives" button for event stays — coordinators
  // booking for Lollapalooza can't shift to a non-Lolla weekend.
  const stayEvent = eventForDates(quote.arrival, quote.departure);

  // Single-open accordion for the bottom "The details" rows.
  const [openDetail, setOpenDetail] = useState<DetailRow | null>(null);
  const toggleDetail = (key: DetailRow) => {
    setOpenDetail((prev) => (prev === key ? null : key));
  };

  // Path 3 — appeal expander state. Local; the textarea + stretch
  // selection only matter inside this expander.
  const [appealOpen, setAppealOpen] = useState(false);

  // Hero / secondary number rendering. The brief calls for a
  // typographically-demoted dollar sign so the digits dominate. The
  // existing `fmtMoney` already does this via `.quoteCurrency`. Keeping
  // it for both branches.
  const heroNumber = totalLeads ? totalCents : perPersonNight;
  const heroLabel = totalLeads ? "total for your group" : "per person per night";
  const secondaryNumber = totalLeads ? perPersonNight : totalCents;
  const secondaryLabel = totalLeads
    ? `per person per night${splitN > 1 ? ` if you split across ${splitN}` : ""}`
    : "total for your group";

  return (
    <div className={styles.quoteWrap}>
      {/* Block 2 — Quote card */}
      <div className={styles.quoteCard}>
        <div className={styles.quoteHero}>{fmtMoney(heroNumber)}</div>
        <div className={styles.quoteHeroSub}>{heroLabel}</div>
        <div className={styles.quoteHeroMeta}>
          {quote.guests} {quote.guests === 1 ? "guest" : "guests"} &middot;{" "}
          {quote.nights} {quote.nights === 1 ? "night" : "nights"}
        </div>

        <div className={styles.quoteSecondaryDivider} />

        <div className={styles.quoteSecondary}>{fmtMoney(secondaryNumber)}</div>
        <div className={styles.quoteSubMeta}>{secondaryLabel}</div>

        {showAirbnbSavings ? (
          <div className={styles.savingsLine}>
            You&rsquo;re saving {fmt(quote.savedVsAirbnbCents)} by booking direct
          </div>
        ) : null}
      </div>

      {/* Block 3 — Premium-dates nudge (between card and split-pay) */}
      {showAltNudge && !altDatesSent ? (
        stayEvent ? (
          <p className={styles.altNudge}>
            <span className={styles.altNudgeText}>
              These are premium dates &mdash; {stayEvent.reason}.
            </span>
          </p>
        ) : (
          <p className={styles.altNudge}>
            <span className={styles.altNudgeText}>
              These are premium dates &mdash; weeknight stays and shoulder
              weekends often run 30&ndash;40% less. Want me to suggest
              alternatives?
            </span>
            <button
              type="button"
              className={styles.altNudgeButton}
              onClick={onAltDates}
            >
              Yes, suggest dates
            </button>
          </p>
        )
      ) : null}
      {altDatesSent ? (
        <p className={styles.altNudgeConfirm}>
          Got it &mdash; I&rsquo;ll reach out with options that fit your group.
        </p>
      ) : null}

      {/* Block 4 — Three CTA paths */}
      <div className={styles.ctaStack}>
        {/* Path 1 — Primary "Hold my dates" CTA. Subhead carries the
            friction-reducer + first-mover positioning. */}
        <button
          type="button"
          className={styles.submit}
          onClick={onInterestClick}
          disabled={interestSent}
        >
          {interestSent
            ? "Got it \u2014 Abe will be in touch"
            : "Hold my dates"}
        </button>
        <p className={styles.ctaSubhead}>
          No commitment yet &mdash; just first dibs.
        </p>

        {/* Path 2 — Secondary "Share with my group". Compact pill
            with a value-prop subhead below mirroring the primary
            CTA's pattern. */}
        <button
          type="button"
          className={styles.shareButton}
          onClick={onShareRequest}
          disabled={shareRequested}
        >
          {shareRequested
            ? "Got it \u2014 Abe will send your trip portal shortly"
            : "Share with my group"}
        </button>
        {!shareRequested ? (
          <p className={styles.shareSubhead}>
            They&rsquo;ll see the price, the photos, and the
            accommodations.
          </p>
        ) : null}

        {/* Path 3 — Appeal. Italic Cormorant copy reads as a personal
            note from Abe; an explicit "Tell me what works" pill below
            it makes the affordance unmistakable so the copy stays
            quiet. */}
        <div className={styles.appealSection}>
          <p className={styles.appealText}>
            If the numbers don&rsquo;t line up, I&rsquo;d rather hear from you
            than lose you. &mdash; Abe
          </p>

          <button
            type="button"
            className={styles.appealTrigger}
            aria-expanded={appealOpen}
            onClick={() => setAppealOpen((v) => !v)}
          >
            Tell Abe what works <span aria-hidden="true">{"\u2192"}</span>
          </button>

          {appealOpen ? (
            appealSent ? (
              <p className={styles.appealConfirm}>
                Got it &mdash; I&rsquo;ll review and reach out personally.
              </p>
            ) : (
              <>
                <span className={styles.appealEyebrow}>How far off are we?</span>
                <div
                  className={styles.stretchOptions}
                  role="radiogroup"
                  aria-label="How far off are we?"
                >
                  {(
                    [
                      ["close", "Close \u2014 just a little above what we planned"],
                      ["far", "Pretty far off from what we had in mind"],
                    ] as ReadonlyArray<["close" | "far", string]>
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={appealStretchLevel === id}
                      className={`${styles.stretchRow} ${appealStretchLevel === id ? styles.stretchRowActive : ""}`}
                      onClick={() => setAppealStretchLevel(id)}
                    >
                      <span className={styles.stretchRadio} aria-hidden="true" />
                      <span className={styles.stretchLabel}>{label}</span>
                    </button>
                  ))}
                </div>

                {appealStretchLevel ? (
                  <div className={styles.appealFollowUp}>
                    <textarea
                      className={styles.appealInput}
                      value={appealText}
                      onChange={(e) => setAppealText(e.target.value)}
                      placeholder="Anything else — flexible dates, shorter stay, smaller group?"
                      rows={2}
                    />
                    <button
                      type="button"
                      className={styles.appealSendLink}
                      onClick={() => void onAppealSubmit()}
                      disabled={!appealText.trim()}
                    >
                      Send to Abe
                    </button>
                  </div>
                ) : null}
              </>
            )
          ) : null}
        </div>

      </div>

      {/* Block 6 — The Details accordion */}
      <div className={styles.detailsSection}>
        <span className={styles.detailsEyebrow}>The details</span>

        {/* Row 1 — Nightly breakdown */}
        <div
          className={`${styles.detailRow} ${openDetail === "nightly" ? styles.detailRowOpen : ""}`}
        >
          <button
            type="button"
            className={styles.detailRowHeader}
            aria-expanded={openDetail === "nightly"}
            onClick={() => toggleDetail("nightly")}
          >
            <span className={styles.detailRowLabel}>Nightly breakdown</span>
            <span className={styles.detailRowCaret} aria-hidden="true">
              {"\u25B8"}
            </span>
          </button>
          {openDetail === "nightly" ? (
            <ul className={styles.breakdownList}>
              {quote.nightly.map((n) => (
                <li key={n.date}>
                  <span>{isoToDisplay(n.date)}</span>
                  <span>{fmt(n.rateCents)}</span>
                </li>
              ))}
              <li className={styles.breakdownLine}>
                <span>Cleaning</span>
                <span>{fmt(quote.cleaningCents)}</span>
              </li>
              {quote.taxEnabled && quote.taxCents > 0 ? (
                <li className={styles.breakdownLine}>
                  <span>Taxes ({(quote.taxRateBps / 100).toFixed(2)}%)</span>
                  <span>{fmt(quote.taxCents)}</span>
                </li>
              ) : null}
              <li className={styles.breakdownTotal}>
                <span>Total</span>
                <span>{fmt(quote.totalCents)}</span>
              </li>
            </ul>
          ) : null}
        </div>

        {/* Row 2 — What's included */}
        <div
          className={`${styles.detailRow} ${openDetail === "included" ? styles.detailRowOpen : ""}`}
        >
          <button
            type="button"
            className={styles.detailRowHeader}
            aria-expanded={openDetail === "included"}
            onClick={() => toggleDetail("included")}
          >
            <span className={styles.detailRowLabel}>What&rsquo;s included</span>
            <span className={styles.detailRowCaret} aria-hidden="true">
              {"\u25B8"}
            </span>
          </button>
          {openDetail === "included" ? (
            <ul className={styles.valueStack}>
              <li>No platform fees &mdash; direct to Abe</li>
              <li>Split-pay across your group available</li>
              <li>Direct line to Abe for any questions</li>
              <li>Flexible check-in</li>
            </ul>
          ) : null}
        </div>

        {/* Row 3 — Hotel comparison (conditional) */}
        {showHotelAnchor ? (
          <div
            className={`${styles.detailRow} ${openDetail === "hotel" ? styles.detailRowOpen : ""}`}
          >
            <button
              type="button"
              className={styles.detailRowHeader}
              aria-expanded={openDetail === "hotel"}
              onClick={() => toggleDetail("hotel")}
            >
              <span className={styles.detailRowLabel}>Hotel comparison</span>
              <span className={styles.detailRowCaret} aria-hidden="true">
                {"\u25B8"}
              </span>
            </button>
            {openDetail === "hotel" ? (
              <p className={styles.hotelAnchor}>
                vs. {quote.guests} hotel rooms at $250/night &times;{" "}
                {quote.nights} nights = {fmt(hotelTotalCents)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
