/**
 * HighlightsSection — the "what's inside" beat after the hero.
 *
 * 5-card asymmetric magazine-plate grid. Spa is the hero card
 * (cols 1-7, rows 1-2); cinema and parlor stack to its right; supper
 * club and fireside close along the bottom with fireside as the wider
 * anchor. The section header is option E (the Virgil wink): a centered
 * gold starburst sitting alone over an italic Cormorant headline.
 *
 * Each card splits into two zones: a photo region on top (uncompromised
 * — no overlay wash, just the warm-filtered image) and a clean linen
 * caption strip below. Photos stay pristine; type lives on a surface
 * designed for type.
 *
 * Server component — owns the section, header, and the HIGHLIGHTS data.
 * The grid + shared photo gallery modal live in a small client wrapper
 * (HighlightsGrid) so clicking a card opens a full-res lightbox with
 * keyboard + swipe navigation across all five photos. Photo positioning
 * happens in the colocated module CSS; each card just gets a `gridArea`
 * class name.
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
import cinemaPhoto from "@brand/docs/photos/cinema.jpg";
import cocktailKitPhoto from "@brand/docs/photos/cocktail-kit.png";
import coffeeBarDetailPhoto from "@brand/docs/photos/coffee-bar-detail.png";
import coffeeBarPhoto from "@brand/docs/photos/coffee-bar.png";
import diningEveningPhoto from "@brand/docs/photos/dining-evening.png";
import diningTablescapePhoto from "@brand/docs/photos/dining-tablescape.png";
import diningWidePhoto from "@brand/docs/photos/dining-wide.png";
import firePitPhoto from "@brand/docs/photos/fire-pit.jpg";
import foyerArmchairPhoto from "@brand/docs/photos/foyer-armchair.png";
import foyerPhoto from "@brand/docs/photos/foyer.png";
import gameRoomWidePhoto from "@brand/docs/photos/game-room-wide.png";
import gameRoomPhoto from "@brand/docs/photos/game-room.jpg";
import heroPhoto from "@brand/docs/photos/hero.jpg";
import hotTubDuskPhoto from "@brand/docs/photos/hot-tub-dusk.png";
import hotTubPhoto from "@brand/docs/photos/hot-tub.jpg";
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
import supperClubPhoto from "@brand/docs/photos/supper-club.jpg";

import { Starburst } from "@/components/brand/Starburst";

import { HighlightsGrid, type HighlightCardData } from "./HighlightsGrid";
import type { RoomCardData } from "./RoomsStrip";
import styles from "./HighlightsSection.module.css";

const HIGHLIGHTS: readonly HighlightCardData[] = [
  {
    // Mobile-only card — fills the role the hero photo carousel plays on
    // desktop. Hidden on desktop via CSS.
    name: "Courtyard",
    caption:
      "a pergola, a hot tub, a fire pit — the whole backyard at dusk.",
    gridAreaClass: "cellCourtyard",
    photo: heroPhoto,
  },
  {
    name: "Spa",
    caption:
      "for eight, beneath a louvered pergola wrapped in string lights.",
    gridAreaClass: "cellSpa",
    photo: hotTubPhoto,
  },
  {
    name: "Cinema",
    caption:
      "one hundred and twenty inches, a popcorn machine, the lights down low.",
    gridAreaClass: "cellCinema",
    photo: cinemaPhoto,
  },
  {
    name: "Parlor",
    caption:
      "poker, foosball, ping pong, a record player, and a fully stocked bar.",
    gridAreaClass: "cellParlor",
    photo: gameRoomPhoto,
  },
  {
    name: "Supper club",
    caption:
      "eight chairs, low candles, the best conversations of the weekend.",
    gridAreaClass: "cellSupperClub",
    photo: supperClubPhoto,
  },
  {
    name: "Fireside",
    caption:
      "Adirondack chairs and a fenced yard that feels like nobody else exists.",
    gridAreaClass: "cellFireside",
    photo: firePitPhoto,
  },
];

// Supporting-cast rooms shown in the horizontal scrolling strip below the
// magazine grid. Every photo from the brand library lives here so the
// gallery modal can scroll across all angles + details of each room.
const ROOMS: readonly RoomCardData[] = [
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

export function HighlightsSection() {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div className={styles.headerMark}>
          <Starburst
            size={11}
            tier={6}
            color="#d4a930"
            secondary="#e8a040"
            center="#ff9050"
            axisOpacity={0.95}
            diagOpacity={0.7}
            terOpacity={0.5}
          />
        </div>
        <h2 className={styles.sectionTitle}>
          The part where you fall in{" "}
          <span className={styles.sectionTitleAccent}>love</span>
        </h2>
      </header>

      <HighlightsGrid magazine={HIGHLIGHTS} rooms={ROOMS} />
    </section>
  );
}
