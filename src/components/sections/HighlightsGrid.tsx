/**
 * HighlightsGrid — client wrapper that owns the unified photo-gallery modal
 * for both the magazine grid and the RoomsStrip below it. The two surfaces
 * dispatch into one shared modal: clicking a magazine card opens index `i`,
 * clicking a strip card opens index `magazine.length + i`. Arrow / swipe
 * cycling on the modal traverses the full combined set in order.
 */

"use client";

import { useCallback, useMemo, useState } from "react";

import sectionStyles from "./HighlightsSection.module.css";
import {
  PhotoGalleryModal,
  type GalleryCard,
} from "./PhotoGalleryModal";
import { RoomsStrip, type RoomCardData } from "./RoomsStrip";

export interface HighlightCardData extends GalleryCard {
  gridAreaClass: string;
}

interface HighlightsGridProps {
  magazine: readonly HighlightCardData[];
  rooms: readonly RoomCardData[];
}

export function HighlightsGrid({ magazine, rooms }: HighlightsGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Combined set drives the modal's prev/next cycling.
  const allCards = useMemo<readonly GalleryCard[]>(
    () => [
      ...magazine,
      ...rooms.map((r) => ({
        name: r.name,
        // Strip cards have no descriptive caption — fall back to the room name.
        caption: "",
        photo: r.photo,
      })),
    ],
    [magazine, rooms],
  );

  const handleClose = useCallback(() => setOpenIndex(null), []);

  const handlePrev = useCallback(() => {
    setOpenIndex((i) =>
      i === null ? null : (i - 1 + allCards.length) % allCards.length,
    );
  }, [allCards.length]);

  const handleNext = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i + 1) % allCards.length));
  }, [allCards.length]);

  const handleStripOpen = useCallback(
    (stripIndex: number) => setOpenIndex(magazine.length + stripIndex),
    [magazine.length],
  );

  return (
    <>
      <div className={sectionStyles.grid}>
        {magazine.map((card, i) => (
          <button
            key={card.name}
            type="button"
            className={`${sectionStyles.card} ${sectionStyles[card.gridAreaClass]}`}
            onClick={() => setOpenIndex(i)}
            aria-label={`Open ${card.name} photo`}
          >
            <div className={sectionStyles.cardPhoto} />
            <div className={sectionStyles.cardGradient} aria-hidden="true" />
            <div className={sectionStyles.cardCaption}>
              <h3 className={sectionStyles.cardName}>{card.name}</h3>
              <p className={sectionStyles.cardCaptionText}>{card.caption}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Cinematic Courtyard reveal — sits below the grid on desktop. Mobile
          uses flex order to hoist it above the grid so Courtyard still leads
          on phones. Clicking opens the unified gallery at the magazine's
          Courtyard index (expected to be 0). */}
      {(() => {
        const courtyardIndex = magazine.findIndex((c) => c.name === "Courtyard");
        if (courtyardIndex < 0) return null;
        return (
          <button
            type="button"
            className={sectionStyles.courtyardReveal}
            onClick={() => setOpenIndex(courtyardIndex)}
            aria-label="Open Courtyard photo"
          >
            <div className={sectionStyles.courtyardRevealPhoto} />
            <div className={sectionStyles.courtyardRevealGradient} aria-hidden="true" />
            <div className={sectionStyles.courtyardRevealCopy}>
              <h3 className={sectionStyles.courtyardRevealName}>Courtyard</h3>
              <p className={sectionStyles.courtyardRevealCaption}>
                a pergola, a hot tub, a fire pit &mdash; the whole backyard at dusk.
              </p>
            </div>
          </button>
        );
      })()}

      <RoomsStrip cards={rooms} onOpen={handleStripOpen} />

      <PhotoGalleryModal
        cards={allCards}
        openIndex={openIndex}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </>
  );
}
