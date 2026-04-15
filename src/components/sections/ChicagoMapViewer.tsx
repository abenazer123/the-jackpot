/**
 * ChicagoMapViewer — click-to-enlarge wrapper around ChicagoOutline.
 *
 * The inline map sits inside a <button> so the whole SVG is a click target.
 * A small gold hint pill in the top-right corner signals that it opens
 * larger. On click, a native <dialog> shows the map full-screen with a dark
 * backdrop. ESC, backdrop click, and the close button all dismiss it.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChicagoOutline } from "./ChicagoOutline";
import styles from "./ChicagoMapViewer.module.css";

export function ChicagoMapViewer() {
  const [open, setOpen] = useState(false);
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

  const handleClose = useCallback(() => setOpen(false), []);

  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) setOpen(false);
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Open an enlarged view of the Chicago location map"
      >
        <ChicagoOutline />
        <span className={styles.hint}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 10V4h6M20 10V4h-6M4 14v6h6M20 14v6h-6" />
          </svg>
          Enlarge
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={handleClose}
        onClick={handleDialogClick}
        aria-label="Enlarged Chicago location map"
      >
        <div className={styles.dialogBody}>
          <button
            type="button"
            onClick={handleClose}
            className={styles.close}
            aria-label="Close enlarged map"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className={styles.enlarged}>
            <ChicagoOutline />
          </div>
        </div>
      </dialog>
    </>
  );
}
