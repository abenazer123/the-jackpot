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

import { BRAND_PHOTOS, COVER_PHOTO } from "@/lib/property/photos";
import {
  TESTIMONIALS,
  sortForOccasion,
} from "@/components/sections/Testimonials";
import type { OccasionId } from "@/components/brand/OccasionProvider";

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
  /** What the group saves booking direct vs the same stay on a booking
   *  platform (their service fee). Computed server-side from the
   *  airbnb_fee_bps pricing config; 0 when unset. */
  savedVsAirbnbCents?: number;
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
// The three pillars: #1 names the occasion (purpose-built/curated for
// THEIR event), #2 is the private party stack (a bare rental can't
// claim it; togetherness alone is table stakes), #3 is the real host
// (concrete service, not the vague "it's handled").
const OCCASION_WORD: Record<string, string> = {
  Bachelorette: "bachelorette",
  Bachelor: "bachelor weekend",
  Wedding: "wedding weekend",
  Other: "celebration",
};

function valueHeadlines(occasion: string): [string, string, string] {
  const word = OCCASION_WORD[occasion] ?? "celebration";
  return [
    `Made for the ${word}`,
    "The night out comes to you",
    "A real host, not a lockbox",
  ];
}

interface OccasionFraming {
  topline: string;
  proof: readonly [string, string, string];
}

const VALUE_FRAMING: Record<string, OccasionFraming> = {
  Bachelorette: {
    topline:
      "The sendoff the bride actually remembers, the whole crew together for it.",
    proof: [
      "Composed for the weekend and set up before you arrive, down to the courtyard made for the photos.",
      "Bar, cinema, hot tub, parlor. No tab, no closing time, no car home, no strangers.",
      "Abe plans it with you, knows the city, sends the photographer list, and is there start to finish.",
    ],
  },
  Bachelor: {
    topline:
      "The kind of weekend the group still talks about, all of you under one roof.",
    proof: [
      "The whole place dialed for the group and set up before you arrive.",
      "Bar, cinema, game room, hot tub. The night in that beats a night out.",
      "Abe knows the city’s spots and is on it start to finish, never a lockbox.",
    ],
  },
  Wedding: {
    topline:
      "The people who matter most, all in one place for the whole celebration.",
    proof: [
      "Room to get ready together and the courtyard for the toasts, set up before you arrive.",
      "Parlor, bar, full kitchen for the family meal. The celebration on your terms.",
      "Abe plans it with you, knows the city, and is there start to finish.",
    ],
  },
  default: {
    topline:
      "The difference between a trip you coordinate and a weekend you’re actually in.",
    proof: [
      "Composed for the celebration and set up before you arrive.",
      "Cinema, hot tub, bar and parlor, the courtyard with the fire pit. The night out comes to you.",
      "Abe plans it with you, knows the city, and is there start to finish, not a lockbox.",
    ],
  },
};

/** Map the chat's occasion options to the review relevance tags so we
 *  can surface occasion-matched social proof on the price card. */
const OCCASION_TO_REVIEW_TAG: Record<string, OccasionId | null> = {
  Bachelorette: "bachelorette",
  Bachelor: "bachelorette",
  Wedding: "wedding",
  Other: null,
};

const STARS = "★★★★★";

// The reveal's advancing status line — promises the price is coming
// (without the figure) and signals finite, intentional progress, so the
// drip reads as an unveil, not a stall. Indexed by revealStage (0..4).
const REVEAL_STATUS = [
  "Pulling your weekend together…",
  "Here’s the place itself.",
  "What it’s made for.",
  "What your crew says.",
  "And your number.",
];

/** Ambient "computation" headlines that cycle under the progress bar
 *  during the qualify beat. Each maps to a real step the price engine
 *  does (PriceLabs rates, calendar availability, taxes/fees, comps,
 *  per-guest sizing), so the sense of work is honest, not theater. They
 *  loop on a timer independent of the taps, so answering the two
 *  questions feels like "since you're waiting, do these" rather than a
 *  gate. */
const CALC_HEADLINES = [
  "Pulling Chicago’s live rates",
  "Checking your weekend on the calendar",
  "Adding city taxes and fees",
  "Comparing nearby stays",
  "Sizing it for your group",
  "Finalizing your number",
];

/** Champagne bubbles rising INSIDE the coupe in the contained
 *  "calculating" band (not scattered across the card). `left` is a % of
 *  the glass, positioned within the bowl; they rise + fade on a loop.
 *  Deterministic (SSR-safe), transform/opacity only, reduced-motion off. */
const QUALIFY_GLASS_BUBBLES = [
  { left: 42, size: 3, delay: 0, dur: 2.2 },
  { left: 55, size: 2.5, delay: 0.7, dur: 2.6 },
  { left: 48, size: 3.5, delay: 1.3, dur: 2.4 },
  { left: 61, size: 2, delay: 1.9, dur: 2.9 },
  { left: 37, size: 2.5, delay: 1.0, dur: 2.5 },
];

/** Vertical (9:12) media carousel for the price card. Placeholder for
 *  real stay videos; brand photos stand in for now. Horizontal
 *  scroll-snap; a play glyph signals these become video. */
const MEDIA_ITEMS = BRAND_PHOTOS.slice(0, 5);

function MediaCarousel({ onOpen }: { onOpen?: (index: number) => void }) {
  const items = MEDIA_ITEMS;
  return (
    <div className={styles.mediaCarousel} aria-label="From recent stays">
      {items.map((p, i) => (
        <button
          type="button"
          className={styles.mediaItem}
          key={p.label}
          onClick={() => onOpen?.(i)}
          aria-label={`Open ${p.label}`}
        >
          <Image
            src={p.src}
            alt={p.alt}
            fill
            sizes="150px"
            className={styles.mediaImg}
          />
          <span className={styles.mediaPlay} aria-hidden="true">
            ▶
          </span>
          <span className={styles.mediaCaption}>{p.label}</span>
        </button>
      ))}
    </div>
  );
}

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
      return "Hmm. I can’t pull a real number for those dates right this second. Let me flag Abe to text you a quote in the next few minutes. Want me to do that?";
    case "unavailable":
      return hasAlternates
        ? "Those exact nights are taken. Here are the closest open weekends I can pull a real number for."
        : "Those exact nights are taken, and I’m not seeing close open weekends right now. Want me to flag Abe to find you something?";
    case "sub_floor":
      return "We’re a 2 night minimum. Want me to bump the stay by a night so we can get you a real number?";
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
    if (!canNativeShare) {
      // Desktop / no Web Share: copying the link is the share.
      void handleCopy();
      return;
    }
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
          priority
          placeholder="blur"
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
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={styles.shareCardBtn}
        >
          Open the page
        </a>
        <button
          type="button"
          className={styles.shareCardBtn}
          onClick={handleCopy}
          data-state={copied ? "copied" : undefined}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          className={`${styles.shareCardBtn} ${styles.shareCardBtnPrimary}`}
          onClick={handleShare}
        >
          {canNativeShare ? "Send it" : "Share"}
        </button>
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
  const actionsRowRef = useRef<HTMLDivElement>(null);
  // True once the inline price-reveal action row scrolls into view. The
  // floating Reserve CTA shows only while it's false, so the primary
  // action stays reachable through the long card, then "locks" inline.
  const [actionsInView, setActionsInView] = useState(false);
  // Same idea for the trip-share widget's own buttons: the hovering
  // share bar only shows while they're scrolled out of view, so the two
  // sets never double up on screen.
  const shareWidgetRef = useRef<HTMLDivElement>(null);
  const [shareInView, setShareInView] = useState(false);

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
  /** Mirror of harnessSessionId readable synchronously, so back-to-back
   *  silent commits in the scripted flow don't each mint a duplicate
   *  session before a re-render lands the state. */
  const harnessSessionIdRef = useRef<string | null>(null);
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
  // Staged value-first reveal: 0 header+teaser, 1 dream+photos, 2
  // pillars, 3 review, 4 the number, 5 breakdown+CTAs. So the value is
  // read before the price lands.
  const [revealStage, setRevealStage] = useState(0);
  // Qualify-during-calculating beat: two single-tap questions answered
  // while the number is "calculated", framed as tailoring. Q1 = where
  // they are in the hunt (drives decision_timeline + reveal tone), Q2 =
  // their deciding power (drives the CTA priority in item 3).
  const [searchStage, setSearchStage] = useState(""); // "starting" | "awhile" | "ready"
  const [decisionPower, setDecisionPower] = useState(""); // "lock" | "crew" | "relay"
  // Index into CALC_HEADLINES; cycles on a timer while the qualify beat
  // is open so the "we're computing" headline keeps moving even between
  // taps. Decorative (aria-hidden); the questions carry the real state.
  const [calcStep, setCalcStep] = useState(0);
  // Both taps answered. Gates the price reveal (the taps summon it) and
  // drives the context-aware CTA priority.
  const qualifyDone = !!searchStage && !!decisionPower;
  /** Move focus to the second qualify question when it replaces the
   *  first, so keyboard / screen-reader users aren't stranded on a chip
   *  that just unmounted. */
  const qualifyQ2Ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (searchStage && !decisionPower) qualifyQ2Ref.current?.focus();
  }, [searchStage, decisionPower]);
  // Cycle the ambient "computation" headline while the qualify beat is
  // open. Skipped under reduced-motion (a static label shows instead).
  useEffect(() => {
    if (step !== "pricing" || qualifyDone) {
      setCalcStep(0);
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(
      () => setCalcStep((i) => (i + 1) % CALC_HEADLINES.length),
      1600,
    );
    return () => window.clearInterval(id);
  }, [step, qualifyDone]);
  /** Map the two qualify answers to the existing session signals so they
   *  ride along in client_context (and the reserve body). Q1 maps to
   *  decision_timeline, Q2 to decision_makers (relay folds into crew,
   *  with the raw answer kept client-side to drive the CTA). */
  const qualifySignals = (): Record<string, string> => {
    const timeline: Record<string, string> = {
      starting: "flexible",
      awhile: "this_month",
      ready: "immediate",
    };
    const deciders: Record<string, string> = {
      lock: "solo",
      crew: "crew",
      relay: "crew",
    };
    const out: Record<string, string> = {};
    if (searchStage && timeline[searchStage])
      out.decision_timeline = timeline[searchStage];
    if (decisionPower && deciders[decisionPower])
      out.decision_makers = deciders[decisionPower];
    return out;
  };

  /** The current scripted-widget state as a client_context slot bundle. */
  const currentSlots = (): Record<string, unknown> => {
    const slots: Record<string, unknown> = {};
    if (arrival) slots.arrival = arrival;
    if (departure) slots.departure = departure;
    if (contactName) slots.name = contactName;
    if (contactEmail) slots.email = contactEmail;
    if (contactPhone) slots.phone = contactPhone;
    if (groupSize)
      slots.guest_count = Number.parseInt(groupSize, 10) || groupSize;
    if (occasion) slots.occasion = occasion;
    // Persist the revealed number into the session so a later notify_abe
    // (guest asks for Abe after seeing the price) carries the quote.
    if (priceQuote) slots.quote_total_cents = priceQuote.totalCents;
    return slots;
  };

  /** Silently mint or update the session as the guest taps through the
   *  no-intent "Check dates & price" flow (which never goes agentDriven,
   *  so a normal turn never fires). Uses the no-LLM widget-confirm branch
   *  so no Olivia bubble appears and the scripted UX is untouched. This
   *  is what makes the contact "Saved" promise true and gives a later
   *  reserve a real session to attach to. Fire-and-forget from the step
   *  handlers; awaited at reserve so a hold always lands a lead. Returns
   *  the session id (existing or freshly minted), or null on failure. */
  const commitScripted = async (
    label: string,
    userText?: string,
    agentLine?: string,
  ): Promise<string | null> => {
    const epoch = sessionEpochRef.current;
    const existing = harnessSessionIdRef.current;
    try {
      const res = await fetch("/api/inquiry-agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: existing,
          // When the caller passes readable text we log it as a real
          // user turn (so the transcript reads as a conversation); else
          // a system marker. `commit: true` forces the no-LLM path.
          commit: true,
          agent_line: agentLine,
          message: {
            role: userText ? "user" : "system",
            body: userText || `[COMMIT: ${label}]`,
            ts: new Date().toISOString(),
          },
          client_context: {
            phase: stepToPhase(step),
            slots: currentSlots(),
            signals: qualifySignals(),
            viewport: "mobile",
          },
        }),
      });
      if (!res.ok) return existing;
      const data = (await res.json()) as { session_id?: string };
      const id = data.session_id ?? existing;
      if (id) harnessSessionIdRef.current = id;
      if (sessionEpochRef.current === epoch && id && !harnessSessionId) {
        setHarnessSessionId(id);
      }
      return id;
    } catch {
      return existing;
    }
  };

  // Log the two qualify answers to the transcript (readably) the moment
  // both are in, so the session reads as a real conversation and the
  // signals persist before the reveal. Guarded so it fires once per beat.
  const qualifyLoggedRef = useRef(false);
  useEffect(() => {
    if (!qualifyDone) {
      qualifyLoggedRef.current = false;
      return;
    }
    if (qualifyLoggedRef.current) return;
    qualifyLoggedRef.current = true;
    const q1: Record<string, string> = {
      starting: "Just starting to look",
      awhile: "Been at it a while",
      ready: "Ready to lock something in",
    };
    const q2: Record<string, string> = {
      lock: "I'll lock it in",
      crew: "I'll run it by the crew",
      relay: "I'm gathering for whoever's deciding",
    };
    void commitScripted(
      "qualify",
      `Where I am: ${q1[searchStage] ?? searchStage}. Next: ${q2[decisionPower] ?? decisionPower}.`,
      "Finalizing your number.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualifyDone]);

  // The qualify commit above may fire before the quote resolves (cold
  // PriceLabs fetch). Once the number lands, persist it into the session
  // exactly once so a later notify_abe carries the price the guest saw.
  const pricePersistedRef = useRef(false);
  useEffect(() => {
    if (!qualifyDone || !priceQuote) {
      if (!qualifyDone) pricePersistedRef.current = false;
      return;
    }
    if (pricePersistedRef.current) return;
    pricePersistedRef.current = true;
    void commitScripted("price");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualifyDone, priceQuote]);

  const [priceError, setPriceError] = useState<string | null>(null);
  /** Nearby open ranges returned alongside an `unavailable` quote.
   *  Rendered as tappable cards; picking one re-quotes that range. */
  const [alternates, setAlternates] = useState<AlternateRange[]>([]);

  /** Real availability for the picked dates, checked during the
   *  "checking the calendar" step (which used to be a timed cover that
   *  never checked). "open" lets the wide-open beat proceed; "taken"
   *  pivots to the alternate-weekend picker at the available step so we
   *  never promise a date and then contradict it at pricing. */
  const [availability, setAvailability] = useState<
    "unknown" | "open" | "taken"
  >("unknown");
  const [availabilityAlts, setAvailabilityAlts] = useState<AlternateRange[]>(
    [],
  );

  /** Post-price action state. The price reveal shows action buttons
   *  (reserve / questions / share), not a budget-sentiment scale.
   *  `reserve` opens an all-fields form; `reserved` is the confirmed
   *  terminal state. */
  const [priceAction, setPriceAction] = useState<"none" | "reserve" | "reserved">("none");
  const [reserveBusy, setReserveBusy] = useState(false);
  // Share-to-group: minted directly (no LLM turn) the moment the guest
  // taps "Send to my group" at the price reveal, so the trip widget
  // shows fast. null until minted.
  const [shareData, setShareData] = useState<{
    url: string;
    totalCents: number;
  } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // Reserve scheduler: the guest picks the day + window for Abe's
  // lock-in call. The call is the hold's guarantee mechanism.
  const [callDate, setCallDate] = useState("");
  const [callWindow, setCallWindow] = useState("");
  // Lean price card: each value pillar expands inline (accordion), the
  // breakdown is its own accordion, reviews reveal more in place, and a
  // tapped video opens a fullscreen showcase. No single details modal.
  const [openPillar, setOpenPillar] = useState<number | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [showcaseIndex, setShowcaseIndex] = useState<number | null>(null);

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
      harnessSessionIdRef.current = null;
      setHarnessMessages([]);
      setHarnessWidgets([]);
      setIsWaitingForOlivia(false);
      setPriceQuote(null);
      setPriceError(null);
      setAlternates([]);
      setAvailability("unknown");
      setAvailabilityAlts([]);
      setSearchStage("");
      setDecisionPower("");
      setPriceAction("none");
      setShareData(null);
      setShareBusy(false);
      setReserveBusy(false);
      setCallDate("");
      setCallWindow("");
      setOpenPillar(null);
      setBreakdownOpen(false);
      setReviewsExpanded(false);
      setShowcaseIndex(null);
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
    // searchStage / decisionPower: the qualify beat grows when Q1 -> Q2
    // swaps, so re-scroll or the last chip hides under the composer.
    // priceAction / shareData: the reserve + share widgets change height.
  }, [step, checkingPhase, availablePhase, harnessMessages.length, isWaitingForOlivia, introReady, searchStage, decisionPower, qualifyDone, priceAction, shareData]);

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
  const revealTimersRef = useRef<number[]>([]);
  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Let an impatient guest jump straight to the number — the drip is a
  // gift to the patient, never a tax on the rest.
  const skipReveal = () => {
    revealTimersRef.current.forEach((t) => window.clearTimeout(t));
    revealTimersRef.current = [];
    setRevealStage(5);
  };
  useEffect(() => {
    // Start the value drip the moment both qualify taps are in. It does
    // NOT wait for the quote: the value (dream, photos, pillars, review)
    // shows immediately, and only the number itself holds for the quote.
    // So a slow PriceLabs fetch never leaves the guest staring at a
    // spinner after answering.
    if (!qualifyDone) {
      setRevealStage(0);
      return;
    }
    if (prefersReducedMotion()) {
      setRevealStage(5);
      return;
    }
    setRevealStage(0);
    // Pace each value beat so it can actually be read before the next
    // lands: dream topline + photos, then the 3 pillars, then the
    // matched review, THEN the number, THEN the CTAs. ~1.4s per beat so
    // the unveiling feels deliberate, not a flash. Impatient guests tap
    // to skip straight to the number.
    revealTimersRef.current = [
      window.setTimeout(() => setRevealStage(1), 700),
      window.setTimeout(() => setRevealStage(2), 2100),
      window.setTimeout(() => setRevealStage(3), 3600),
      window.setTimeout(() => setRevealStage(4), 5100),
      window.setTimeout(() => setRevealStage(5), 6000),
    ];
    return () => revealTimersRef.current.forEach((t) => window.clearTimeout(t));
  }, [qualifyDone]);

  // Follow the reveal — ease the newest content into view as each stage
  // lands (anchors the card on first reveal, then trails the drip).
  useEffect(() => {
    if (!priceQuote) return;
    const body = bodyRef.current;
    if (!body) return;
    const id = window.requestAnimationFrame(() => {
      if (revealStage === 0) {
        priceCardRef.current?.scrollIntoView({ block: "start" });
      } else {
        body.scrollTo({
          top: body.scrollHeight,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [revealStage, priceQuote]);

  // Watch the inline action row: while it's out of view, a floating
  // Reserve CTA hovers above the composer so the primary action is
  // always reachable through the long card; when it scrolls into view
  // the floating one hides and the inline buttons take over.
  useEffect(() => {
    const el = actionsRowRef.current;
    const root = bodyRef.current;
    if (!el || !root) {
      setActionsInView(false);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setActionsInView(entry.isIntersecting),
      // Fire as soon as the inline row nears the bottom (shrink the root
      // bottom by the sticky bar's height) so the floating CTA hides
      // before it can double up with the inline buttons.
      { root, threshold: 0, rootMargin: "0px 0px -72px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // revealStage included so the observer re-attaches when the inline
    // action row finally mounts at the end of the staged reveal.
  }, [priceQuote, priceAction, revealStage]);

  // Mirror of the above for the share widget's own button row.
  useEffect(() => {
    const el = shareWidgetRef.current;
    const root = bodyRef.current;
    if (!el || !root) {
      setShareInView(false);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setShareInView(entry.isIntersecting),
      { root, threshold: 0, rootMargin: "0px 0px -72px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shareData]);

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

  /** Real calendar check for the picked range. Availability is
   *  guest-independent (a date is booked or not), so we can run it with
   *  a placeholder guest count before the group is collected; the price
   *  step recomputes with the real count. Soft codes (out_of_window /
   *  cache_empty / network) don't block — they fall through to "open"
   *  and the price step surfaces the real result. */
  const checkAvailability = useCallback(
    async (arr: string, dep: string) => {
      try {
        const res = await fetch("/api/inquiry-agent/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arrival: arr,
            departure: dep,
            guests: Number.parseInt(groupSize, 10) || 2,
            occasion: occasion || "Other",
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: { code?: string };
          alternates?: AlternateRange[];
        };
        if (!data.ok && data.error?.code === "unavailable") {
          setAvailability("taken");
          setAvailabilityAlts(
            Array.isArray(data.alternates) ? data.alternates : [],
          );
        } else {
          setAvailability("open");
        }
      } catch {
        setAvailability("open");
      }
    },
    [groupSize, occasion],
  );

  // Run the real availability check when the flow enters "checking" (the
  // step that already pretends to check the calendar). Resolves while
  // the guest fills contact, so the "available" beat can branch on the
  // truth instead of always claiming "wide open".
  useEffect(() => {
    if (step !== "checking" || !arrival || !departure) return;
    setAvailability("unknown");
    setAvailabilityAlts([]);
    void checkAvailability(arrival, departure);
  }, [step, arrival, departure, checkAvailability]);

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
    if (!canSubmitReserve) return;
    const epoch = sessionEpochRef.current;
    const dayOpt = CALL_DAYS.find((d) => d.iso === callDate);
    const dayText = dayOpt ? `${dayOpt.label}, ${dayOpt.sub}` : "";
    const slotText = `${dayText} · ${callWindow}`;
    setReserveBusy(true);
    try {
      // Always commit first: this mints the session in the no-intent
      // scripted flow AND syncs the latest slots (e.g. an alternate date
      // the guest picked after the first quote) so the hold records the
      // weekend they actually reserved, not a stale one.
      const sid = await commitScripted(
        "reserve",
        slotText,
        `Holding ${formatRangeShort(arrival, departure)}, nothing due. Abe will call ${dayText} in the ${callWindow.toLowerCase()} to lock it in.`,
      );
      if (!sid) throw new Error("no_session");
      const res = await fetch("/api/inquiry-agent/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          call_window: slotText,
          ...qualifySignals(),
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
          body: `Your weekend is on hold, nothing due. We hold it 7 days so the next group gets a fair shot, and Abe will call you ${dayText} in the ${callWindow.toLowerCase()} to lock it in. Talk soon.`,
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

  /** Guest picked an open weekend from the available-step taken pivot.
   *  Swap the dates, re-check, and stay on the available step so the
   *  wide-open beat + group/occasion proceed once it confirms open. */
  const handlePickAlternateAvailable = (alt: AlternateRange) => {
    setArrival(alt.arrival);
    setDeparture(alt.departure);
    setAvailability("unknown");
    setAvailabilityAlts([]);
    void checkAvailability(alt.arrival, alt.departure);
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
    void commitScripted(
      "dates",
      formatRangeShort(arrival, departure),
      "Pulling your availability and pricing.",
    );
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
    harnessSessionIdRef.current = data.session_id;
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
          client_context: {
            phase: stepToPhase(step),
            slots,
            signals: qualifySignals(),
            viewport: "mobile",
          },
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
            signals: qualifySignals(),
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
      void fireWidgetCommit(`Here’s my info: ${summary}.`, summary);
      return;
    }
    void commitScripted(
      "contact",
      contactSummary,
      "Saved. I'll send the answer to your inbox too.",
    );
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
    void commitScripted(
      "trip",
      `${groupSize} guests · ${occasion}`,
      "Pulling your real number.",
    );
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

  // Item 3: context-aware CTA priority. Q2 (deciding power) sets which
  // action leads. Someone who said "I'll lock it in" gets Reserve first;
  // someone running it by the crew or gathering for whoever decides gets
  // "Get the group on board" first, with reserve demoted. Q1 (search
  // stage) softens the reserve subcopy for early-stage browsers. The
  // order + wording flex across every Q1 x Q2 combination.
  const ctaActions: {
    key: "reserve" | "share" | "questions";
    label: string;
    sub: string | null;
  }[] = (() => {
    const groupDecision =
      decisionPower === "crew" || decisionPower === "relay";
    const exploring = searchStage === "starting";
    const reserve = {
      key: "reserve" as const,
      label: "Reserve now, nothing due",
      // The free, nothing-due hold is the anti-drop-off move, so it
      // always carries a reassurance line, even when share leads and
      // reserve is demoted. Wording flexes to the guest's stage.
      sub: groupDecision
        ? "Hold the dates while they decide. Free, nothing due."
        : exploring
          ? "Lock the dates while you think. Nothing due now."
          : "Locks your weekend now. Nothing due, no card needed.",
    };
    const share = {
      key: "share" as const,
      label: groupDecision ? "Get the group on board" : "Send to my group",
      sub: groupDecision
        ? "Share the place and the price so they can weigh in."
        : null,
    };
    const questions = {
      key: "questions" as const,
      label: "I have a few questions",
      sub: null,
    };
    return groupDecision
      ? [share, reserve, questions]
      : [reserve, questions, share];
  })();

  const runCtaAction = (key: "reserve" | "share" | "questions") => {
    if (key === "reserve") {
      setPriceAction("reserve");
    } else if (key === "questions") {
      handlePriceQuestions();
    } else {
      void handleShareToGroup();
    }
  };

  /** Mint the trip link directly (no LLM turn) so the share widget shows
   *  fast. At the price reveal the guest already has every slot, so
   *  Olivia has nothing to compose; routing through the model only added
   *  seconds. Ensures the session first, then hits the share route. */
  const handleShareToGroup = async () => {
    if (shareData || shareBusy) return;
    setShareBusy(true);
    const epoch = sessionEpochRef.current;
    try {
      const sid =
        harnessSessionIdRef.current ?? (await commitScripted("share"));
      if (!sid) throw new Error("no_session");
      const res = await fetch("/api/inquiry-agent/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        total_cents?: number | null;
      };
      if (sessionEpochRef.current !== epoch) return;
      if (res.ok && data.ok && data.url) {
        setShareData({ url: data.url, totalCents: data.total_cents ?? 0 });
      } else {
        // Fall back to the agent path if the direct mint can't proceed.
        setAgentDriven(true);
        void fireWidgetCommit("Can I send this to my group?", "share");
      }
    } catch {
      if (sessionEpochRef.current !== epoch) return;
      setAgentDriven(true);
      void fireWidgetCommit("Can I send this to my group?", "share");
    } finally {
      if (sessionEpochRef.current === epoch) setShareBusy(false);
    }
  };

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

              {/* Taken pivot: the real check during "checking" came back
                  unavailable, so instead of the wide-open promise we show
                  the closest open weekends right here. No prices yet (no
                  group), so the rows are date-only. */}
              {!agentDriven &&
                availablePhase >= 1 &&
                availability === "taken" && (
                  <>
                    <div className={`${styles.msgRow} ${styles.fadeIn}`}>
                      <div className={styles.msgAvatar} aria-hidden="true">
                        O
                      </div>
                      <div className={styles.msgBubble}>
                        {firstName ? `${firstName}, those ` : "Those "}exact
                        nights are taken. Here are the closest open weekends I
                        can pull a real number for.
                      </div>
                    </div>
                    {availabilityAlts.length > 0 && (
                      <div className={`${styles.altDates} ${styles.fadeIn}`}>
                        <div className={styles.altDatesLabel}>
                          Closest open weekends &middot; tap one to use those
                          dates
                        </div>
                        {availabilityAlts.map((alt) => (
                          <button
                            key={alt.arrival}
                            type="button"
                            className={styles.altDateRow}
                            onClick={() => handlePickAlternateAvailable(alt)}
                          >
                            <span className={styles.altDateRange}>
                              {formatRangeShort(alt.arrival, alt.departure)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

              {!agentDriven &&
                availablePhase >= 1 &&
                availability !== "taken" && (
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

              {availablePhase >= 2 && availability !== "taken" && (
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

              {/* Qualify-during-calculating beat. Two single-tap
                  questions answered while the number is "calculated",
                  framed as tailoring. Each tap advances the progress so
                  answering feels like summoning the price. The quote
                  fetches in the background; the reveal waits for both. */}
              {!qualifyDone && !priceError && (
                <div className={`${styles.qualify} ${styles.fadeIn}`}>
                  <p className={styles.qualifyLead}>
                    Pulling your real number. Two quick taps so it&rsquo;s
                    accurate.
                  </p>

                  {/* Contained "calculating" band: ONE deliberate motion
                      (a champagne coupe with bubbles rising inside it) plus
                      the cycling work-step headline + progress. Everything
                      is clipped to this band, so the question/answer area
                      below stays completely clear. aria-hidden; the
                      questions carry the real state for AT. */}
                  <div className={styles.qualifyCalc} aria-hidden="true">
                    <div className={styles.qualifyGlass}>
                      <svg
                        className={styles.qualifyGlassSvg}
                        viewBox="0 0 40 64"
                        fill="none"
                      >
                        <path
                          className={styles.qualifyGlassFill}
                          d="M12.6 28 L14 41 Q20 47 26 41 L27.4 28 Z"
                        />
                        <path d="M11 7 L14 41 Q20 47 26 41 L29 7" />
                        <path d="M11 7 L29 7" />
                        <path d="M20 47 L20 56" />
                        <path d="M13.5 57.5 L26.5 57.5" />
                      </svg>
                      {QUALIFY_GLASS_BUBBLES.map((b, i) => (
                        <span
                          key={`gb${i}`}
                          className={styles.qualifyGlassBubble}
                          style={{
                            left: `${b.left}%`,
                            width: `${b.size}px`,
                            height: `${b.size}px`,
                            animationDelay: `${b.delay}s`,
                            animationDuration: `${b.dur}s`,
                          }}
                        />
                      ))}
                    </div>
                    <div className={styles.qualifyCalcMeta}>
                      <span className={styles.qualifyTrack}>
                        <span
                          className={styles.qualifyFill}
                          data-step={searchStage ? (decisionPower ? 3 : 2) : 1}
                        />
                      </span>
                      <span
                        key={calcStep}
                        className={styles.qualifyProgressLabel}
                      >
                        {CALC_HEADLINES[calcStep]}
                      </span>
                    </div>
                  </div>

                  {!searchStage ? (
                    <div className={styles.qualifyQ} key="q1">
                      <p className={styles.qualifyQLabel}>
                        Where are you in the hunt?
                      </p>
                      <div className={styles.qualifyChips}>
                        <button
                          type="button"
                          className={styles.qualifyChip}
                          onClick={() => setSearchStage("starting")}
                        >
                          Just starting to look
                        </button>
                        <button
                          type="button"
                          className={styles.qualifyChip}
                          onClick={() => setSearchStage("awhile")}
                        >
                          Been at it a while
                        </button>
                        <button
                          type="button"
                          className={styles.qualifyChip}
                          onClick={() => setSearchStage("ready")}
                        >
                          Ready to lock something in
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.qualifyQ} key="q2">
                      <p
                        className={styles.qualifyQLabel}
                        ref={qualifyQ2Ref}
                        tabIndex={-1}
                      >
                        Once you&rsquo;ve got the number, what happens next?
                      </p>
                      <div className={styles.qualifyChips}>
                        <button
                          type="button"
                          className={styles.qualifyChip}
                          onClick={() => setDecisionPower("lock")}
                        >
                          I&rsquo;ll lock it in
                        </button>
                        <button
                          type="button"
                          className={styles.qualifyChip}
                          onClick={() => setDecisionPower("crew")}
                        >
                          I&rsquo;ll run it by the crew
                        </button>
                        <button
                          type="button"
                          className={styles.qualifyChip}
                          onClick={() => setDecisionPower("relay")}
                        >
                          I&rsquo;m gathering for whoever&rsquo;s deciding
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {qualifyDone &&
                !priceError &&
                (() => {
                  const framing =
                    VALUE_FRAMING[occasion] ?? VALUE_FRAMING.default;
                  const heads = valueHeadlines(occasion);
                  const tag = OCCASION_TO_REVIEW_TAG[occasion] ?? null;
                  const allReviews = sortForOccasion(TESTIMONIALS, tag);
                  const shownReviews = reviewsExpanded
                    ? allReviews
                    : allReviews.slice(0, 1);
                  // Header values come from local state so the card can
                  // render before the quote lands; the quote refines them.
                  const hdrArrival = priceQuote?.arrival ?? arrival;
                  const hdrDeparture = priceQuote?.departure ?? departure;
                  const hdrNights =
                    priceQuote?.nights ??
                    (arrival && departure
                      ? Math.max(
                          1,
                          Math.round(
                            (new Date(departure + "T00:00:00").getTime() -
                              new Date(arrival + "T00:00:00").getTime()) /
                              86_400_000,
                          ),
                        )
                      : 0);
                  const hdrGuests =
                    priceQuote?.guests ?? (Number.parseInt(groupSize, 10) || 0);
                  const perNight = priceQuote
                    ? Math.round(priceQuote.perGuestCents / priceQuote.nights)
                    : 0;
                  return (
                    <div
                      className={`${styles.priceCard} ${styles.fadeIn}`}
                      ref={priceCardRef}
                      onClick={() => {
                        if (revealStage < 5) skipReveal();
                      }}
                    >
                      <div className={styles.priceCardLabel}>Your weekend</div>
                      <div className={styles.priceCardRange}>
                        {formatRangeShort(hdrArrival, hdrDeparture)}
                      </div>
                      <div className={styles.priceCardMeta}>
                        {hdrNights} {hdrNights === 1 ? "night" : "nights"}
                        {" · "}
                        {hdrGuests} {hdrGuests === 1 ? "guest" : "guests"}
                      </div>

                      {/* Advancing status — promises the number is coming
                          (no figure), signals finite progress, and is the
                          skip affordance. Replaces the static teaser +
                          the generic typing dots. */}
                      {revealStage < 5 && (
                        <div className={styles.priceTeaser} aria-hidden="true">
                          {REVEAL_STATUS[Math.min(revealStage, 4)]}
                          <span className={styles.priceTeaserSkip}>
                            {" "}· tap to skip
                          </span>
                        </div>
                      )}

                      {/* Stage 1: the dream + the photos. */}
                      {revealStage >= 1 && (
                        <div className={styles.fadeIn}>
                          <div className={styles.priceValueTopline}>
                            {framing.topline}
                          </div>
                          <MediaCarousel
                            onOpen={(i) => setShowcaseIndex(i)}
                          />
                        </div>
                      )}

                      {/* Stage 2: the value pillars (expand inline). */}
                      {revealStage >= 2 && (
                        <div className={`${styles.priceValue} ${styles.fadeIn}`}>
                          {heads.map((head, i) => {
                            const open = openPillar === i;
                            return (
                              <div className={styles.pillar} key={head}>
                                <button
                                  type="button"
                                  className={styles.pillarHead}
                                  aria-expanded={open}
                                  onClick={() =>
                                    setOpenPillar(open ? null : i)
                                  }
                                >
                                  <span
                                    className={styles.priceValueBullet}
                                    aria-hidden="true"
                                  >
                                    ✦
                                  </span>
                                  <span className={styles.pillarHeadText}>
                                    {head}
                                  </span>
                                  <svg
                                    className={styles.pillarChevron}
                                    data-open={open ? "true" : undefined}
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path d="M6 9l6 6 6-6" />
                                  </svg>
                                </button>
                                {open && (
                                  <div className={styles.pillarProof}>
                                    {framing.proof[i]}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Stage 3: one occasion-matched review. */}
                      {revealStage >= 3 && shownReviews.length > 0 && (
                        <div className={`${styles.priceReviews} ${styles.fadeIn}`}>
                          {shownReviews.map((r) => (
                            <div className={styles.reviewCard} key={r.id}>
                              <div
                                className={styles.reviewStars}
                                aria-hidden="true"
                              >
                                {STARS}
                              </div>
                              <p className={styles.reviewQuote}>{r.quote}</p>
                              <div className={styles.reviewMeta}>
                                {r.name} · {r.occasion} · verified guest
                              </div>
                            </div>
                          ))}
                          {allReviews.length > 1 && (
                            <button
                              type="button"
                              className={styles.reviewsMore}
                              onClick={() => setReviewsExpanded((v) => !v)}
                            >
                              {reviewsExpanded
                                ? "Show fewer reviews"
                                : `See more reviews (${allReviews.length - 1})`}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Stage 4: the number, now that the value's landed. */}
                      {revealStage >= 4 && (
                        <div
                          className={`${styles.priceNumber} ${styles.fadeIn}`}
                          role="status"
                          aria-live="polite"
                        >
                          {priceQuote ? (
                            <>
                              <div className={styles.priceHero}>
                                <span className={styles.priceHeroNum}>
                                  ${formatDollars(perNight)}
                                </span>
                                <span className={styles.priceHeroUnit}>
                                  per guest, per night
                                </span>
                              </div>
                              <div className={styles.priceHeroTotal}>
                                ${formatDollars(priceQuote.totalCents)} for the
                                whole group, {priceQuote.nights}{" "}
                                {priceQuote.nights === 1 ? "night" : "nights"}
                              </div>
                              {(priceQuote.savedVsAirbnbCents ?? 0) > 0 && (
                                <div className={styles.savingsTag}>
                                  <span className={styles.savingsPill}>
                                    Book direct
                                  </span>
                                  <span>
                                    Saves the group $
                                    {formatDollars(
                                      priceQuote.savedVsAirbnbCents ?? 0,
                                    )}{" "}
                                    vs Airbnb
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className={styles.checking}>
                              <span
                                className={styles.checkingDots}
                                aria-hidden="true"
                              >
                                <span className={styles.checkingDot} />
                                <span className={styles.checkingDot} />
                                <span className={styles.checkingDot} />
                              </span>
                              <span className={styles.checkingText}>
                                Pulling your number&hellip;
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stage 5: the breakdown dropdown (needs the quote). */}
                      {revealStage >= 5 && priceQuote && (
                        <div className={`${styles.pillar} ${styles.fadeIn}`}>
                          <button
                            type="button"
                            className={styles.pillarHead}
                            aria-expanded={breakdownOpen}
                            onClick={() => setBreakdownOpen((v) => !v)}
                          >
                            <span className={styles.pillarHeadText}>
                              Price breakdown
                            </span>
                            <svg
                              className={styles.pillarChevron}
                              data-open={breakdownOpen ? "true" : undefined}
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                          {breakdownOpen && (
                            <div className={styles.breakdownBody}>
                              <div className={styles.priceCardRow}>
                                <span>Nightly subtotal</span>
                                <span>
                                  ${formatDollars(priceQuote.subtotalCents)}
                                </span>
                              </div>
                              {priceQuote.discountTotalCents > 0 && (
                                <div className={styles.priceCardRow}>
                                  <span>Discount</span>
                                  <span>{`-$${formatDollars(priceQuote.discountTotalCents)}`}</span>
                                </div>
                              )}
                              <div className={styles.priceCardRow}>
                                <span>Cleaning</span>
                                <span>
                                  ${formatDollars(priceQuote.cleaningCents)}
                                </span>
                              </div>
                              {priceQuote.taxEnabled && (
                                <div className={styles.priceCardRow}>
                                  <span>Taxes</span>
                                  <span>
                                    ${formatDollars(priceQuote.taxCents)}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`${styles.priceCardRow} ${styles.priceCardTotal}`}
                              >
                                <span>Total</span>
                                <span>
                                  ${formatDollars(priceQuote.totalCents)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })()}

              {/* Action-forward price reveal. No budget-sentiment scale
                  (that invites haggling) — lead with the lowest-risk
                  commitment. Reserve is primary; questions opens Olivia's
                  diagnostic chat; share reuses the link flow. */}
              {priceQuote &&
                priceAction === "none" &&
                revealStage >= 5 &&
                !shareData &&
                !shareBusy && (
                <div
                  className={`${styles.priceActions} ${styles.fadeIn}`}
                  ref={actionsRowRef}
                >
                  {ctaActions.map((a, i) => (
                    <div key={a.key} className={styles.ctaItem}>
                      <button
                        type="button"
                        className={
                          i === 0
                            ? styles.reservePrimary
                            : styles.priceActionSecondary
                        }
                        onClick={() => runCtaAction(a.key)}
                      >
                        {a.label}
                      </button>
                      {a.sub && (i === 0 || a.key === "reserve") && (
                        <p className={styles.ctaSub}>{a.sub}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Share-to-group, minted directly (no LLM turn) so the
                  trip widget appears fast. A brief building state, then
                  the widget. */}
              {shareBusy && !shareData && (
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
                    Building your group page&hellip;
                  </span>
                </div>
              )}
              {shareData && (
                <div ref={shareWidgetRef}>
                  <ShareLinkWidget
                    url={shareData.url}
                    guestCount={Number.parseInt(groupSize, 10) || 0}
                    occasion={occasion}
                    arrival={arrival}
                    departure={departure}
                    totalCents={shareData.totalCents}
                  />
                  {/* The share path used to dead-end here. Give the
                      coordinator the obvious next move: turn the share
                      into a free hold so the vote isn't racing an open
                      calendar. */}
                  {priceAction !== "reserve" && priceAction !== "reserved" && (
                    <div className={styles.shareReserveNudge}>
                      <p className={styles.shareReserveText}>
                        Sent it? I&rsquo;ll hold these dates while your crew
                        votes, so nobody loses the weekend. Nothing due.
                      </p>
                      <button
                        type="button"
                        className={styles.reservePrimary}
                        onClick={() => setPriceAction("reserve")}
                      >
                        Reserve the dates while they vote
                      </button>
                    </div>
                  )}
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
                  <div className={styles.altDatesLabel}>
                    Closest open weekends · tap one for the real number
                  </div>
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
              {/* Honest scarcity: a single home means one group per date.
                  True, not a fake timer. */}
              <div className={styles.reserveScarcity}>
                <span className={styles.reserveScarcityMark} aria-hidden="true">
                  ✦
                </span>
                One home, one group per date. The hold is yours while you two
                talk.
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

        {/* Floating Reserve CTA: hovers above the composer while the
            guest reads the long price card, then yields to the inline
            buttons once they scroll into view. */}
        {priceQuote && priceAction === "none" && revealStage >= 5 && !actionsInView && showcaseIndex === null && !shareData && (
          <div className={styles.stickyCta}>
            <button
              type="button"
              className={styles.reservePrimary}
              onClick={() => runCtaAction(ctaActions[0].key)}
            >
              {ctaActions[0].label}
            </button>
          </div>
        )}

        {/* Once the trip page is minted, keep its actions hovering the
            whole time so the coordinator can copy, open, or send it
            without scrolling back to the card. */}
        {shareData && showcaseIndex === null && !shareInView && (
          <div className={`${styles.stickyCta} ${styles.stickyShare}`}>
            <a
              href={shareData.url}
              target="_blank"
              rel="noreferrer"
              className={styles.stickyShareBtn}
            >
              Open
            </a>
            <button
              type="button"
              className={styles.stickyShareBtn}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(shareData.url)
                  .then(() => {
                    setShareCopied(true);
                    window.setTimeout(() => setShareCopied(false), 1800);
                  })
                  .catch(() => {});
              }}
            >
              {shareCopied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              className={`${styles.stickyShareBtn} ${styles.stickyShareBtnPrimary}`}
              onClick={() => {
                const canShare =
                  typeof navigator !== "undefined" &&
                  typeof navigator.share === "function";
                if (canShare) {
                  void navigator
                    .share({
                      title: "The Jackpot Chicago",
                      text: occasion
                        ? `${occasion} at The Jackpot. Take a look:`
                        : "Take a look at this place:",
                      url: shareData.url,
                    })
                    .catch(() => {});
                } else {
                  void navigator.clipboard?.writeText(shareData.url).catch(() => {});
                  setShareCopied(true);
                  window.setTimeout(() => setShareCopied(false), 1800);
                }
              }}
            >
              Send it
            </button>
          </div>
        )}

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

      {/* Media showcase — tapping a video opens a fullscreen viewer with
          a corner close and the Reserve CTA hovering at the bottom, so
          the guest can act straight from the highlight. */}
      {priceQuote && showcaseIndex !== null && (
        <div className={styles.showcase} role="dialog" aria-label="Stay highlights">
          <button
            type="button"
            className={styles.showcaseClose}
            onClick={() => setShowcaseIndex(null)}
            aria-label="Close"
          >
            ✕
          </button>

          <div className={styles.showcaseStage}>
            <Image
              src={MEDIA_ITEMS[showcaseIndex].src}
              alt={MEDIA_ITEMS[showcaseIndex].alt}
              fill
              sizes="100vw"
              className={styles.showcaseImg}
            />
            <span className={styles.showcasePlay} aria-hidden="true">
              ▶
            </span>
            <span className={styles.showcaseCaption}>
              {MEDIA_ITEMS[showcaseIndex].label}
            </span>

            <button
              type="button"
              className={`${styles.showcaseNav} ${styles.showcaseNavPrev}`}
              onClick={() =>
                setShowcaseIndex((cur) =>
                  cur === null
                    ? null
                    : (cur + MEDIA_ITEMS.length - 1) % MEDIA_ITEMS.length,
                )
              }
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.showcaseNav} ${styles.showcaseNavNext}`}
              onClick={() =>
                setShowcaseIndex((cur) =>
                  cur === null ? null : (cur + 1) % MEDIA_ITEMS.length,
                )
              }
              aria-label="Next"
            >
              ›
            </button>
          </div>

          <div className={styles.showcaseCta}>
            <button
              type="button"
              className={styles.reservePrimary}
              onClick={() => {
                setShowcaseIndex(null);
                setPriceAction("reserve");
              }}
            >
              Reserve now, nothing due
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
