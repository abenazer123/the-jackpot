/**
 * PhotoGalleryModal — shared lightbox for the highlight cards.
 *
 * Native <dialog> + showModal() gives us focus trap, ESC handling, body
 * scroll lock, and a ::backdrop pseudo for free. Keyboard arrows and touch
 * swipe drive prev/next; click on the backdrop or the close button closes.
 * A keyed inner wrapper remounts on index change so the new photo fades in.
 */

"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef } from "react";

import styles from "./PhotoGalleryModal.module.css";

export interface GalleryCard {
  name: string;
  caption: string;
  photo: StaticImageData;
}

interface PhotoGalleryModalProps {
  cards: readonly GalleryCard[];
  openIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const SWIPE_THRESHOLD = 60;

export function PhotoGalleryModal({
  cards,
  openIndex,
  onClose,
  onPrev,
  onNext,
}: PhotoGalleryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex !== null && !dialog.open) {
      dialog.showModal();
    } else if (openIndex === null && dialog.open) {
      dialog.close();
    }
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openIndex, onNext, onPrev]);

  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start === null) return;
      const end = e.changedTouches[0]?.clientX;
      if (end === undefined) return;
      const delta = end - start;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      if (delta < 0) onNext();
      else onPrev();
    },
    [onNext, onPrev],
  );

  const card = openIndex !== null ? cards[openIndex] : null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleDialogClick}
      aria-label="Highlight photo gallery"
    >
      <div className={styles.body}>
        <button
          type="button"
          onClick={onClose}
          className={`${styles.chromeButton} ${styles.close}`}
          aria-label="Close gallery"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onPrev}
          className={`${styles.chromeButton} ${styles.arrow} ${styles.prev}`}
          aria-label="Previous photo"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onNext}
          className={`${styles.chromeButton} ${styles.arrow} ${styles.next}`}
          aria-label="Next photo"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {card ? (
          <div key={openIndex} className={styles.slide}>
            <figure className={styles.figure}>
              <div
                className={styles.photoWrap}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <Image
                  src={card.photo}
                  alt={card.name}
                  className={styles.photo}
                  sizes="100vw"
                  placeholder="blur"
                  fill
                />
              </div>
              <figcaption className={styles.caption}>
                <h3 className={styles.name}>{card.name}</h3>
                <p className={styles.captionText}>{card.caption}</p>
              </figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
