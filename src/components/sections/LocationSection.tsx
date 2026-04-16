/**
 * LocationSection — "where you'll stay" beat between the highlights grid
 * and the testimonials.
 *
 * Names the neighborhood (North Park), grounds the Chicago claim with named
 * spots + specific drive times, and reframes any "is it too far from
 * downtown?" concern with a pull quote. Closes with a secondary CTA that
 * scrolls back to the hero booking form (#book).
 *
 * Phase 2 addition: a second row of occasion-specific proximity pills
 * (powered by OccasionProvider context) + overlay pins forwarded to the
 * map component.
 */

"use client";

import { useOccasion, type OccasionId } from "@/components/brand/OccasionProvider";
import { Starburst } from "@/components/brand/Starburst";

import { ChicagoMapViewer } from "./ChicagoMapViewer";
import styles from "./LocationSection.module.css";

interface Pill {
  time: string;
  label: string;
  sub?: string;
}

interface OccasionPillConfig {
  eyebrow: string;
  pills: Pill[];
}

const OCCASION_PILLS: Record<
  Exclude<OccasionId, "getaway">,
  OccasionPillConfig
> = {
  bachelorette: {
    eyebrow:
      "\u2014 what groups on Batch are searching for, within 20 minutes",
    pills: [
      { time: "20 min", label: "Boats" },
      { time: "12 min", label: "Hibachi row" },
      { time: "15 min", label: "Rooftop bars" },
      { time: "here", label: "Party bus pickups" },
      { time: "in-house", label: "Private chef" },
    ],
  },
  wedding: {
    eyebrow: "\u2014 venues within 22 minutes, plus 40+ others",
    pills: [
      { time: "8 min", label: "Artifact Events" },
      { time: "15 min", label: "Morgan MFG" },
      { time: "18 min", label: "West Loop", sub: "20+ venues" },
      { time: "20 min", label: "Lacuna Lofts" },
      { time: "22 min", label: "Bridgeport Art Center" },
    ],
  },
  family: {
    eyebrow: "\u2014 classics within 25 minutes",
    pills: [
      { time: "18 min", label: "Lincoln Park Zoo" },
      { time: "22 min", label: "Navy Pier" },
      { time: "25 min", label: "Field Museum" },
      { time: "25 min", label: "Shedd Aquarium" },
    ],
  },
  birthday: {
    eyebrow: "\u2014 dinner and drinks within 20 minutes",
    pills: [
      { time: "18 min", label: "West Loop dining", sub: "many spots" },
      { time: "15 min", label: "River North", sub: "many spots" },
      { time: "18 min", label: "Fulton Market" },
      { time: "15 min", label: "Rooftop bars" },
    ],
  },
};

interface Distance {
  time: string;
  label: string;
}

const DISTANCES: readonly Distance[] = [
  { time: "15 min", label: "to O'Hare" },
  { time: "16 min", label: "to downtown" },
  { time: "15 min", label: "to Wrigley Field" },
  { time: "12 min", label: "to Wicker Park" },
  { time: "9 min walk", label: "to the Blue Line" },
];

export function LocationSection() {
  const { occasion } = useOccasion();

  const showPills = occasion !== null && occasion !== "getaway";
  const pillConfig = showPills ? OCCASION_PILLS[occasion] : null;

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
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
          <h2 className={styles.headline}>
            Chicago&rsquo;s north side.
            <br />
            Quiet streets, loud weekends.
          </h2>
          <p className={styles.paragraph}>
            The Jackpot sits in North Park, a tree-lined neighborhood ten
            minutes from everything and a world away from downtown noise. Three
            breweries within walking distance. Some of the best Mexican and
            Filipino food in the city around the corner. And a backyard that
            makes most groups cancel their dinner reservations.
          </p>
          <p className={styles.namedSpots}>
            Half Acre Beer Garden &middot; Lula Cafe &middot; Old Irving
            Brewing &middot; Gene&rsquo;s Rooftop Wine Garden &mdash; all
            within 10 minutes.
          </p>
        </header>

        <div className={styles.split}>
          <ul className={styles.distanceList}>
            {DISTANCES.map((d) => (
              <li key={d.label} className={styles.distance}>
                <span className={styles.distanceTime}>{d.time}</span>
                <span className={styles.distanceLabel}>{d.label}</span>
              </li>
            ))}
          </ul>
          <div className={styles.mapWrap}>
            <ChicagoMapViewer occasion={occasion} />
          </div>
        </div>

        <div
          className={styles.occasionRow}
          data-occasion={occasion ?? "none"}
          aria-live="polite"
          key={occasion ?? "none"}
        >
          {pillConfig ? (
            <>
              <p className={styles.occasionEyebrow}>
                {pillConfig.eyebrow}
              </p>
              <ul className={styles.occasionList}>
                {pillConfig.pills.map((pill) => (
                  <li
                    key={`${occasion}-${pill.label}`}
                    className={styles.occasionPill}
                  >
                    <span className={styles.occasionTime}>
                      {pill.time}
                    </span>
                    <span className={styles.occasionLabel}>
                      {pill.label}
                      {pill.sub ? (
                        <span className={styles.occasionSub}>
                          {pill.sub}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className={styles.ctaWrap}>
          <a href="#inquiry" className={styles.cta}>
            <span className={styles.ctaText}>See the price guide</span>
          </a>
        </div>
      </div>
    </section>
  );
}
