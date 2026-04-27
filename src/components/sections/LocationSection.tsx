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

import { useOccasion } from "@/components/brand/OccasionProvider";
import { Starburst } from "@/components/brand/Starburst";
import {
  DISTANCES,
  HEADLINE_LINE_1,
  HEADLINE_LINE_2,
  NAMED_SPOTS,
  OCCASION_PILLS,
  PARAGRAPH,
} from "@/lib/property/location";

import { ChicagoMapViewer } from "./ChicagoMapViewer";
import styles from "./LocationSection.module.css";

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
            {HEADLINE_LINE_1}
            <br />
            {HEADLINE_LINE_2}
          </h2>
          <p className={styles.paragraph}>{PARAGRAPH}</p>
          <p className={styles.namedSpots}>{NAMED_SPOTS}</p>
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
          <button
            type="button"
            className={styles.cta}
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-booking"));
            }}
          >
            <span className={styles.ctaText}>See the price guide</span>
          </button>
        </div>
      </div>
    </section>
  );
}
