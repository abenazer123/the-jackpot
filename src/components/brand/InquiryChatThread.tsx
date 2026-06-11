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
 * Renders as a full-page surface on its own route (/chat/session), not
 * a modal over the marketing page, so there is no background to scroll.
 * The `open` prop is passed true on mount; the existing open-keyed
 * effects (reset, drip-feed, intent-fire, the epoch guard) run once when
 * the page mounts. `onClose` is wired to a back control that routes to
 * /chat.
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

import Image from "next/image";

import { COVER_PHOTO } from "@/lib/property/photos";

import { Calendar, todayIso } from "./Calendar";
import styles from "./InquiryChatThread.module.css";

interface InquiryChatThreadProps {
  open: boolean;
  onClose: () => void;
  /** When set, fires a synthetic system event to the harness on
   *  open so Olivia composes the right opener. Used by InquiryChat's
   *  entry chips ("Send this to my group" → "share", "Reserve now"
   *  → "reserve"). */
  initialIntent?: "share" | "reserve" | null;
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

/** Subset of the server's Quote shape that the price card actually
 *  renders. Full shape lives at src/lib/pricing/types.ts; we narrow
 *  to keep the client bundle off server-only modules. All monetary
 *  fields are cents (ints). */
interface PriceQuote {
  arrival: string;
  departure: string;
  nights: number;
  guests: number;
  subtotalCents: number;
  cleaningCents: number;
  taxEnabled: boolean;
  taxCents: number;
  totalCents: number;
  perGuestCents: number;
  discountTotalCents: number;
}

/** Nearby open range offered when requested dates are booked. */
interface AlternateRange {
  arrival: string;
  departure: string;
  nights: number;
  totalCents: number;
  perGuestCents: number;
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
const OCCASION_OPTIONS = [
  "Bachelor",
  "Bachelorette",
  "Wedding",
  "Other",
] as const;

/** Map the harness's lowercase enum (`bachelorette`) back to the
 *  title case the widget displays (`Bachelorette`). Defensive: if a
 *  value lands outside the known set, leave it alone for the widget to
 *  surface as-is. */
const OCCASION_FROM_HARNESS: Record<string, (typeof OCCASION_OPTIONS)[number]> = {
  bachelor: "Bachelor",
  bachelorette: "Bachelorette",
  wedding: "Wedding",
  other: "Other",
};

// Value framing on the price card: ladder the home up to what it
// AFFORDS the group, not a feature list. Three fixed affordance
// headlines; the topline + proof points flex by occasion so the same
// home reads as built for THEIR weekend. The lead beats the comp a
// guest is really weighing (another nice group rental) on purpose-built
// + curated, since togetherness alone only beats a hotel.
// See docs/price-card-value-brief-2026-06-10.md.
const VALUE_HEADLINES = [
  "Made for exactly this",
  "Everyone together",
  "And it’s handled",
] as const;

interface OccasionFraming {
  topline: string;
  proof: readonly [string, string, string];
}

const VALUE_FRAMING: Record<string, OccasionFraming> = {
  Bachelorette: {
    topline:
      "The sendoff the bride actually remembers, the whole crew together for it.",
    proof: [
      "The bar and parlor for the night in, the hot tub, the courtyard made for the photos. Composed for the weekend, set up before you arrive.",
      "The whole crew with the bride start to finish, the night that doesn’t end at last call.",
      "A host who knows the city, the photographer list, full kitchen, parking, slow mornings.",
    ],
  },
  Bachelor: {
    topline:
      "The kind of weekend the group still talks about after, all of you under one roof.",
    proof: [
      "The bar and parlor, the cinema, the game room, the hot tub. The night in that beats a night out, set up before you arrive.",
      "The whole crew together start to finish, no tab, no closing time, no car home.",
      "A host who knows the city, full kitchen and coffee bar, parking, twelve minutes from Midway.",
    ],
  },
  Wedding: {
    topline:
      "The people who matter most, all in one place for the whole celebration.",
    proof: [
      "The courtyard and parlor for the toasts, the kitchen for the family meal, room to get ready together. Set up before you arrive.",
      "Both sides under one roof, a weekend that doesn’t scatter across hotels.",
      "A host who knows the city, full kitchen and coffee bar, parking, slow mornings.",
    ],
  },
  default: {
    topline:
      "The difference between a trip you coordinate and a weekend you’re actually in.",
    proof: [
      "A real cinema, a hot tub for the group, the stocked bar and parlor, the courtyard with the fire pit. Composed for the celebration, set up before you arrive.",
      "The whole place private, beds for everyone, the night that doesn’t end at a hotel door.",
      "A host who knows the city, full kitchen and coffee bar, parking, twelve minutes from Midway.",
    ],
  },
};

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

function weekdayShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

/** Digits-only length check — phone is required wherever we capture
 *  contact, so a present-but-junk value should still fail. */
function looksLikePhone(s: string): boolean {
  return s.replace(/\D/g, "").length >= 7;
}

function formatRangeShort(arrival: string, departure: string): string {
  if (!arrival || !departure) return "";
  return `${formatShort(arrival)} to ${formatShort(departure)}`;
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

/** Format cents as a US dollar amount with commas, no decimals.
 *  Drops cents because every Jackpot price the guest sees is a whole
 *  dollar by construction (no per-cent line items). */
function formatDollars(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toLocaleString("en-US");
}

/** Map a QuoteErrorCode to a guest-facing Olivia bubble. Never expose
 *  raw error codes; never quote a number. Voice rules apply. */
function priceErrorMessage(code: string, hasAlternates = false): string {
  switch (code) {
    case "out_of_window":
    case "cache_empty":
      return "Hmm. I can't pull a real number for those dates right this second. Let me flag Abe to text you a quote in the next few minutes. Want me to do that?";
    case "unavailable":
      return hasAlternates
        ? "Those exact nights are taken. Here are the closest open weekends I can pull a real number for."
        : "Those exact nights are taken, and I'm not seeing close open weekends right now. Want me to flag Abe to find you something?";
    case "sub_floor":
      return "We're a 2 night minimum. Want me to bump the stay by a night so we can get you a real number?";
    case "max_guests":
      return "We cap at 14 guests on a single booking. Could the group come down to 14, or split into two weekends?";
    default:
      return "Something on my end is off. Let me get Abe on it. What's the best number for him to text you?";
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

/** Share-link widget. Surfaced when Olivia fires
 *  `show_widget: {widget: "share_link"}`. Renders a preview of the
 *  /trip page the crew will open (mirrors the OG unfurl card: cover
 *  photo, dates, per person per night) plus copy + native-share
 *  buttons. The harness mints the token + writes the inquiry row
 *  server-side; we just render. */
function ShareLinkWidget({
  url,
  guestCount,
  occasion,
  arrival,
  departure,
  totalCents,
}: {
  url: string;
  guestCount: number;
  occasion: string;
  arrival: string;
  departure: string;
  totalCents: number;
}) {
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: select the text so the guest can manually copy.
    }
  };

  const handleShare = async () => {
    const title = "The Jackpot Chicago";
    const text = occasion
      ? `${occasion} for ${guestCount || ""} at The Jackpot. Take a look:`
      : "Take a look at this place I found:";
    try {
      await navigator.share({ title, text: text.trim(), url });
    } catch {
      // Guest cancelled or share unsupported. No-op.
    }
  };

  // Mirror the /trip OG card so the preview matches what the crew
  // actually unfurls in their group chat. Per person per night is the
  // value hook; compute it from the quote the harness passed.
  const dateRange = formatRangeShort(arrival, departure);
  const nights =
    arrival && departure
      ? Math.max(
          1,
          Math.round(
            (new Date(departure + "T00:00:00").getTime() -
              new Date(arrival + "T00:00:00").getTime()) /
              86_400_000,
          ),
        )
      : 0;
  const perPersonCents =
    totalCents > 0 && guestCount > 0 && nights > 0
      ? Math.round(totalCents / guestCount / nights)
      : 0;
  const metaParts: string[] = [];
  if (perPersonCents > 0) {
    metaParts.push(`$${Math.round(perPersonCents / 100)}/person/night`);
  }
  if (occasion) metaParts.push(`${occasion} weekend`);
  const metaLine = metaParts.join(" · ") || "Sleeps 14 · 5BR · 3BA";

  return (
    <div className={`${styles.shareCard} ${styles.fadeIn}`}>
      <div className={styles.sharePreview}>
        <Image
          src={COVER_PHOTO.src}
          alt=""
          fill
          sizes="(max-width: 900px) 88vw, 360px"
          className={styles.sharePreviewPhoto}
        />
        <div className={styles.sharePreviewScrim} aria-hidden="true" />
        <div className={styles.sharePreviewContent}>
          <span className={styles.sharePreviewKicker}>The Jackpot Chicago</span>
          <span className={styles.sharePreviewDates}>
            {dateRange || "Group home in Chicago"}
          </span>
          <span className={styles.sharePreviewMeta}>{metaLine}</span>
        </div>
      </div>

      <p className={styles.sharePreviewNote}>
        This is what your crew opens. They can see the place and vote on the
        dates. Nothing due from anyone.
      </p>

      <div className={styles.shareCardLabel}>For the crew</div>
      <div className={styles.shareCardUrl}>{url}</div>
      <div className={styles.shareCardButtons}>
        <button
          type="button"
          className={styles.shareCardBtn}
          onClick={handleCopy}
          data-state={copied ? "copied" : undefined}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            className={`${styles.shareCardBtn} ${styles.shareCardBtnPrimary}`}
            onClick={handleShare}
          >
            Send it
          </button>
        )}
      </div>
    </div>
  );
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

export function InquiryChatThread({ open, onClose, initialIntent }: InquiryChatThreadProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const priceCardRef = useRef<HTMLDivElement>(null);

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
  /** Increments every time the dialog opens (or the entry intent
   *  changes). Async harness calls capture the epoch at fire time and
   *  bail before writing if it no longer matches — so a request from a
   *  prior open (e.g. the share opener) can't land its reply in a
   *  later, different session (e.g. check dates). */
  const sessionEpochRef = useRef(0);
  const [isWaitingForOlivia, setIsWaitingForOlivia] = useState(false);
  /** Widgets Olivia surfaced via show_widget actions. Appended in
   *  order received; render after the matching Olivia bubble. */
  const [harnessWidgets, setHarnessWidgets] = useState<Array<{ type: string; payload: Record<string, unknown> }>>([]);

  /** Gates the scripted opener bubble + the dates widget. Starts false
   *  on open, flips to true after ~900ms so Olivia's first line feels
   *  written rather than instant. Same drip-feed pattern as the rest
   *  of the conversation. */
  const [introReady, setIntroReady] = useState(false);

  /** True once the guest goes conversational (composer send or a chip
   *  intent). In this mode the AGENT drives which widget shows and
   *  composes all the text — so the scripted Olivia bubbles are
   *  suppressed and the widgets' commit handlers fire harness turns
   *  instead of advancing the scripted step machine. */
  const [agentDriven, setAgentDriven] = useState(false);

  // Price reveal state. Populated when step transitions to "pricing"
  // and we fetch from /api/inquiry-agent/quote. Either lands as a
  // real quote (renders the price card) or as an error (renders a
  // fallback bubble + notify_abe).
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  /** Nearby open ranges returned alongside an `unavailable` quote.
   *  Rendered as tappable cards; picking one re-quotes that range. */
  const [alternates, setAlternates] = useState<AlternateRange[]>([]);

  /** Post-price action state. The price reveal shows action buttons
   *  (reserve / questions / share), not a budget-sentiment scale.
   *  `reserve` opens an all-fields form; `reserved` is the confirmed
   *  terminal state. */
  const [priceAction, setPriceAction] = useState<"none" | "reserve" | "reserved">("none");
  const [reserveBusy, setReserveBusy] = useState(false);
  // Reserve scheduler: the guest picks the day + window for Abe's
  // lock-in call. The call is the hold's guarantee mechanism.
  const [callDate, setCallDate] = useState("");
  const [callWindow, setCallWindow] = useState("");

  const firstName = firstNameOf(contactName);

  // Reset local state every time the dialog opens so a guest who backs
  // out and re-enters starts fresh. Deferred via 0ms setTimeout to stay
  // off the effect's synchronous path (same react-hooks/set-state-in-
  // effect pattern HeroBookingBar uses for its draft hydration).
  useEffect(() => {
    if (!open) return;
    // Bump synchronously so any harness call fired on this open (intent
    // opener, etc.) captures the new epoch before it awaits.
    sessionEpochRef.current += 1;
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
      setHarnessWidgets([]);
      setIsWaitingForOlivia(false);
      setPriceQuote(null);
      setPriceError(null);
      setAlternates([]);
      setPriceAction("none");
      setReserveBusy(false);
      setCallDate("");
      setCallWindow("");
      setIntroReady(false);
      setAgentDriven(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, initialIntent]);

  // Drip-feed pacing on dialog open: hold the scripted Olivia opener
  // (and the dates widget) behind typing dots for ~900ms so it feels
  // written, not instant. Honors prefers-reduced-motion.
  useEffect(() => {
    if (!open) {
      setIntroReady(false);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIntroReady(true);
      return;
    }
    const t = window.setTimeout(() => setIntroReady(true), 900);
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
  }, [step, checkingPhase, availablePhase, harnessMessages.length, isWaitingForOlivia, introReady]);

  // Fetch the real quote when the conversation enters the pricing
  // step. While it's in flight the existing "Pulling pricing now…"
  // pill keeps spinning; once it lands we render the price card.
  // Errors (out_of_window, unavailable, sub_floor) surface a fallback
  // bubble so the guest isn't stranded.
  useEffect(() => {
    if (step !== "pricing") return;
    if (priceQuote || priceError) return; // already resolved
    if (!arrival || !departure || !groupSize) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/inquiry-agent/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arrival,
            departure,
            guests: Number.parseInt(groupSize, 10),
            occasion: occasion || undefined,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data:
          | { ok: true; quote: PriceQuote }
          | { ok: false; error: { code: string; message: string }; alternates?: AlternateRange[] } =
          await res.json();
        if (cancelled) return;
        if (data.ok) {
          setPriceQuote(data.quote);
        } else {
          setPriceError(data.error.code);
          if (data.alternates && data.alternates.length) {
            setAlternates(data.alternates);
          }
        }
      } catch {
        if (!cancelled) setPriceError("network");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, arrival, departure, groupSize, occasion, priceQuote, priceError]);

  // On price reveal, anchor the scroll to the TOP of the price card so
  // the guest reads the value framing first, instead of being yanked to
  // the bottom (buttons). Runs once per quote. The card now carries the
  // value + buttons, so there is no separate post-price chat bubble.
  const priceAnchoredRef = useRef(false);
  useEffect(() => {
    if (!priceQuote) {
      priceAnchoredRef.current = false;
      return;
    }
    if (priceAnchoredRef.current) return;
    priceAnchoredRef.current = true;
    const id = window.requestAnimationFrame(() => {
      priceCardRef.current?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [priceQuote]);

  // When the dialog opens with an entry-chip intent (e.g. "Send this
  // to my group"), fire a one-shot system event so Olivia composes the
  // right opener for that path instead of the generic greeting. Runs
  // at most once per dialog open.
  const intentTriggeredRef = useRef(false);
  useEffect(() => {
    if (!open) {
      intentTriggeredRef.current = false;
      return;
    }
    if (!initialIntent) return;
    if (intentTriggeredRef.current) return;
    intentTriggeredRef.current = true;
    void fireChipIntent(initialIntent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIntent]);

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
    // Departure pick no longer auto-advances; the guest takes an
    // explicit "Confirm dates" tap so the same affordance handles
    // both manual picks and harness pre-fills the same way.
  };

  // Reserve scheduler options. The hold IS scheduling Abe's lock-in
  // call: pick a day (next five days) and a window. We only ask for
  // contact we don't already have, and phone is required.
  const CALL_DAYS = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const iso = addDaysIso(today, i);
        return {
          iso,
          label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekdayShort(iso),
          sub: formatShort(iso),
        };
      }),
    [today],
  );
  const CALL_WINDOWS = ["Morning", "Afternoon", "Evening"];

  const needsName = !contactName.trim();
  const needsEmail = !looksLikeEmail(contactEmail);
  const needsPhone = !looksLikePhone(contactPhone);
  const canSubmitReserve =
    !!contactName.trim() &&
    looksLikeEmail(contactEmail) &&
    looksLikePhone(contactPhone) &&
    !!callDate &&
    !!callWindow;

  /** Reserve flow, single submit: collect only the contact we're
   *  missing (phone required), book the day + window for Abe's call,
   *  soft-hold the dates, notify Abe. The call is the guarantee. */
  const handleSubmitReserve = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmitReserve || !harnessSessionId) return;
    const epoch = sessionEpochRef.current;
    const dayOpt = CALL_DAYS.find((d) => d.iso === callDate);
    const dayText = dayOpt ? `${dayOpt.label}, ${dayOpt.sub}` : "";
    const slotText = `${dayText} · ${callWindow}`;
    setReserveBusy(true);
    try {
      const res = await fetch("/api/inquiry-agent/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: harnessSessionId,
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          call_window: slotText,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (sessionEpochRef.current !== epoch) return;
      setPriceAction("reserved");
      setHarnessMessages((prev) => [
        ...prev,
        { role: "user", body: slotText, ts: new Date().toISOString() },
        {
          role: "olivia",
          body: `Your weekend is on hold with nothing due. Abe will call you ${dayText} in the ${callWindow.toLowerCase()} to lock it in. Talk soon.`,
          ts: new Date().toISOString(),
        },
      ]);
    } catch {
      if (sessionEpochRef.current !== epoch) return;
      setHarnessMessages((prev) => [
        ...prev,
        {
          role: "olivia",
          body: "Something hiccuped holding that. Mind trying once more in a moment?",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      if (sessionEpochRef.current === epoch) setReserveBusy(false);
    }
  };

  /** Guest tapped "I have a few questions" at price reveal. Hand the
   *  conversation to Olivia in diagnostic mode. */
  const handlePriceQuestions = () => {
    setAgentDriven(true);
    void fireWidgetCommit(
      "I've got a couple questions before I decide.",
      "questions",
    );
  };

  /** Guest tapped a nearby open range after their first choice was
   *  booked. Swap in the new dates and re-run the quote effect by
   *  clearing the resolved price state. Stays on the pricing step. */
  const handlePickAlternate = (alt: AlternateRange) => {
    setArrival(alt.arrival);
    setDeparture(alt.departure);
    setAlternates([]);
    setPriceError(null);
    setPriceQuote(null); // clearing re-arms the price-card scroll anchor
  };

  const canConfirmDates =
    !!arrival && !!departure && departure >= addDaysIso(arrival, MIN_NIGHTS);
  const handleConfirmDates = () => {
    if (!canConfirmDates) return;
    if (agentDriven) {
      // Agent owns the flow: tell it the dates landed and let it
      // decide the next widget / advance. Echo a compact user bubble.
      const label = formatRangeShort(arrival, departure);
      void fireWidgetCommit(`I picked my dates: ${label}.`, label);
      return;
    }
    setCheckingPhase(0);
    setStep("checking");
  };

  /** Apply slots the harness extracted to the scripted-widget state.
   *  Strict-confirm: every pre-fill still needs the widget's commit
   *  button (Confirm dates / Save my info / Continue). Existing user
   *  entries are never clobbered. Past dates are silently skipped
   *  since they can't pass the Calendar's today floor. */
  const applyHarnessSlots = useCallback(
    (slots: Record<string, unknown>) => {
      if (typeof slots.name === "string" && slots.name && !contactName) {
        setContactName(slots.name);
      }
      if (typeof slots.email === "string" && slots.email && !contactEmail) {
        setContactEmail(slots.email);
      }
      if (typeof slots.phone === "string" && slots.phone && !contactPhone) {
        setContactPhone(slots.phone);
      }
      if (typeof slots.guest_count === "number" && !groupSize) {
        const n = slots.guest_count;
        if (n >= 1 && n <= 14) setGroupSize(String(n));
      }
      if (typeof slots.occasion === "string" && !occasion) {
        const mapped = OCCASION_FROM_HARNESS[slots.occasion.toLowerCase()];
        if (mapped) setOccasion(mapped);
      }
      // Dates: only apply when they're in the future and the user
      // hasn't already entered something. Calendar floor is today, so
      // past dates would render as un-pickable noise.
      const t = today;
      if (typeof slots.arrival === "string" && slots.arrival >= t && !arrival) {
        setArrival(slots.arrival);
      }
      if (
        typeof slots.departure === "string" &&
        slots.departure >= t &&
        !departure
      ) {
        setDeparture(slots.departure);
      }
    },
    [arrival, contactName, contactEmail, contactPhone, departure, groupSize, occasion, today],
  );

  /** Fire a one-shot system event when the guest opens the dialog
   *  with a specific chip intent. Olivia sees the event in her
   *  system-reminder and composes the right opener for that path. */
  const fireChipIntent = async (intent: "share" | "reserve") => {
    const epoch = sessionEpochRef.current;
    setIsWaitingForOlivia(true);
    setAgentDriven(true);
    const body =
      intent === "share"
        ? "[EVENT:chip_intent_share] Guest tapped 'Send this to my group'. They are the coordinator organizing for a crew. Follow the 'Sharing to the group' rules. Your opener speaks to what THEY get: hand the group a page everyone can see, let everyone vote on the weekend so the date settles without them chasing anyone, and nothing is due or held to share it. Never state our goal ('get buy in', 'get the crew in'). Warm, confident, declarative, luxury tone, no hype, no one word opener. Then collect what you need one widget at a time (date_picker, group_occasion, contact_form). Once you have name, email, dates, count, and occasion, propose show_widget: share_link."
        : intent === "reserve"
          ? "[EVENT:chip_intent_reserve] Guest just tapped 'Reserve now, nothing due'. They want to hold dates with no payment. Acknowledge warmly that they can lock dates with nothing due today. Collect what you need one widget at a time (date_picker for the weekend, group_occasion for size and occasion), then fire show_widget: reserve_form to capture their info and hold it. Do NOT talk price; this is the no-payment hold path."
          : "[EVENT:chip_intent_unknown]";
    try {
      const res = await fetch("/api/inquiry-agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: harnessSessionId,
          message: { role: "system", body, ts: new Date().toISOString() },
          client_context: { phase: "state1", slots: {}, viewport: "mobile" },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyHarnessResponse(await res.json(), epoch);
    } catch {
      // Silent on intent-fire failure — guest can just type something.
    } finally {
      if (sessionEpochRef.current === epoch) setIsWaitingForOlivia(false);
    }
  };

  /** Apply a harness turn response uniformly across all call sites:
   *  render Olivia's messages, pre-fill slots, surface terminal
   *  widgets (share_link), drive the agent-requested collection
   *  widgets via the step machine, and fast-forward to pricing when
   *  the agent signals advance. */
  type HarnessResponse = {
    session_id: string;
    messages: HarnessMessage[];
    extracted_slots?: Record<string, unknown>;
    widgets?: Array<{ type: string; payload: Record<string, unknown> }>;
    advance_to_pricing?: boolean;
  };
  const applyHarnessResponse = (data: HarnessResponse, epoch: number) => {
    // The dialog was closed/reopened (or switched intent) while this
    // request was in flight — drop the response so it can't surface in
    // a different session.
    if (sessionEpochRef.current !== epoch) return;
    if (!harnessSessionId) setHarnessSessionId(data.session_id);
    setHarnessMessages((prev) => [...prev, ...data.messages]);
    if (data.extracted_slots) applyHarnessSlots(data.extracted_slots);

    // Terminal widget (share_link) renders inline in the chat list.
    // Collection widgets (date_picker / contact_form / group_occasion)
    // drive the existing step machine to reveal the matching control.
    for (const w of data.widgets ?? []) {
      if (w.type === "share_link") {
        setHarnessWidgets((prev) => [...prev, w]);
      } else if (w.type === "date_picker") {
        setIntroReady(true);
        setStep("dates");
      } else if (w.type === "contact_form") {
        setCheckingPhase(3); // skip the drip; show the form immediately
        setStep("checking");
      } else if (w.type === "group_occasion") {
        setAvailablePhase(2); // skip the drip; show the picker immediately
        setStep("available");
      } else if (w.type === "reserve_form") {
        // No-payment reserve from the State-1 chip path. Surface the
        // reserve form directly (no price shown on this path).
        setPriceAction("reserve");
      }
    }

    // Fast-forward to the price reveal. The pricing useEffect fetches
    // the quote (needs arrival/departure/groupSize, already pre-filled)
    // and the post-price trigger fires Olivia's opener.
    if (data.advance_to_pricing) {
      setStep("pricing");
    }
  };

  /** Fire a harness turn after the guest commits an agent-surfaced
   *  widget. `userBubble` is what shows as the guest's message;
   *  current local slots ride along in client_context so the agent
   *  sees the freshly committed values and decides the next step
   *  (another widget, or advance_to_pricing). */
  const fireWidgetCommit = async (userBubble: string, _summary: string) => {
    void _summary;
    const epoch = sessionEpochRef.current;
    const userMsg: HarnessMessage = {
      role: "user",
      body: userBubble,
      ts: new Date().toISOString(),
    };
    setHarnessMessages((prev) => [...prev, userMsg]);
    setIsWaitingForOlivia(true);

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
          client_context: { phase: stepToPhase(step), slots, viewport: "mobile" },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyHarnessResponse(await res.json(), epoch);
    } catch {
      if (sessionEpochRef.current !== epoch) return;
      setHarnessMessages((prev) => [
        ...prev,
        {
          role: "olivia",
          body: "Hmm. I lost my signal for a beat. Mind sending that again?",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      if (sessionEpochRef.current === epoch) setIsWaitingForOlivia(false);
    }
  };

  const canSend = draft.trim().length > 0 && !isWaitingForOlivia;
  const handleSubmitDraft = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSend) return;

    const body = draft.trim();
    setDraft("");
    const epoch = sessionEpochRef.current;

    const userMsg: HarnessMessage = {
      role: "user",
      body,
      ts: new Date().toISOString(),
    };

    // Echo the user bubble immediately + show typing dots. Typing in
    // the composer is the canonical "go conversational" signal — the
    // agent takes over widget + text control from here.
    setHarnessMessages((prev) => [...prev, userMsg]);
    setIsWaitingForOlivia(true);
    setAgentDriven(true);

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
      applyHarnessResponse(await res.json(), epoch);
    } catch {
      // Network or server failure — surface a soft fallback bubble so
      // the guest doesn't see silence. Don't surface raw error details.
      if (sessionEpochRef.current !== epoch) return;
      setHarnessMessages((prev) => [
        ...prev,
        {
          role: "olivia",
          body: "Hmm. I lost my signal for a beat. Mind sending that again?",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      if (sessionEpochRef.current === epoch) setIsWaitingForOlivia(false);
    }
  };

  const canSaveContact = looksLikeEmail(contactEmail) && looksLikePhone(contactPhone);
  const handleSaveContact = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSaveContact) return;
    if (agentDriven) {
      const summary = formatContactSummary(contactName, contactEmail, contactPhone);
      void fireWidgetCommit(`Here's my info: ${summary}.`, summary);
      return;
    }
    setAvailablePhase(0);
    setStep("available");
  };

  const canContinueOptions = !!groupSize && !!occasion;
  const handleContinueOptions = () => {
    if (!canContinueOptions) return;
    if (agentDriven) {
      void fireWidgetCommit(
        `${groupSize} guests for a ${occasion.toLowerCase()}.`,
        `${groupSize} guests, ${occasion}`,
      );
      return;
    }
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
    ? `Good news, ${firstName}. `
    : "Good news. ";

  return (
    <div className={styles.page} aria-label="Chat with Olivia">
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
          {/* Entry user bubble — mirrors which chip the guest tapped.
              For the share path, the harness composes the opener so
              we skip the scripted Olivia reply below. */}
          {initialIntent === "share" ? (
            <div className={styles.msgUserRow}>
              <div className={styles.msgUserBubble}>Send this to my group</div>
            </div>
          ) : (
            <div className={styles.msgUserRow}>
              <div className={styles.msgUserBubble}>Check dates &amp; price</div>
            </div>
          )}

          {/* Scripted Olivia opener — only the pure tap-through lane
              (check_dates chip, no agent involvement). Suppressed once
              the agent takes over (agentDriven) since it composes the
              text itself. Drip-fed: typing dots, then message + calendar. */}
          {!agentDriven && initialIntent !== "share" && !introReady && <OliviaTyping />}

          {!agentDriven && initialIntent !== "share" && introReady && (
            <div className={`${styles.msgRow} ${styles.fadeIn}`}>
              <div className={styles.msgAvatar} aria-hidden="true">
                O
              </div>
              <div className={styles.msgBubble}>
                What weekend are you thinking? Pick any dates and I&apos;ll
                pull a real number.
              </div>
            </div>
          )}

          {/* Inline calendar block. Shows whenever we're on the dates
              step and the intro is ready, in any lane (tap-through OR
              agent-surfaced via show_widget: date_picker). Collapses to
              a user bubble once a departure is picked + confirmed. */}
          {step === "dates" && introReady && (
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

              <button
                type="button"
                className={styles.dateConfirm}
                disabled={!canConfirmDates}
                onClick={handleConfirmDates}
              >
                Confirm dates
              </button>
            </div>
          )}

          {/* Committed dates user bubble — tap lane only. In the agent
              lane the dates commit was already echoed via a widget-
              commit bubble, so this would duplicate. */}
          {!agentDriven && step !== "dates" && (
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
              {!agentDriven && checkingPhase === 0 && <OliviaTyping />}

              {!agentDriven && checkingPhase >= 1 && (
                <>
                  <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                    <div className={styles.msgAvatar} aria-hidden="true">
                      O
                    </div>
                    <div className={styles.msgBubble}>
                      {formatRangeLong(arrival, departure)}. Pulling
                      availability and pricing now&hellip;
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

              {!agentDriven && checkingPhase === 1 && <OliviaTyping />}

              {!agentDriven && checkingPhase >= 2 && (
                <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                  <div className={styles.msgAvatar} aria-hidden="true">
                    O
                  </div>
                  <div className={styles.msgBubble}>
                    <em>
                      While I look. Where can I reach you? In case we
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
                    <span className={styles.contactLabel}>Phone</span>
                    <input
                      type="tel"
                      className={styles.contactInput}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(555) 123-4567"
                      required
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
              sage success line. Suppressed when agentDriven: the agent
              lane already echoed the contact via a widget-commit bubble
              and the agent composes its own acknowledgment. */}
          {!agentDriven && (step === "available" || step === "pricing") && (
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
                Saved. The answer will land in your inbox too.
              </div>
            </>
          )}

          {/* Step "available" — drip-fed Olivia greeting + group/occasion
              widget. Persists into "pricing" as collapsed history below. */}
          {step === "available" && (
            <>
              {!agentDriven && availablePhase === 0 && <OliviaTyping />}

              {!agentDriven && availablePhase >= 1 && (
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
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={14}
                      className={styles.guestCountInput}
                      placeholder="1 to 14"
                      value={groupSize}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Clamp to 1..14; allow empty while typing.
                        if (v === "") {
                          setGroupSize("");
                          return;
                        }
                        const n = Number.parseInt(v, 10);
                        if (Number.isNaN(n)) return;
                        if (n < 1) setGroupSize("1");
                        else if (n > 14) setGroupSize("14");
                        else setGroupSize(String(n));
                      }}
                      aria-label="Guest count"
                    />
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
              {!agentDriven && (
                <div className={`${styles.msgUserRow} ${styles.fadeIn}`}>
                  <div className={styles.msgUserBubble}>
                    {groupSize} {Number(groupSize) === 1 ? "guest" : "guests"} &middot; {occasion}
                  </div>
                </div>
              )}

              {!priceQuote && !priceError && (
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
              )}

              {priceQuote && (
                <div
                  className={`${styles.priceCard} ${styles.fadeIn}`}
                  ref={priceCardRef}
                >
                  <div className={styles.priceCardLabel}>Your weekend</div>
                  <div className={styles.priceCardRange}>
                    {formatRangeShort(priceQuote.arrival, priceQuote.departure)}
                  </div>
                  <div className={styles.priceCardMeta}>
                    {priceQuote.nights} {priceQuote.nights === 1 ? "night" : "nights"}
                    {" · "}
                    {priceQuote.guests} {priceQuote.guests === 1 ? "guest" : "guests"}
                  </div>

                  <div className={styles.priceCardDivider} />

                  <div className={styles.priceCardRow}>
                    <span>Nightly subtotal</span>
                    <span>${formatDollars(priceQuote.subtotalCents)}</span>
                  </div>
                  {priceQuote.discountTotalCents > 0 && (
                    <div className={styles.priceCardRow}>
                      <span>Discount</span>
                      <span>{`-$${formatDollars(priceQuote.discountTotalCents)}`}</span>
                    </div>
                  )}
                  <div className={styles.priceCardRow}>
                    <span>Cleaning</span>
                    <span>${formatDollars(priceQuote.cleaningCents)}</span>
                  </div>
                  {priceQuote.taxEnabled && (
                    <div className={styles.priceCardRow}>
                      <span>Taxes</span>
                      <span>${formatDollars(priceQuote.taxCents)}</span>
                    </div>
                  )}

                  <div className={styles.priceCardDivider} />

                  <div className={`${styles.priceCardRow} ${styles.priceCardTotal}`}>
                    <span>Total</span>
                    <span>${formatDollars(priceQuote.totalCents)}</span>
                  </div>
                  <div className={styles.priceCardPerGuest}>
                    ${formatDollars(Math.round(priceQuote.perGuestCents / priceQuote.nights))} per
                    guest, per night
                  </div>

                  {(() => {
                    const framing =
                      VALUE_FRAMING[occasion] ?? VALUE_FRAMING.default;
                    return (
                      <div className={styles.priceValue}>
                        <div className={styles.priceValueDivider} />
                        <div className={styles.priceValueTopline}>
                          {framing.topline}
                        </div>
                        {VALUE_HEADLINES.map((head, i) => (
                          <div className={styles.priceValueRow} key={head}>
                            <div className={styles.priceValueHead}>
                              <span
                                className={styles.priceValueBullet}
                                aria-hidden="true"
                              >
                                ✦
                              </span>
                              {head}
                            </div>
                            <div className={styles.priceValueProof}>
                              {framing.proof[i]}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Action-forward price reveal. No budget-sentiment scale
                  (that invites haggling) — lead with the lowest-risk
                  commitment. Reserve is primary; questions opens Olivia's
                  diagnostic chat; share reuses the link flow. */}
              {priceQuote && priceAction === "none" && (
                <div className={`${styles.priceActions} ${styles.fadeIn}`}>
                  <button
                    type="button"
                    className={styles.reservePrimary}
                    onClick={() => setPriceAction("reserve")}
                  >
                    Reserve now, nothing due
                  </button>
                  <button
                    type="button"
                    className={styles.priceActionSecondary}
                    onClick={handlePriceQuestions}
                  >
                    I have a few questions
                  </button>
                  <button
                    type="button"
                    className={styles.priceActionSecondary}
                    onClick={() => {
                      setAgentDriven(true);
                      void fireWidgetCommit("Can I send this to my group?", "share");
                    }}
                  >
                    Send to my group
                  </button>
                </div>
              )}

              {priceError && (
                <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                  <div className={styles.msgAvatar} aria-hidden="true">
                    O
                  </div>
                  <div className={styles.msgBubble}>
                    {priceErrorMessage(priceError, alternates.length > 0)}
                  </div>
                </div>
              )}

              {priceError === "unavailable" && alternates.length > 0 && (
                <div className={`${styles.altDates} ${styles.fadeIn}`}>
                  <div className={styles.altDatesLabel}>Closest open weekends</div>
                  {alternates.map((alt) => (
                    <button
                      key={alt.arrival}
                      type="button"
                      className={styles.altDateRow}
                      onClick={() => handlePickAlternate(alt)}
                    >
                      <span className={styles.altDateRange}>
                        {formatRangeShort(alt.arrival, alt.departure)}
                      </span>
                      <span className={styles.altDatePrice}>
                        ${formatDollars(alt.totalCents)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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

          {harnessWidgets.map((w, idx) =>
            w.type === "share_link" ? (
              <ShareLinkWidget
                key={`widget-${idx}-${w.payload.token}`}
                url={String(w.payload.url ?? "")}
                guestCount={Number(groupSize) || 0}
                occasion={occasion}
                arrival={arrival}
                departure={departure}
                totalCents={Number(w.payload.total_cents) || 0}
              />
            ) : null,
          )}

          {/* Reserve = schedule Abe's lock-in call. Held with nothing
              due; the call is the guarantee. Rendered after the messages
              so an agent-surfaced reserve (or the price-reveal button)
              lands inline at the bottom where the guest is looking. We
              only ask for contact we don't already have; phone required. */}
          {priceAction === "reserve" && (
            <form
              className={`${styles.contactForm} ${styles.fadeIn}`}
              onSubmit={handleSubmitReserve}
              aria-label="Hold your dates"
            >
              <div className={styles.reserveBlurb}>
                {arrival && departure
                  ? `Hold ${formatRangeShort(arrival, departure)} with nothing due now. Pick a time for Abe's quick call to lock it in.`
                  : "Hold your dates with nothing due now. Pick a time for Abe's quick call to lock it in."}
              </div>

              {needsName && (
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
              )}
              {needsEmail && (
                <label className={styles.contactRow}>
                  <span className={styles.contactLabel}>Email</span>
                  <input
                    type="email"
                    className={styles.contactInput}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@email.com"
                  />
                </label>
              )}
              {needsPhone && (
                <label className={styles.contactRow}>
                  <span className={styles.contactLabel}>Phone</span>
                  <input
                    type="tel"
                    className={styles.contactInput}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Best number for the call"
                  />
                </label>
              )}

              <div className={styles.schedLabel}>Pick a day for the call</div>
              <div className={styles.schedDays}>
                {CALL_DAYS.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    className={styles.schedDay}
                    data-active={callDate === d.iso ? "true" : undefined}
                    onClick={() => setCallDate(d.iso)}
                  >
                    <span className={styles.schedDayLabel}>{d.label}</span>
                    <span className={styles.schedDaySub}>{d.sub}</span>
                  </button>
                ))}
              </div>

              <div className={styles.schedLabel}>Time of day</div>
              <div className={styles.schedWindows}>
                {CALL_WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={styles.schedWindow}
                    data-active={callWindow === w ? "true" : undefined}
                    onClick={() => setCallWindow(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className={styles.reservePrimary}
                disabled={!canSubmitReserve || reserveBusy}
              >
                {reserveBusy ? "Holding…" : "Hold my dates"}
              </button>
            </form>
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
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
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
    </div>
  );
}
