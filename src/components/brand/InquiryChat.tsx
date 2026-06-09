/**
 * InquiryChat — conversational entry point that replaces HeroBookingBar
 * on the /chat test route. State 1 only: opens with Olivia introducing
 * herself, three commitment-ordered chips (share / check dates / save),
 * and an "ask anything" input as the free-text fallback. Later states
 * (date picker, group + occasion, budget, price reveal) will plug into
 * this same shell.
 *
 * Wiring is intentionally inert for now — chips and the input log to the
 * console so we can confirm the surface lights up under interaction, but
 * no navigation or state transitions happen yet.
 */

"use client";

import { useState, type FormEvent } from "react";

import { InquiryChatThread } from "./InquiryChatThread";
import styles from "./InquiryChat.module.css";

type Intent = "share" | "check_dates" | "save_for_later" | "free_text";
type ExpandedView = "check_dates" | "share" | null;

interface InquiryChatProps {
  /** Fired when the guest picks a chip or sends a free-text message. */
  onIntent?: (intent: Intent, payload?: string) => void;
}

// Matches the mobile breakpoint used elsewhere (HeroSection, DateField,
// HeroChatSection). Guarded for SSR — server renders treat as desktop so
// the dialog never auto-opens.
function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches;
}

export function InquiryChat({ onIntent }: InquiryChatProps) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<ExpandedView>(null);
  const canSend = draft.trim().length > 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSend) return;
    onIntent?.("free_text", draft.trim());
    setDraft("");
  };

  const handleCheckDates = () => {
    onIntent?.("check_dates");
    // Desktop interaction is deferred — only expand on mobile for this
    // round. >900px taps stay no-ops while we design the desktop variant.
    if (isMobileViewport()) {
      setExpanded("check_dates");
    }
  };

  const handleShare = () => {
    onIntent?.("share");
    if (isMobileViewport()) {
      setExpanded("share");
    }
  };

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.team}>
          <div className={styles.avatar} aria-hidden="true">
            O
          </div>
          <div className={styles.who}>
            <span className={styles.name}>Olivia</span>
            <span className={styles.status}>
              <span className={styles.statusDot} aria-hidden="true" />
              Active 2 min ago
            </span>
          </div>
        </div>

        <p className={styles.headline}>
          Browsing for the group? I can help, or just send you what you need.
        </p>

        <div className={styles.chips} role="list">
          <button
            type="button"
            className={`${styles.chip} ${styles.chipPrimary}`}
            onClick={handleCheckDates}
            role="listitem"
          >
            <span className={styles.chipText}>
              <span className={styles.chipTitle}>Check dates &amp; price</span>
              <span className={styles.chipSub}>
                Get a real number in 30 seconds
              </span>
            </span>
            <span className={styles.chipArrow} aria-hidden="true">
              &rarr;
            </span>
          </button>

          <button
            type="button"
            className={styles.chip}
            onClick={handleShare}
            role="listitem"
          >
            <span className={styles.chipText}>
              <span className={styles.chipTitle}>Send this to my group</span>
              <span className={styles.chipSub}>
                No commitment. Just the link plus photos.
              </span>
            </span>
            <span className={styles.chipArrow} aria-hidden="true">
              &rarr;
            </span>
          </button>

          <button
            type="button"
            className={styles.chip}
            onClick={() => onIntent?.("save_for_later")}
            role="listitem"
          >
            <span className={styles.chipText}>
              <span className={styles.chipTitle}>Save for later</span>
              <span className={styles.chipSub}>
                I&apos;ll text you when you&apos;re ready
              </span>
            </span>
            <span className={styles.chipArrow} aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>

        <form className={styles.inputRow} onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.input}
            placeholder={"Or ask anything\u2026"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Ask Olivia anything"
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

      <p className={styles.fallback}>
        <a href="/book">Or use the booking form instead &rarr;</a>
      </p>

      <InquiryChatThread
        open={expanded !== null}
        onClose={() => setExpanded(null)}
        initialIntent={expanded === "share" ? "share" : null}
      />
    </div>
  );
}
