/**
 * TripLocation — the trip portal's "where it is" section. Pulls
 * the rich landing-page location content (North Park headline,
 * paragraph, named spots, proximity pills, ChicagoMapViewer SVG)
 * and adds the occasion-specific pill row when the inquiry's
 * reason maps to a supported occasion.
 *
 * Same single-source-of-truth content as LocationSection — both
 * surfaces import from src/lib/property/location.ts.
 */

"use client";

import type { OccasionId } from "@/components/brand/OccasionProvider";
import { Starburst } from "@/components/brand/Starburst";
import { ChicagoMapViewer } from "@/components/sections/ChicagoMapViewer";
import {
  DISTANCES,
  HEADLINE_LINE_1,
  HEADLINE_LINE_2,
  NAMED_SPOTS,
  OCCASION_PILLS,
  PARAGRAPH,
} from "@/lib/property/location";

import styles from "./TripLocation.module.css";

interface TripLocationProps {
  /** Pre-mapped from inquiry.reason via reasonToOccasion(). null
   *  for "Work retreat" / "Other" / unset reasons — we just skip
   *  the occasion pill row in that case. */
  occasion: OccasionId | null;
}

export function TripLocation({ occasion }: TripLocationProps) {
  const showPills = occasion !== null && occasion !== "getaway";
  const pillConfig = showPills ? OCCASION_PILLS[occasion] : null;

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.mark}>
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

      {pillConfig ? (
        <div
          className={styles.occasionRow}
          aria-live="polite"
          key={occasion}
        >
          <p className={styles.occasionEyebrow}>{pillConfig.eyebrow}</p>
          <ul className={styles.occasionList}>
            {pillConfig.pills.map((pill) => (
              <li key={pill.label} className={styles.occasionPill}>
                <span className={styles.occasionTime}>{pill.time}</span>
                <span className={styles.occasionLabel}>
                  {pill.label}
                  {pill.sub ? (
                    <span className={styles.occasionSub}>{pill.sub}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
