/**
 * RoomsStrip — horizontal scrolling carousel of small room cards. Sits below
 * the magazine highlights grid and shares the unified PhotoGalleryModal that
 * HighlightsGrid owns. Each card click delegates to `onOpen(i)` so the
 * parent can offset the index into the combined cards array.
 *
 * No own state — pure presentation + click delegation. The strip natively
 * scrolls (touch / mouse wheel / scrollbar) and snaps to each card; on
 * desktop, hover-revealed arrow buttons scroll the strip in card-width
 * chunks for users who don't have a touch surface.
 */

"use client";

import Image, { type StaticImageData } from "next/image";
import { useRef } from "react";

import styles from "./RoomsStrip.module.css";

export interface RoomCardData {
  name: string;
  photo: StaticImageData;
  /** kebab-case slug, used for future filename mapping (e.g. "bedroom-1"). */
  slug: string;
  isPlaceholder?: boolean;
}

interface RoomsStripProps {
  cards: readonly RoomCardData[];
  /** Called with the strip-local index when a card is clicked. The parent
   * adds its magazine offset before opening the modal. */
  onOpen: (index: number) => void;
}

export function RoomsStrip({ cards, onOpen }: RoomsStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const firstCard = strip.querySelector("button");
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 240;
    const gap = 16;
    strip.scrollBy({
      left: direction * (cardWidth + gap) * 2,
      behavior: "smooth",
    });
  };

  return (
    <section className={styles.section}>
      <h3 className={styles.subhead}>And every other room</h3>

      <div className={styles.stripWrap}>
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className={`${styles.arrow} ${styles.arrowPrev}`}
          aria-label="Scroll rooms left"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <div className={styles.strip} ref={stripRef}>
          {cards.map((card, i) => (
            <button
              key={card.slug}
              type="button"
              className={styles.card}
              onClick={() => onOpen(i)}
              aria-label={`Open ${card.name} photo`}
            >
              <div className={styles.cardPhoto}>
                <Image
                  src={card.photo}
                  alt={`${card.name} photo`}
                  fill
                  sizes="(max-width: 900px) 60vw, 240px"
                  className={styles.cardPhotoImg}
                />
                {card.isPlaceholder ? (
                  <span className={styles.placeholderBadge}>Placeholder</span>
                ) : null}
              </div>
              <div className={styles.cardCaption}>
                <h4 className={styles.cardName}>{card.name}</h4>
              </div>
            </button>
          ))}
        </div>

        <span className={styles.edgeFade + " " + styles.edgeFadeLeft} aria-hidden="true" />
        <span className={styles.edgeFade + " " + styles.edgeFadeRight} aria-hidden="true" />

        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className={`${styles.arrow} ${styles.arrowNext}`}
          aria-label="Scroll rooms right"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
