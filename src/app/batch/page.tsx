/**
 * /batch — the occasion screen. First thing Batch traffic sees.
 *
 * Asks one question ("what are you celebrating?") with tappable option
 * cards, records the answer (occasion_screen_viewed on mount,
 * occasion_selected on tap, via /api/landing-event), then routes to the
 * funnel carrying the occasion. Bachelorette gets a confetti send-off.
 *
 * Tracking: anon_id (jp_anon cookie) for dedup; internal flag (jp_internal
 * cookie, set by /batch?internal=1) to exclude our own test taps; UTM read
 * from UtmProvider so attribution is preserved through this hop. See
 * docs/batch-funnel-brief-2026-06-18.md.
 *
 * Routing is the v1 fallback: every option goes to /chat?occasion=<value>
 * until the dedicated bachelorette / shared celebration pages exist.
 */

"use client";

import confetti from "canvas-confetti";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Starburst } from "@/components/brand/Starburst";
import { useUtm } from "@/components/brand/UtmProvider";

import styles from "./batch.module.css";

// ── Options (locked set + hierarchy, see brief §3) ────────────────
const HERO = { key: "bachelorette", label: "Bachelorette" };
const STANDARD = [
  { key: "birthday", label: "Birthday" },
  { key: "bachelor", label: "Bachelor" },
  { key: "group_trip", label: "Group trip" },
];
const LIGHTER = [
  { key: "getaway", label: "Getaway" },
  { key: "reunion", label: "Reunion" },
  { key: "good_time", label: "Just a good time" },
];

const CONFETTI_COLORS = [
  "#f7a8c4", // soft pink
  "#ec5f8a", // rose pink
  "#f0506a", // warm red
  "#f9d9d2", // blush
  "#ffffff", // white
  "#d4a930", // jp gold
  "#e8b923", // jp gold bright
  "#ff9050", // jp peach
];

// ── cookie + anon-id helpers ──────────────────────────────────────
function getCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((r) => r.startsWith(name + "="))
    ?.split("=")[1];
}
function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86_400_000);
  document.cookie = `${name}=${value}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
}
function getAnonId(): string {
  let id = getCookie("jp_anon");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `a${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    setCookie("jp_anon", id, 365);
  }
  return id;
}

// ── icons (first pass; warm gold line art) ────────────────────────
function Icon({ k }: { k: string }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (k) {
    case "bachelorette": // champagne coupe
      return (
        <svg {...common}>
          <path d="M7 4 L17 4 L15.5 11 Q12 14 8.5 11 Z" />
          <path d="M12 14 L12 20" />
          <path d="M8.5 20.5 L15.5 20.5" />
        </svg>
      );
    case "birthday": // cake
      return (
        <svg {...common}>
          <path d="M4 20 L20 20 L20 12 L4 12 Z" />
          <path d="M4 16 L20 16" />
          <path d="M12 12 L12 8" />
          <path d="M12 6.5 a1 1 0 1 0 0.01 0" />
        </svg>
      );
    case "bachelor": // bowtie
      return (
        <svg {...common}>
          <path d="M4 8 L11 12 L4 16 Z" />
          <path d="M20 8 L13 12 L20 16 Z" />
          <path d="M11 10 L13 10 L13 14 L11 14 Z" />
        </svg>
      );
    case "group_trip": // people
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M4 19 q5 -6 10 0" />
          <path d="M14 19 q3 -4 6 -1" />
        </svg>
      );
    case "getaway": // sun
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3 L12 5 M12 19 L12 21 M3 12 L5 12 M19 12 L21 12 M6 6 L7.5 7.5 M16.5 16.5 L18 18 M18 6 L16.5 7.5 M7.5 16.5 L6 18" />
        </svg>
      );
    case "reunion": // heart
      return (
        <svg {...common}>
          <path d="M12 20 C5 14 4 9 7.5 7 C10 5.5 12 8 12 8 C12 8 14 5.5 16.5 7 C20 9 19 14 12 20 Z" />
        </svg>
      );
    case "good_time": // sparkle
      return (
        <svg {...common}>
          <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" />
        </svg>
      );
    default: // something else — dots
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="18" cy="12" r="1.2" />
        </svg>
      );
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function OccasionScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const utm = useUtm();

  // "pending" until we decide (avoids a flash of the composed state
  // before the intro animation kicks in); then "play" or "static".
  const [mode, setMode] = useState<"pending" | "play" | "static">("pending");
  const [exiting, setExiting] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const anonRef = useRef<string>("");
  const internalRef = useRef<boolean>(false);
  const firedView = useRef(false);

  useEffect(() => {
    // Internal flag: /batch?internal=1 brands this device as test traffic.
    if (params.get("internal") === "1") setCookie("jp_internal", "1", 365);
    internalRef.current = getCookie("jp_internal") === "1";
    anonRef.current = getAnonId();

    if (!firedView.current) {
      firedView.current = true;
      track("occasion_screen_viewed");
    }

    // Play the intro once per session; otherwise (or reduced motion) show
    // the composed state instantly.
    const played = sessionStorage.getItem("jp_batch_intro") === "1";
    if (played || prefersReducedMotion()) {
      setMode("static");
    } else {
      sessionStorage.setItem("jp_batch_intro", "1");
      setMode("play");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function track(event: string, occasion?: string, freetext?: string) {
    try {
      fetch("/api/landing-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true, // survive the navigation on select
        body: JSON.stringify({
          anon_id: anonRef.current,
          event,
          occasion,
          occasion_freetext: freetext,
          // URL params are the reliable current-touch source on /batch
          // (the view event fires before UtmProvider's context populates);
          // fall back to stored attribution for non-UTM arrivals.
          utm_source: params.get("utm_source") ?? utm.utm_source,
          utm_medium: params.get("utm_medium") ?? utm.utm_medium,
          utm_campaign: params.get("utm_campaign") ?? utm.utm_campaign,
          utm_term: params.get("utm_term") ?? utm.utm_term,
          utm_content: params.get("utm_content") ?? utm.utm_content,
          referrer: utm.referrer,
          landing_path: "/batch",
          internal: internalRef.current,
        }),
      }).catch(() => {});
    } catch {
      /* analytics is best-effort, never block */
    }
  }

  function select(occasion: string, freetext?: string) {
    if (exiting) return;
    track("occasion_selected", occasion, freetext);
    setExiting(true);
    const reduced = prefersReducedMotion();
    const dest = `/chat?occasion=${encodeURIComponent(occasion)}`;
    if (occasion === "bachelorette" && !reduced) {
      fireConfetti();
      window.setTimeout(() => router.push(dest), 950);
    } else {
      window.setTimeout(() => router.push(dest), reduced ? 0 : 380);
    }
  }

  function fireConfetti() {
    const opts = { colors: CONFETTI_COLORS, disableForReducedMotion: true };
    confetti({ ...opts, particleCount: 150, spread: 100, origin: { y: 0.6 }, scalar: 1.1, ticks: 240 });
    confetti({ ...opts, particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
    confetti({ ...opts, particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
  }

  const rootClass = [
    styles.screen,
    mode === "play" ? styles.playing : "",
    mode === "static" ? styles.static : "",
    exiting ? styles.exiting : "",
  ]
    .filter(Boolean)
    .join(" ");

  const word = "JACKPOT";

  return (
    <main className={rootClass} aria-label="What are you celebrating?">
      <div className={styles.lockup}>
        <span className={styles.the}>THE</span>
        <span className={styles.wordmark} aria-label="Jackpot">
          {word.split("").map((ch, i) => (
            <span
              key={i}
              className={styles.letter}
              style={{ animationDelay: `${i * 0.055}s` }}
            >
              {ch}
            </span>
          ))}
        </span>
        <span className={styles.burst} aria-hidden="true">
          <Starburst size={16} tier={8} color="var(--jp-gold)" secondary="var(--jp-peach)" center="var(--jp-peach)" />
        </span>
        <span className={styles.chicago}>CHICAGO</span>
      </div>

      <div className={styles.body}>
        <h1 className={styles.question}>What are you celebrating?</h1>
        <p className={styles.sub}>One tap and we&apos;ll tailor everything to it.</p>

        <button
          type="button"
          className={styles.hero}
          onClick={() => select(HERO.key)}
        >
          <span className={styles.heroIcon} aria-hidden="true">
            <Icon k={HERO.key} />
          </span>
          <span className={styles.heroLabel}>{HERO.label}</span>
        </button>

        <div className={styles.cards}>
          {STANDARD.map((o) => (
            <button
              key={o.key}
              type="button"
              className={styles.card}
              onClick={() => select(o.key)}
            >
              <span className={styles.cardIcon} aria-hidden="true">
                <Icon k={o.key} />
              </span>
              <span className={styles.cardLabel}>{o.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.lighterRow}>
          {LIGHTER.map((o) => (
            <button
              key={o.key}
              type="button"
              className={styles.chip}
              onClick={() => select(o.key)}
            >
              {o.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.chip}
            data-active={showOther ? "true" : undefined}
            onClick={() => setShowOther((v) => !v)}
          >
            Something else
          </button>
        </div>

        {showOther && (
          <form
            className={styles.otherRow}
            onSubmit={(e) => {
              e.preventDefault();
              select("other", otherText.trim() || undefined);
            }}
          >
            <input
              type="text"
              className={styles.otherInput}
              placeholder="What are you celebrating?"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              autoFocus
            />
            <button type="submit" className={styles.otherGo}>
              Go
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function BatchPage() {
  return (
    <Suspense fallback={null}>
      <OccasionScreen />
    </Suspense>
  );
}
