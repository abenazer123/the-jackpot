/**
 * SharePreviewSheet — opens on the booker's quote screen when she
 * taps "Share with my group". Replaces the v0 "Got it — Abe will
 * send your trip portal shortly" label flip with the live URL +
 * a copy-link affordance.
 *
 * Mobile: bottom-pinned sheet via native <dialog>.
 * Desktop: same dialog rendered as a centered card.
 *
 * Native share (`navigator.share`) is offered on supported devices
 * — falls back to the copy button on desktop / unsupported.
 *
 * Phase 2 Push 1 — view counter / host-share notification land in
 * later pushes; this sheet's job is the in-funnel handoff.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { COVER_PHOTO } from "@/lib/property/photos";
import styles from "./SharePreviewSheet.module.css";

interface SharePreviewSheetProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  /** First name of the coordinator — used in the preview card subtitle. */
  firstName: string;
  /** Date range like "Sep 26 – Sep 28" — preview card subtitle. */
  dateRange: string;
}

export function SharePreviewSheet({
  open,
  onClose,
  shareUrl,
  firstName,
  dateRange,
}: SharePreviewSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Defer to the next tick so we don't sync-set state inside the
    // effect body (react-hooks/set-state-in-effect).
    const t = window.setTimeout(() => {
      setCanShare(
        typeof navigator !== "undefined" &&
          typeof navigator.share === "function",
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("[share] copy failed", err);
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
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-label="Share your trip page"
    >
      <div className={styles.sheet}>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>

        <span className={styles.eyebrow}>Send this to your group</span>

        {/* Mini preview — same vibe as the link unfurl */}
        <div className={styles.preview} aria-hidden="true">
          <div className={styles.previewPhoto}>
            <Image
              src={COVER_PHOTO.src}
              alt=""
              fill
              sizes="120px"
              placeholder="blur"
              className={styles.previewImage}
            />
          </div>
          <div className={styles.previewMeta}>
            <span className={styles.previewTitle}>The Jackpot &middot; {dateRange}</span>
            <span className={styles.previewSub}>
              {firstName}&rsquo;s group weekend
            </span>
            <span className={styles.previewDomain}>thejackpotchi.com</span>
          </div>
        </div>

        {/* URL field */}
        <div className={styles.urlRow}>
          <input
            type="text"
            value={shareUrl}
            readOnly
            className={styles.urlInput}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Trip page URL"
          />
        </div>

        {/* Copy / Share buttons */}
        <button
          type="button"
          className={styles.primary}
          onClick={handleCopy}
          disabled={copied}
        >
          {copied ? "Copied \u2713" : "Copy link"}
        </button>

        {canShare ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={handleNativeShare}
          >
            Share via&hellip;
          </button>
        ) : null}

        <p className={styles.footer}>
          Anyone with this link can see your trip.
        </p>
      </div>
    </dialog>
  );
}
