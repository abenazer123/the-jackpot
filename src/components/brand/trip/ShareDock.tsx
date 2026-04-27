/**
 * ShareDock — sticky floating action bar at the bottom of the trip
 * portal page. Renders ONLY for the booker (gated server-side on
 * the `jp_owner_<token>` cookie set during finalize). Friends who
 * open the same URL never see it.
 *
 * Lets the coordinator see exactly what her group will see —
 * photos, sleeping list, the whole page — and only THEN tap
 * Copy link. Replaces the v0 SharePreviewSheet (which showed a
 * tiny mini-preview that the booker had no way to verify).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import styles from "./ShareDock.module.css";

interface ShareDockProps {
  shareUrl: string;
  /** Date range like "Sep 26 – Sep 28" — used in the native share text. */
  dateRange: string;
  /** First name for the share text. */
  firstName: string;
  /** Booker's quote URL so we can offer a "← back to my quote" link. */
  quoteUrl: string;
}

export function ShareDock({
  shareUrl,
  dateRange,
  firstName,
  quoteUrl,
}: ShareDockProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setCanShare(
        typeof navigator !== "undefined" &&
          typeof navigator.share === "function",
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("[share-dock] copy failed", err);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({
        title: "The Jackpot — your trip page",
        text: `${firstName}'s Jackpot weekend, ${dateRange}.`,
        url: shareUrl,
      });
    } catch {
      // User cancelled or unsupported — silent.
    }
  }, [firstName, dateRange, shareUrl]);

  return (
    <div className={styles.dock} role="region" aria-label="Share your trip">
      <div className={styles.inner}>
        <Link href={quoteUrl} className={styles.back} aria-label="Back to my quote">
          <span aria-hidden="true">{"\u2190"}</span> my quote
        </Link>

        <div className={styles.actions}>
          {canShare ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={handleNativeShare}
              aria-label="Share via..."
            >
              Share&hellip;
            </button>
          ) : null}
          <button
            type="button"
            className={styles.primary}
            onClick={handleCopy}
            disabled={copied}
          >
            {copied ? "Copied \u2713" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
