/**
 * InquiryChatThread — fullscreen mobile dialog that hosts the
 * conversational inquiry flow once a guest taps a chip on the inline
 * InquiryChat card.
 *
 * Steps:
 *   "dates"     — guest picks arrival + departure on the inline calendar
 *                 (or types dates in the composer, parser TBD).
 *   "checking"  — picked range becomes a user bubble; mocked availability
 *                 check runs while we ask for name / email / phone
 *                 "in case we get disconnected."
 *   "available" — contact captured + (mocked) availability confirmed.
 *                 Contact form collapses to a summary bubble + success
 *                 banner. Olivia greets by first name when we have it
 *                 and asks for group size + occasion so we can pull a
 *                 real price.
 *   "pricing"   — group + occasion answered. Widget collapses to a
 *                 summary bubble. Pricing-check pill runs; price-reveal
 *                 widget lands in the next round.
 *
 * Every committed answer becomes a permanent user bubble — the history
 * accumulates as you'd expect from any real chat thread. New blocks
 * fade in via .fadeIn rather than landing all at once.
 *
 * Lifecycle mirrors BookingBottomSheet — native <dialog> with
 * showModal()/close() driven by the `open` prop. Focus trap, ESC, and
 * body scroll lock all come from the platform.
 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Calendar, todayIso } from "./Calendar";
import styles from "./InquiryChatThread.module.css";

interface InquiryChatThreadProps {
  open: boolean;
  onClose: () => void;
}

type DateFocus = "arrival" | "departure";
type Step = "dates" | "checking" | "available" | "pricing";

/** Minimal mirror of the harness TurnMessage shape for the chat layer.
 *  Kept local so the client bundle doesn't pull server-only modules. */
interface HarnessMessage {
  role: "user" | "olivia" | "system";
  body: string;
  ts: string;
  widget?: string;
}

/**
 * Reveal phases inside the "checking" step. Each new beat fades into the
 * conversation rather than landing all at once.
 *   0 — Olivia "typing" right after the user commits dates.
 *   1 — Her first reply + the animated availability pill arrive; she
 *       starts "typing" the follow-up while the pill keeps running.
 *   2 — Her follow-up message has arrived; a beat passes.
 *   3 — Contact form slides in.
 */
type CheckingPhase = 0 | 1 | 2 | 3;

/**
 * Reveal phases inside the "available" step (after contact is saved).
 *   0 — Olivia "typing" the good-news reply.
 *   1 — "Good news, [first name] — wide open. Two quick things…" lands.
 *   2 — Group + occasion chip widget slides in.
 */
type AvailablePhase = 0 | 1 | 2;

const MIN_NIGHTS = 2;

/** Reveal timings (ms). Tuned to feel like Olivia is "writing" — short
 *  enough that the wait doesn't feel padded, long enough that the
 *  sequence reads as conversation rather than a script. */
const CHECKING_PHASE_DELAYS = {
  typingOne: 800, // 0 → 1
  beatToTyping: 1500, // 1 → 2
  beatToForm: 700, // 2 → 3
} as const;

const AVAILABLE_PHASE_DELAYS = {
  typing: 800, // 0 → 1
  beatToWidget: 900, // 1 → 2
} as const;

/** Chip options for the group/occasion widget. Group buckets mirror what
 *  the booking funnel uses elsewhere; occasions are the four we hear
 *  most in inbound messages today. */
const GROUP_OPTIONS = ["6\u20138", "9\u201311", "12\u201314"] as const;
const OCCASION_OPTIONS = [
  "Bachelor",
  "Bachelorette",
  "Wedding",
  "Other",
] as const;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRangeShort(arrival: string, departure: string): string {
  if (!arrival || !departure) return "";
  return `${formatShort(arrival)} \u2013 ${formatShort(departure)}`;
}

function formatRangeLong(arrival: string, departure: string): string {
  if (!arrival || !departure) return "";
  return `${formatDisplay(arrival)} to ${formatDisplay(departure)}`;
}

/** First name from whatever the guest typed in the contact form — used
 *  sparingly to make Olivia's replies feel addressed rather than
 *  templated. Empty string when no name was provided; callers should
 *  gate name-bearing copy on `firstName` truthy. */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "";
}

/** Compact one-line summary for the collapsed contact bubble: name +
 *  email + optional phone joined by middle dots. Skips empty fields so
 *  guests who only filled email don't get awkward "·  · marcus@…". */
function formatContactSummary(
  name: string,
  email: string,
  phone: string,
): string {
  const parts = [name.trim(), email.trim(), phone.trim()].filter(Boolean);
  return parts.join(" \u00b7 ");
}

/** Translate the scripted step machine into the harness phase enum
 *  (matches the CHECK constraint in supabase/migrations/...inquiry_agent_tables.sql).
 *  The "pricing" step maps to "post_price" since by the time pricing
 *  renders, the price card has been shown. */
function stepToPhase(step: Step): string {
  switch (step) {
    case "dates":
      return "state1";
    case "checking":
      return "checking";
    case "available":
      return "available";
    case "pricing":
      return "post_price";
  }
}

// Lightweight email validity — must contain `@` and a `.` after it.
// Real validation happens server-side; we only gate the Save button.
function looksLikeEmail(s: string): boolean {
  const v = s.trim();
  if (v.length < 5) return false;
  const at = v.indexOf("@");
  if (at <= 0) return false;
  const dot = v.indexOf(".", at);
  return dot > at + 1 && dot < v.length - 1;
}

/** Typing-indicator bubble — three pulsing dots inside an assistant-
 *  style bubble that fills the slot for an upcoming Olivia message.
 *  Lives at module scope so React doesn't remount and re-create the dot
 *  animations on every parent re-render. */
function OliviaTyping() {
  return (
    <div className={`${styles.msgRow} ${styles.fadeIn}`}>
      <div className={styles.msgAvatar} aria-hidden="true">
        O
      </div>
      <div
        className={styles.typingBubble}
        role="status"
        aria-label="Olivia is typing"
      >
        <span className={styles.typingDot} aria-hidden="true" />
        <span className={styles.typingDot} aria-hidden="true" />
        <span className={styles.typingDot} aria-hidden="true" />
      </div>
    </div>
  );
}

export function InquiryChatThread({ open, onClose }: InquiryChatThreadProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [focus, setFocus] = useState<DateFocus>("arrival");
  const [draft, setDraft] = useState("");
  const [step, setStep] = useState<Step>("dates");
  const [checkingPhase, setCheckingPhase] = useState<CheckingPhase>(0);
  const [availablePhase, setAvailablePhase] = useState<AvailablePhase>(0);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [occasion, setOccasion] = useState("");

  // Harness layer — every composer send goes through /api/inquiry-agent/turn.
  // The scripted step machine above (dates → checking → available → pricing)
  // stays in place; harness messages render below the scripted content,
  // accumulating across the dialog's lifetime.
  const [harnessSessionId, setHarnessSessionId] = useState<string | null>(null);
  const [harnessMessages, setHarnessMessages] = useState<HarnessMessage[]>([]);
  const [isWaitingForOlivia, setIsWaitingForOlivia] = useState(false);

  const firstName = firstNameOf(contactName);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reset local state every time the dialog opens so a guest who backs
  // out and re-enters starts fresh. Deferred via 0ms setTimeout to stay
  // off the effect's synchronous path (same react-hooks/set-state-in-
  // effect pattern HeroBookingBar uses for its draft hydration).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setArrival("");
      setDeparture("");
      setFocus("arrival");
      setDraft("");
      setStep("dates");
      setCheckingPhase(0);
      setAvailablePhase(0);
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setGroupSize("");
      setOccasion("");
      setHarnessSessionId(null);
      setHarnessMessages([]);
      setIsWaitingForOlivia(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Auto-scroll the conversation to the bottom whenever new content
  // appears (step OR phase transition). Defer to next frame so layout
  // settles first and the new block has measurable height.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const id = window.requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
    return () => window.cancelAnimationFrame(id);
  }, [step, checkingPhase, availablePhase, harnessMessages.length, isWaitingForOlivia]);

  // Drip-feed the "checking" step: typing dots → first Olivia reply +
  // availability pill → typing dots again → second Olivia reply →
  // contact form. Cleared on unmount or if the dialog closes mid-flow.
  // Honors prefers-reduced-motion by jumping straight to the final phase.
  useEffect(() => {
    if (step !== "checking") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = window.setTimeout(() => setCheckingPhase(3), 0);
      return () => window.clearTimeout(t);
    }
    const t1 = CHECKING_PHASE_DELAYS.typingOne;
    const t2 = t1 + CHECKING_PHASE_DELAYS.beatToTyping;
    const t3 = t2 + CHECKING_PHASE_DELAYS.beatToForm;
    const timers = [
      window.setTimeout(() => setCheckingPhase(1), t1),
      window.setTimeout(() => setCheckingPhase(2), t2),
      window.setTimeout(() => setCheckingPhase(3), t3),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [step]);

  // Same drip pattern for the "available" step: typing → Olivia's
  // good-news reply → group/occasion widget. Same reduced-motion bypass.
  useEffect(() => {
    if (step !== "available") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = window.setTimeout(() => setAvailablePhase(2), 0);
      return () => window.clearTimeout(t);
    }
    const t1 = AVAILABLE_PHASE_DELAYS.typing;
    const t2 = t1 + AVAILABLE_PHASE_DELAYS.beatToWidget;
    const timers = [
      window.setTimeout(() => setAvailablePhase(1), t1),
      window.setTimeout(() => setAvailablePhase(2), t2),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [step]);

  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  const today = todayIso();
  const minDeparture = useMemo(
    () => (arrival ? addDaysIso(arrival, MIN_NIGHTS) : today),
    [arrival, today],
  );

  const calendarValue = focus === "arrival" ? arrival : departure;
  const calendarMin = focus === "arrival" ? today : minDeparture;
  const calendarRangeStart = focus === "departure" ? arrival : undefined;

  const handleCalendarSelect = (iso: string) => {
    if (focus === "arrival") {
      setArrival(iso);
      const nextMinDep = addDaysIso(iso, MIN_NIGHTS);
      if (departure && departure < nextMinDep) {
        setDeparture("");
      }
      setFocus("departure");
      return;
    }
    setDeparture(iso);
    // Picking departure commits the range and kicks the mocked
    // availability + pricing check. Real API call goes here later.
    setCheckingPhase(0);
    setStep("checking");
  };

  const canSend = draft.trim().length > 0 && !isWaitingForOlivia;
  const handleSubmitDraft = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSend) return;

    const body = draft.trim();
    setDraft("");

    const userMsg: HarnessMessage = {
      role: "user",
      body,
      ts: new Date().toISOString(),
    };

    // Echo the user bubble immediately + show typing dots.
    setHarnessMessages((prev) => [...prev, userMsg]);
    setIsWaitingForOlivia(true);

    // Build the client_context slot bundle from current local state so
    // the harness can see what the scripted widgets already committed.
    const slots: Record<string, unknown> = {};
    if (arrival) slots.arrival = arrival;
    if (departure) slots.departure = departure;
    if (contactName) slots.name = contactName;
    if (contactEmail) slots.email = contactEmail;
    if (contactPhone) slots.phone = contactPhone;
    if (groupSize) slots.guest_count = Number.parseInt(groupSize, 10) || groupSize;
    if (occasion) slots.occasion = occasion;

    try {
      const res = await fetch("/api/inquiry-agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: harnessSessionId,
          message: userMsg,
          client_context: {
            phase: stepToPhase(step),
            slots,
            viewport: "mobile",
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: { session_id: string; messages: HarnessMessage[] } = await res.json();

      // First successful turn fixes the session ID for the rest of the dialog.
      if (!harnessSessionId) setHarnessSessionId(data.session_id);
      setHarnessMessages((prev) => [...prev, ...data.messages]);
    } catch {
      // Network or server failure — surface a soft fallback bubble so
      // the guest doesn't see silence. Don't surface raw error details.
      setHarnessMessages((prev) => [
        ...prev,
        {
          role: "olivia",
          body: "Hmm — I lost my signal for a beat. Mind sending that again?",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsWaitingForOlivia(false);
    }
  };

  const canSaveContact = looksLikeEmail(contactEmail);
  const handleSaveContact = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSaveContact) return;
    // Persistence + CRM sync lives in a later task. Today the save
    // simply advances the conversation: the form collapses into a
    // summary bubble and Olivia greets the guest by name.
    setAvailablePhase(0);
    setStep("available");
  };

  const canContinueOptions = !!groupSize && !!occasion;
  const handleContinueOptions = () => {
    if (!canContinueOptions) return;
    // Widget collapses into a "groupSize · occasion" user bubble and
    // we kick into the pricing-check beat. Price reveal widget lands
    // in the next round.
    setStep("pricing");
  };

  const contactSummary = formatContactSummary(
    contactName,
    contactEmail,
    contactPhone,
  );

  // Olivia's "good news" reply — softened with the guest's first name
  // when we have it. Kept sparingly elsewhere so the rapport doesn't
  // feel performed.
  const goodNewsGreeting = firstName
    ? `Good news, ${firstName} \u2014 `
    : "Good news \u2014 ";

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleDialogClick}
      aria-label="Chat with Olivia"
    >
      <div className={styles.sheet}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={onClose}
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.headerTeam}>
            <div className={styles.avatar} aria-hidden="true">
              O
            </div>
            <div className={styles.who}>
              <span className={styles.name}>Olivia</span>
              <span className={styles.status}>
                <span className={styles.statusDot} aria-hidden="true" />
                Active now
              </span>
            </div>
          </div>
        </div>

        <div className={styles.body} ref={bodyRef}>
          {/* Initial exchange — always visible across every step. */}
          <div className={styles.msgUserRow}>
            <div className={styles.msgUserBubble}>Check dates &amp; price</div>
          </div>

          <div className={styles.msgRow}>
            <div className={styles.msgAvatar} aria-hidden="true">
              O
            </div>
            <div className={styles.msgBubble}>
              Cool &mdash; what weekend? Pick anything and I&apos;ll pull a
              real number.
            </div>
          </div>

          {/* Step "dates" — inline calendar block. Collapses to a user
              bubble (rendered below) the moment a departure is picked. */}
          {step === "dates" && (
            <div className={styles.dateBlock}>
              <div className={styles.dateFields}>
                <button
                  type="button"
                  className={styles.dateField}
                  data-active={focus === "arrival" ? "true" : undefined}
                  onClick={() => setFocus("arrival")}
                >
                  <span className={styles.dateLabel}>Arrival</span>
                  <span
                    className={styles.dateValue}
                    data-empty={arrival ? "false" : "true"}
                  >
                    {arrival ? formatDisplay(arrival) : "Pick a date"}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.dateField}
                  data-active={focus === "departure" ? "true" : undefined}
                  onClick={() => setFocus("departure")}
                >
                  <span className={styles.dateLabel}>Departure</span>
                  <span
                    className={styles.dateValue}
                    data-empty={departure ? "false" : "true"}
                  >
                    {departure ? formatDisplay(departure) : "Pick a date"}
                  </span>
                </button>
              </div>

              <Calendar
                inline
                value={calendarValue}
                min={calendarMin}
                rangeStart={calendarRangeStart}
                onSelect={handleCalendarSelect}
              />
            </div>
          )}

          {/* Committed dates user bubble — stays visible from "checking"
              onward as part of the chat history. */}
          {step !== "dates" && (
            <div className={styles.msgUserRow}>
              <div className={styles.msgUserBubble}>
                {formatRangeShort(arrival, departure)}
              </div>
            </div>
          )}

          {/* Step "checking" — drip-fed reveal of Olivia's reply, the
              availability pill, her follow-up, and the contact form. */}
          {step === "checking" && (
            <>
              {checkingPhase === 0 && <OliviaTyping />}

              {checkingPhase >= 1 && (
                <>
                  <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                    <div className={styles.msgAvatar} aria-hidden="true">
                      O
                    </div>
                    <div className={styles.msgBubble}>
                      Got it &mdash; {formatRangeLong(arrival, departure)}.
                      Pulling availability + pricing now&hellip;
                    </div>
                  </div>

                  <div
                    className={`${styles.checking} ${styles.fadeIn}`}
                    role="status"
                    aria-live="polite"
                  >
                    <span className={styles.checkingDots} aria-hidden="true">
                      <span className={styles.checkingDot} />
                      <span className={styles.checkingDot} />
                      <span className={styles.checkingDot} />
                    </span>
                    <span className={styles.checkingText}>
                      Checking the calendar&hellip;
                    </span>
                  </div>
                </>
              )}

              {checkingPhase === 1 && <OliviaTyping />}

              {checkingPhase >= 2 && (
                <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                  <div className={styles.msgAvatar} aria-hidden="true">
                    O
                  </div>
                  <div className={styles.msgBubble}>
                    <em>
                      While I look &mdash; where can I reach you? In case we
                      get disconnected, I&apos;ll send the full answer your
                      way.
                    </em>
                  </div>
                </div>
              )}

              {checkingPhase >= 3 && (
                <form
                  className={`${styles.contactForm} ${styles.fadeIn}`}
                  onSubmit={handleSaveContact}
                  aria-label="Your contact info"
                >
                  <label className={styles.contactRow}>
                    <span className={styles.contactLabel}>Name</span>
                    <input
                      type="text"
                      className={styles.contactInput}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </label>
                  <label className={styles.contactRow}>
                    <span className={styles.contactLabel}>Email</span>
                    <input
                      type="email"
                      className={styles.contactInput}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      required
                    />
                  </label>
                  <label className={styles.contactRow}>
                    <span className={styles.contactLabel}>
                      Phone{" "}
                      <span className={styles.contactOptional}>optional</span>
                    </span>
                    <input
                      type="tel"
                      className={styles.contactInput}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(555) 123-4567"
                    />
                  </label>

                  <button
                    type="submit"
                    className={styles.contactSubmit}
                    disabled={!canSaveContact}
                  >
                    Save my info
                  </button>
                </form>
              )}
            </>
          )}

          {/* Collapsed contact form — once we move past "checking", the
              form is replaced by a compact user-bubble summary and a
              sage success line that stays in the chat history. */}
          {(step === "available" || step === "pricing") && (
            <>
              <div className={`${styles.msgUserRow} ${styles.fadeIn}`}>
                <div className={styles.msgUserBubble}>{contactSummary}</div>
              </div>
              <div
                className={`${styles.successInline} ${styles.fadeIn}`}
                role="status"
              >
                <span className={styles.successTick} aria-hidden="true">
                  &#10003;
                </span>
                Got it &mdash; the answer will land in your inbox too.
              </div>
            </>
          )}

          {/* Step "available" — drip-fed Olivia greeting + group/occasion
              widget. Persists into "pricing" as collapsed history below. */}
          {step === "available" && (
            <>
              {availablePhase === 0 && <OliviaTyping />}

              {availablePhase >= 1 && (
                <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                  <div className={styles.msgAvatar} aria-hidden="true">
                    O
                  </div>
                  <div className={styles.msgBubble}>
                    {goodNewsGreeting}
                    {formatRangeLong(arrival, departure)} is wide open. Two
                    quick things so I can pull your most accurate price:{" "}
                    <em>your group size and what you&apos;re celebrating.</em>
                  </div>
                </div>
              )}

              {availablePhase >= 2 && (
                <div className={`${styles.optionsBlock} ${styles.fadeIn}`}>
                  <div className={styles.optionsGroup}>
                    <p className={styles.optionsLabel}>How big&apos;s the group</p>
                    <div className={styles.optionsChips}>
                      {GROUP_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={styles.optionChip}
                          data-selected={groupSize === opt ? "true" : undefined}
                          onClick={() => setGroupSize(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.optionsGroup}>
                    <p className={styles.optionsLabel}>What&apos;s the occasion</p>
                    <div className={styles.optionsChips}>
                      {OCCASION_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={styles.optionChip}
                          data-selected={occasion === opt ? "true" : undefined}
                          onClick={() => setOccasion(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.optionsContinue}
                    disabled={!canContinueOptions}
                    onClick={handleContinueOptions}
                  >
                    Continue
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step "pricing" — group/occasion widget collapses to a
              summary bubble; pricing-check pill spins. Price-reveal
              widget arrives in the next round. */}
          {step === "pricing" && (
            <>
              <div className={`${styles.msgUserRow} ${styles.fadeIn}`}>
                <div className={styles.msgUserBubble}>
                  {groupSize} guests &middot; {occasion}
                </div>
              </div>

              <div
                className={`${styles.checking} ${styles.fadeIn}`}
                role="status"
                aria-live="polite"
              >
                <span className={styles.checkingDots} aria-hidden="true">
                  <span className={styles.checkingDot} />
                  <span className={styles.checkingDot} />
                  <span className={styles.checkingDot} />
                </span>
                <span className={styles.checkingText}>
                  Pulling pricing now&hellip;
                </span>
              </div>
            </>
          )}

          {/* Harness layer — every composer send produces a user
              bubble + Olivia reply that renders here, after the
              scripted step content. Accumulates for the life of the
              dialog. Typing dots fill the real LLM latency. */}
          {harnessMessages.map((msg, idx) =>
            msg.role === "user" ? (
              <div
                key={`harness-${idx}-${msg.ts}`}
                className={`${styles.msgUserRow} ${styles.fadeIn}`}
              >
                <div className={styles.msgUserBubble}>{msg.body}</div>
              </div>
            ) : (
              <div
                key={`harness-${idx}-${msg.ts}`}
                className={`${styles.msgRow} ${styles.fadeIn}`}
              >
                <div className={styles.msgAvatar} aria-hidden="true">
                  O
                </div>
                <div className={styles.msgBubble}>{msg.body}</div>
              </div>
            ),
          )}

          {isWaitingForOlivia && <OliviaTyping />}
        </div>

        <form className={styles.composer} onSubmit={handleSubmitDraft}>
          <input
            type="text"
            className={styles.input}
            placeholder={
              step === "dates"
                ? "Or type your dates\u2026"
                : "Or ask anything\u2026"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Message Olivia"
          />
          <button
            type="submit"
            className={styles.send}
            data-active={canSend || undefined}
            disabled={!canSend}
            aria-label="Send message"
          >
            &uarr;
          </button>
        </form>
      </div>
    </dialog>
  );
}
