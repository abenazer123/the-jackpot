/**
 * BookingPricingModal — desktop container for the booking funnel.
 *
 * Wraps <BookingFunnelSteps /> in a native <dialog> so focus trap, ESC,
 * body scroll lock, and the warm backdrop all come for free. The step
 * logic (collect → checking beat → form → success) lives in the shared
 * BookingFunnelSteps component; this file only owns the desktop modal
 * shell and chooses the right initial step based on what the entry
 * point has prefilled.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  BookingFunnelSteps,
  type FunnelStep,
} from "./BookingFunnelSteps";
import styles from "./BookingPricingModal.module.css";

interface BookingPricingModalProps {
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

export function BookingPricingModal({
  open,
  onClose,
  arrival,
  departure,
  email,
}: BookingPricingModalProps) {
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
      <div className={styles.body}>
        <div className={styles.card}>
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
      </div>
    </dialog>
  );
}
