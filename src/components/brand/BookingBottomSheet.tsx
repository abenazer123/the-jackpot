/**
 * BookingBottomSheet — mobile container for the booking funnel.
 *
 * Wraps <BookingFunnelSteps /> in a native <dialog> styled as a bottom-
 * pinned sheet that slides up from the bottom of the viewport. Mirrors
 * BookingPricingModal.tsx lifecycle so the two components are freely
 * swappable based on viewport — shared focus trap, ESC, body scroll lock,
 * and warm backdrop all come for free from the native dialog primitive.
 *
 * Dismissal: native back gesture / ESC (no in-sheet close button —
 * full-screen treatment removes the corner X to keep the experience
 * immersive). Tapping a CTA path closes via onClose after a beat.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  BookingFunnelSteps,
  type BookingSource,
  type FunnelStep,
} from "./BookingFunnelSteps";
import styles from "./BookingBottomSheet.module.css";

interface BookingBottomSheetProps {
  open: boolean;
  onClose: () => void;
  arrival: string;
  departure: string;
  email: string;
  source?: BookingSource;
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
  source,
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
        {open ? (
          <BookingFunnelSteps
            arrival={arrival}
            departure={departure}
            email={email}
            initialStep={pickInitialStep(arrival, departure, email)}
            source={source}
            onClose={onClose}
          />
        ) : null}
      </div>
    </dialog>
  );
}
