/**
 * TripPhotoStrip — trip-page mirror of the landing-page rooms strip.
 *
 * Sits below the 4-up PhotoGrid and surfaces the same full ROOMS set
 * the landing page uses, so a friend who wants to see *everything*
 * can scroll through every angle + detail in the same lightbox the
 * landing page provides.
 *
 * Owns the modal open/close state locally — no coordination needed
 * with the magazine grid (which doesn't exist on the trip page).
 */

"use client";

import { useCallback, useMemo, useState } from "react";

import {
  PhotoGalleryModal,
  type GalleryCard,
} from "@/components/sections/PhotoGalleryModal";
import { RoomsStrip } from "@/components/sections/RoomsStrip";
import { ROOMS } from "@/lib/property/rooms";

export function TripPhotoStrip() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const cards = useMemo<readonly GalleryCard[]>(
    () =>
      ROOMS.map((r) => ({
        name: r.name,
        caption: "",
        photo: r.photo,
      })),
    [],
  );

  const handleClose = useCallback(() => setOpenIndex(null), []);
  const handlePrev = useCallback(() => {
    setOpenIndex((i) =>
      i === null ? null : (i - 1 + cards.length) % cards.length,
    );
  }, [cards.length]);
  const handleNext = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i + 1) % cards.length));
  }, [cards.length]);

  return (
    <>
      <RoomsStrip cards={ROOMS} onOpen={setOpenIndex} />
      <PhotoGalleryModal
        cards={cards}
        openIndex={openIndex}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </>
  );
}
