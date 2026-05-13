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
import cinemaPhoto from "@brand/docs/photos/cinema.jpg";
import firePitPhoto from "@brand/docs/photos/fire-pit.jpg";
import gameRoomPhoto from "@brand/docs/photos/game-room.jpg";
import heroPhoto from "@brand/docs/photos/hero.jpg";
import hotTubPhoto from "@brand/docs/photos/hot-tub.jpg";
import supperClubPhoto from "@brand/docs/photos/supper-club.jpg";

import { Starburst } from "@/components/brand/Starburst";
import { ROOMS } from "@/lib/property/rooms";

import { HighlightsGrid, type HighlightCardData } from "./HighlightsGrid";
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
