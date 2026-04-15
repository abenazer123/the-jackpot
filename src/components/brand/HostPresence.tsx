/**
 * HostPresence — tiny "Abe is online · replies in minutes" indicator with
 * a pulsing green dot (online) or a muted dot + "was online N min ago"
 * (offline). Reads state from the shared HostPresenceProvider so every
 * indicator on the page stays in perfect sync — they all flip at the same
 * moment, they all show the same minutes-ago count.
 *
 * Variants:
 *   "full"    — "Abe is online · replies in minutes" (form footer copy)
 *   "compact" — "Online now" / "X min ago" (bars, peek, hero trailing)
 *
 * Tones:
 *   "default" — warm-olive text for light surfaces
 *   "light"   — white text for saturated / photo surfaces (hero, top bar)
 */

"use client";

import { useHostPresence } from "./HostPresenceProvider";
import styles from "./HostPresence.module.css";

interface HostPresenceProps {
  variant?: "full" | "compact";
  tone?: "default" | "light";
  className?: string;
}

export function HostPresence({
  variant = "full",
  tone = "default",
  className,
}: HostPresenceProps) {
  const { online, minutesAgo } = useHostPresence();

  const label = (() => {
    if (variant === "full") {
      return online
        ? "Abe is online \u00b7 replies in minutes"
        : `Abe was online ${minutesAgo} min${minutesAgo === 1 ? "" : "s"} ago`;
    }
    // compact
    return online
      ? "Abe is online"
      : `Abe was online ${minutesAgo}m ago`;
  })();

  const toneClass = tone === "light" ? styles.light : styles.default;
  const variantClass =
    variant === "full" ? styles.variantFull : styles.variantCompact;
  const rootClass = [styles.root, toneClass, variantClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} aria-live="polite">
      <span
        className={`${styles.dot} ${online ? styles.dotOnline : ""}`}
        aria-hidden="true"
      />
      <span
        className={styles.text}
        key={online ? "on" : `off-${minutesAgo}`}
      >
        {label}
      </span>
    </div>
  );
}
