/**
 * The Jackpot — curated brand photo set.
 *
 * Single source of truth for the photo strip rendered on the
 * landing hero AND the trip portal page. Adding / reordering
 * here updates both surfaces.
 *
 * The cover image (index 0) is also used by the trip portal's
 * dynamic OG image as the unfurl background.
 */

import type { StaticImageData } from "next/image";

import cinemaPhoto from "@brand/docs/photos/cinema.jpg";
import firePitPhoto from "@brand/docs/photos/fire-pit.jpg";
import gameRoomPhoto from "@brand/docs/photos/game-room.jpg";
import heroPhoto from "@brand/docs/photos/hero.jpg";
import hotTubPhoto from "@brand/docs/photos/hot-tub.jpg";
import supperClubPhoto from "@brand/docs/photos/supper-club.jpg";

export interface BrandPhoto {
  src: StaticImageData;
  alt: string;
  label: string;
  place: string;
}

export const BRAND_PHOTOS: ReadonlyArray<BrandPhoto> = [
  {
    src: heroPhoto,
    alt: "The Jackpot — courtyard at dusk",
    label: "THE COURTYARD",
    place: "at dusk",
  },
  {
    src: hotTubPhoto,
    alt: "The Jackpot — spa after dark",
    label: "THE SPA",
    place: "after dark",
  },
  {
    src: firePitPhoto,
    alt: "The Jackpot — fireside with embers up",
    label: "THE FIRESIDE",
    place: "embers up",
  },
  {
    src: gameRoomPhoto,
    alt: "The Jackpot — parlor with the bar open",
    label: "THE PARLOR",
    place: "bar open",
  },
  {
    src: cinemaPhoto,
    alt: "The Jackpot — cinema with the lights down",
    label: "THE CINEMA",
    place: "lights down",
  },
  {
    src: supperClubPhoto,
    alt: "The Jackpot — supper club at seven o'clock",
    label: "THE SUPPER CLUB",
    place: "seven o'clock",
  },
];

/** Cover photo — used for the OG image background and as the
 *  natural first frame on the trip page. */
export const COVER_PHOTO = BRAND_PHOTOS[0];
