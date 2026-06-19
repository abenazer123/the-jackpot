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

// Faded starburst constellation behind everything — deterministic
// positions (SSR-safe), varied sizes + low opacity for warm texture.
const BG_STARS = [
  { top: "7%", left: "14%", size: 22, op: 0.1 },
  { top: "15%", left: "84%", size: 38, op: 0.07 },
  { top: "40%", left: "5%", size: 16, op: 0.12 },
  { top: "30%", left: "92%", size: 26, op: 0.08 },
  { top: "58%", left: "9%", size: 44, op: 0.06 },
  { top: "52%", left: "88%", size: 18, op: 0.11 },
  { top: "74%", left: "24%", size: 30, op: 0.08 },
  { top: "82%", left: "72%", size: 24, op: 0.1 },
  { top: "90%", left: "44%", size: 40, op: 0.05 },
  { top: "66%", left: "52%", size: 14, op: 0.12 },
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

  const [exiting, setExiting] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const anonRef = useRef<string>("");
  const internalRef = useRef<boolean>(false);
  const firedView = useRef(false);
  const transitioningRef = useRef(false);

  useEffect(() => {
    // Internal flag: /batch?internal=1 brands this device as test traffic.
    if (params.get("internal") === "1") setCookie("jp_internal", "1", 365);
    internalRef.current = getCookie("jp_internal") === "1";
    anonRef.current = getAnonId();

    if (!firedView.current) {
      firedView.current = true;
      track("occasion_screen_viewed");
    }
    // The entrance is pure CSS (plays on load, reduced-motion disables it),
    // so there's no JS animation gating here.
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
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    track("occasion_selected", occasion, freetext);
    const reduced = prefersReducedMotion();
    const dest = `/chat?occasion=${encodeURIComponent(occasion)}`;
    if (occasion === "bachelorette" && !reduced) {
      // Confetti cover: one pop fully covers the screen, sticks ~0.5s,
      // then cascades from the top down to reveal the page behind. Route
      // right after the pop so /chat loads behind the cover during the hold.
      confettiCoverReveal();
      window.setTimeout(() => router.push(dest), 200);
      return;
    }
    setExiting(true);
    window.setTimeout(() => router.push(dest), reduced ? 0 : 380);
  }

  // One celebratory transition: a confetti cover snaps in and fully
  // covers the screen, holds (stuck, nothing behind shows), then cascades
  // from the top down to reveal the page behind. Built as DOM appended to
  // <body> so it survives the route change. (canvas-confetti is physics
  // only and can't "stick then cascade from the top".)
  function confettiCoverReveal() {
    const cover = document.createElement("div");
    cover.style.cssText =
      "position:fixed;inset:0;z-index:9998;overflow:hidden;pointer-events:none;";

    // Opaque backing so the page behind never peeks through the gaps.
    const backing = document.createElement("div");
    backing.style.cssText =
      "position:absolute;inset:0;background:radial-gradient(130% 85% at 50% -5%, rgba(232,185,35,0.2) 0%, rgba(212,169,48,0.05) 32%, transparent 62%), #14100b;";
    cover.appendChild(backing);

    // Dense field of confetti packed across the whole screen.
    const pieces: Array<{ el: HTMLDivElement; y: number; rot: number }> = [];
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const w = 6 + Math.random() * 11;
      const circle = Math.random() < 0.45;
      const rot = Math.random() * 360;
      const color =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const el = document.createElement("div");
      el.style.cssText =
        `position:absolute;left:${x}%;top:${y}%;width:${w}px;` +
        `height:${circle ? w : w * (0.5 + Math.random() * 0.9)}px;` +
        `background:${color};border-radius:${circle ? "50%" : "1px"};` +
        `transform:rotate(${rot}deg);will-change:transform;`;
      cover.appendChild(el);
      pieces.push({ el, y, rot });
    }
    document.body.appendChild(cover);

    // One pop: snap in, fully covered.
    cover.animate(
      [
        { opacity: 0, transform: "scale(1.05)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 160, easing: "ease-out" },
    );

    const HOLD = 520; // stick, fully covered
    const CASCADE = 650; // top-to-bottom stagger window
    const FALL = 780; // how long each piece takes to fall off

    window.setTimeout(() => {
      // Backing clears top-to-bottom, in sync with the cascade.
      backing.animate(
        [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }],
        {
          duration: CASCADE + 340,
          easing: "cubic-bezier(0.4,0,0.2,1)",
          fill: "forwards",
        },
      );
      // Each piece falls, delayed by how high it sits (top falls first).
      for (const { el, y, rot } of pieces) {
        const drift = (Math.random() - 0.5) * 70;
        const spin = rot + (Math.random() - 0.5) * 540;
        el.animate(
          [
            { transform: `rotate(${rot}deg)`, opacity: 1 },
            {
              transform: `translate(${drift}px, 115vh) rotate(${spin}deg)`,
              opacity: 1,
            },
          ],
          {
            duration: FALL,
            delay: (y / 100) * CASCADE,
            easing: "cubic-bezier(0.3,0,0.5,1)",
            fill: "forwards",
          },
        );
      }
    }, HOLD);

    window.setTimeout(() => cover.remove(), HOLD + CASCADE + FALL + 200);
  }

  const rootClass = [styles.screen, exiting ? styles.exiting : ""]
    .filter(Boolean)
    .join(" ");

  const word = "JACKPOT";

  return (
    <main className={rootClass} aria-label="What is the occasion?">
      <div className={styles.bgField} aria-hidden="true">
        {BG_STARS.map((s, i) => (
          <Starburst
            key={i}
            size={s.size}
            tier={s.size >= 30 ? 8 : 6}
            color="var(--jp-gold)"
            secondary="var(--jp-peach)"
            center="var(--jp-peach)"
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              opacity: s.op,
            }}
          />
        ))}
      </div>
      <div className={styles.col}>
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
        <h1 className={styles.question}>What is the occasion?</h1>
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
