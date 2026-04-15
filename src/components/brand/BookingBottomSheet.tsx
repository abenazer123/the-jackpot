/**
 * BookingBottomSheet — mobile container for the booking funnel.
 *
 * Wraps <BookingFunnelSteps /> in a native <dialog> styled as a bottom-
 * pinned sheet that slides up from the bottom of the viewport. Mirrors
 * BookingPricingModal.tsx lifecycle so the two components are freely
 * swappable based on viewport — shared focus trap, ESC, body scroll lock,
 * and warm backdrop all come for free from the native dialog primitive.
 *
 * Dismissal: close button (top-right), backdrop tap, or native ESC.
 * No swipe-to-dismiss — intentionally kept simple to match the desktop
 * modal's dismissal model.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  BookingFunnelSteps,
  type FunnelStep,
} from "./BookingFunnelSteps";
import styles from "./BookingBottomSheet.module.css";

interface BookingBottomSheetProps {
  open: boolean;
  onClose: () => void;
  arrival: string;
  departure: string;
  email: string;
}

function pickInitialStep(
  arrival: string,
  departure: string,
  email: string,
): FunnelStep {
  if (arrival && departure && email) return "checking";
  return "collect";
}

export function BookingBottomSheet({
  open,
  onClose,
  arrival,
  departure,
  email,
}: BookingBottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleDialogClick}
      aria-label="Booking inquiry"
    >
      <div className={styles.sheet}>
        <span className={styles.handle} aria-hidden="true" />

        <button
          type="button"
          onClick={onClose}
          className={styles.close}
          aria-label="Close booking form"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <BookingFunnelSteps
          arrival={arrival}
          departure={departure}
          email={email}
          initialStep={pickInitialStep(arrival, departure, email)}
          onClose={onClose}
        />
      </div>
    </dialog>
  );
}
