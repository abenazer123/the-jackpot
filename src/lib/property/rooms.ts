/**
 * Shared room photo set — feeds both the landing-page rooms strip
 * and the trip-page rooms strip. Every entry is a strip card; the
 * gallery modal cycles across all of them in order.
 *
 * Each entry has the same slug-keyed structure as RoomCardData so
 * React keys stay unique even when several cards share a `name`
 * (e.g. three "Navy bedroom" entries for standard / wide / detail).
 */

import bathroomNavyShowerPhoto from "@brand/docs/photos/bathroom-navy-shower.png";
import bathroomNavyPhoto from "@brand/docs/photos/bathroom-navy.png";
import bathroomVanityPhoto from "@brand/docs/photos/bathroom-vanity.png";
import bedroomNavyWidePhoto from "@brand/docs/photos/bedroom-navy-wide.png";
import bedroomNavyPhoto from "@brand/docs/photos/bedroom-navy.png";
import bedroomSageWidePhoto from "@brand/docs/photos/bedroom-sage-wide.png";
import bedroomSagePhoto from "@brand/docs/photos/bedroom-sage.png";
import bedroomTealWidePhoto from "@brand/docs/photos/bedroom-teal-wide.png";
import bedroomTealPhoto from "@brand/docs/photos/bedroom-teal.png";
import bunkRoom2Photo from "@brand/docs/photos/bunk-room-2.png";
import bunkRoomPhoto from "@brand/docs/photos/bunk-room.png";
import cinemaSectionalPhoto from "@brand/docs/photos/cinema-sectional.png";
import cinemaWidePhoto from "@brand/docs/photos/cinema-wide.png";
import cocktailKitPhoto from "@brand/docs/photos/cocktail-kit.png";
import coffeeBarDetailPhoto from "@brand/docs/photos/coffee-bar-detail.png";
import coffeeBarPhoto from "@brand/docs/photos/coffee-bar.png";
import diningEveningPhoto from "@brand/docs/photos/dining-evening.png";
import diningTablescapePhoto from "@brand/docs/photos/dining-tablescape.png";
import diningWidePhoto from "@brand/docs/photos/dining-wide.png";
import foyerArmchairPhoto from "@brand/docs/photos/foyer-armchair.png";
import foyerPhoto from "@brand/docs/photos/foyer.png";
import gameRoomWidePhoto from "@brand/docs/photos/game-room-wide.png";
import hotTubDuskPhoto from "@brand/docs/photos/hot-tub-dusk.png";
import kitchenIslandPhoto from "@brand/docs/photos/kitchen-island.png";
import kitchenPhoto from "@brand/docs/photos/kitchen.png";
import linenShelfPhoto from "@brand/docs/photos/linen-shelf.png";
import livingRoom2DetailPhoto from "@brand/docs/photos/living-room-2-detail.png";
import livingRoom2Photo from "@brand/docs/photos/living-room-2.png";
import livingRoomCoffeeTablePhoto from "@brand/docs/photos/living-room-coffee-table.png";
import livingRoomPhoto from "@brand/docs/photos/living-room.png";
import patioCoffeePhoto from "@brand/docs/photos/patio-coffee.png";
import pingPongRoomPhoto from "@brand/docs/photos/ping-pong-room.png";
import quadBunkRoomDetailPhoto from "@brand/docs/photos/quad-bunk-room-detail.png";
import quadBunkRoomPhoto from "@brand/docs/photos/quad-bunk-room.png";
import readingNookDetailPhoto from "@brand/docs/photos/reading-nook-detail.png";
import readingNookPhoto from "@brand/docs/photos/reading-nook.png";
import recordPlayerPhoto from "@brand/docs/photos/record-player.png";
import showerDetailPhoto from "@brand/docs/photos/shower-detail.png";

import type { RoomCardData } from "@/components/sections/RoomsStrip";

export const ROOMS: readonly RoomCardData[] = [
  // Living spaces
  { name: "Living room",         slug: "living-room",         photo: livingRoomPhoto },
  { name: "Living room",         slug: "living-room-coffee",  photo: livingRoomCoffeeTablePhoto },
  { name: "Living room",         slug: "living-room-2",       photo: livingRoom2Photo },
  { name: "Living room",         slug: "living-room-2-detail", photo: livingRoom2DetailPhoto },
  { name: "Foyer",               slug: "foyer",               photo: foyerPhoto },
  { name: "Foyer",               slug: "foyer-armchair",      photo: foyerArmchairPhoto },
  { name: "Reading nook",        slug: "reading-nook",        photo: readingNookPhoto },
  { name: "Reading nook",        slug: "reading-nook-detail", photo: readingNookDetailPhoto },

  // Kitchen + coffee
  { name: "Kitchen",             slug: "kitchen",             photo: kitchenPhoto },
  { name: "Kitchen",             slug: "kitchen-island",      photo: kitchenIslandPhoto },
  { name: "Coffee bar",          slug: "coffee-bar",          photo: coffeeBarPhoto },
  { name: "Coffee bar",          slug: "coffee-bar-detail",   photo: coffeeBarDetailPhoto },

  // Dining
  { name: "Dining",              slug: "dining-wide",         photo: diningWidePhoto },
  { name: "Dining",              slug: "dining-evening",      photo: diningEveningPhoto },
  { name: "Tablescape",          slug: "dining-tablescape",   photo: diningTablescapePhoto },

  // Bedrooms
  { name: "Navy bedroom",        slug: "bedroom-navy",        photo: bedroomNavyPhoto },
  { name: "Navy bedroom",        slug: "bedroom-navy-wide",   photo: bedroomNavyWidePhoto },
  { name: "Teal bedroom",        slug: "bedroom-teal",        photo: bedroomTealPhoto },
  { name: "Teal bedroom",        slug: "bedroom-teal-wide",   photo: bedroomTealWidePhoto },
  { name: "Sage bedroom",        slug: "bedroom-sage",        photo: bedroomSagePhoto },
  { name: "Sage bedroom",        slug: "bedroom-sage-wide",   photo: bedroomSageWidePhoto },

  // Bunks
  { name: "Bunk room",           slug: "bunk-room",           photo: bunkRoomPhoto },
  { name: "Bunk room",           slug: "bunk-room-2",         photo: bunkRoom2Photo },
  { name: "Quad bunk room",      slug: "quad-bunk-room",      photo: quadBunkRoomPhoto },
  { name: "Quad bunk room",      slug: "quad-bunk-room-detail", photo: quadBunkRoomDetailPhoto },

  // Bathrooms
  { name: "Bathroom",            slug: "bathroom",            photo: bathroomVanityPhoto },
  { name: "Shower",              slug: "shower-detail",       photo: showerDetailPhoto },
  { name: "Navy bathroom",       slug: "bathroom-navy",       photo: bathroomNavyPhoto },
  { name: "Navy bathroom",       slug: "bathroom-navy-shower", photo: bathroomNavyShowerPhoto },
  { name: "Linen shelf",         slug: "linen-shelf",         photo: linenShelfPhoto },

  // Game + entertainment
  { name: "Game room",           slug: "game-room-ping-pong", photo: pingPongRoomPhoto },
  { name: "Parlor",              slug: "parlor-wide",         photo: gameRoomWidePhoto },
  { name: "Record player",       slug: "record-player",       photo: recordPlayerPhoto },
  { name: "Cocktail kit",        slug: "cocktail-kit",        photo: cocktailKitPhoto },

  // Cinema
  { name: "Cinema",              slug: "cinema-wide",         photo: cinemaWidePhoto },
  { name: "Cinema",              slug: "cinema-sectional",    photo: cinemaSectionalPhoto },

  // Outdoor
  { name: "Hot tub",             slug: "hot-tub-dusk",        photo: hotTubDuskPhoto },
  { name: "Patio",               slug: "patio-coffee",        photo: patioCoffeePhoto },
];
