/**
 * LocationSection — "where you'll stay" beat between the highlights grid
 * and the reveal photo.
 *
 * Names the neighborhood (North Park), grounds the Chicago claim with named
 * spots + specific drive times, and reframes any "is it too far from
 * downtown?" concern with a pull quote. Closes with a secondary CTA that
 * scrolls back to the hero booking form (#book).
 *
 * Server component.
 */

import { Starburst } from "@/components/brand/Starburst";

import { ChicagoMapViewer } from "./ChicagoMapViewer";
import styles from "./LocationSection.module.css";

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
            <ChicagoMapViewer />
          </div>
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
