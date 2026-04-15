/**
 * HeroPhotoCarousel — cycling photo column shown in the hero on desktop.
 *
 * All slides are mounted simultaneously and cross-fade via opacity. Auto-
 * advances every 7s, pauses on hover or when the tab is hidden, and skips
 * the timer entirely under prefers-reduced-motion (arrows + dots still work).
 * The caption remounts on index change so its fade-in is synced with the
 * photo swap.
 */

"use client";

import Image, { type StaticImageData } from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import styles from "./HeroPhotoCarousel.module.css";

export interface HeroCarouselPhoto {
  src: StaticImageData;
  alt: string;
  label: string;
  place: string;
}

interface HeroPhotoCarouselProps {
  photos: ReadonlyArray<HeroCarouselPhoto>;
  /** Milliseconds between auto-advances. Default 14000 (half-speed). */
  intervalMs?: number;
}

export function HeroPhotoCarousel({
  photos,
  intervalMs = 14000,
}: HeroPhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = photos.length;

  const goNext = useCallback(
    () => setCurrentIndex((i) => (i + 1) % count),
    [count],
  );
  const goPrev = useCallback(
    () => setCurrentIndex((i) => (i - 1 + count) % count),
    [count],
  );

  // Auto-advance. Skipped under reduced-motion and while paused.
  useEffect(() => {
    if (paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(goNext, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, goNext, intervalMs]);

  // Pause when the tab isn't visible (saves cycles, avoids a snap when
  // the user returns).
  useEffect(() => {
    const onVisibility = () => {
      setPaused(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  };

  const current = photos[currentIndex];

  return (
    <div
      ref={rootRef}
      className={styles.carousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={handleKeyDown}
      aria-roledescription="carousel"
      aria-label="Hero photo gallery"
    >
      {photos.map((photo, i) => {
        const active = i === currentIndex;
        return (
          <div
            key={photo.label}
            className={`${styles.slide} ${active ? styles.slideActive : ""}`}
            aria-hidden={!active}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority={i === 0}
              sizes="(max-width: 900px) 100vw, 40vw"
              placeholder="blur"
              className={styles.image}
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={goPrev}
        className={`${styles.arrow} ${styles.prev}`}
        aria-label="Previous photo"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={goNext}
        className={`${styles.arrow} ${styles.next}`}
        aria-label="Next photo"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        key={currentIndex}
        className={styles.caption}
        aria-live="polite"
      >
        <div className={styles.captionLabel}>{current.label}</div>
        <div className={styles.captionPlace}>{current.place}</div>
      </div>

      <div className={styles.dots} role="tablist" aria-label="Choose photo">
        {photos.map((photo, i) => (
          <button
            key={photo.label}
            type="button"
            role="tab"
            aria-selected={i === currentIndex}
            aria-label={`Show ${photo.label}`}
            onClick={() => setCurrentIndex(i)}
            className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
