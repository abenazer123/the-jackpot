/**
 * BachCrew — Scene 3: the crew arrives. The togetherness payoff, felt
 * through people, not described. This is where the "empty room" problem
 * gets fixed: only real group photos (daylight, getting-ready, rooms full
 * of people) belong here. Until those exist, the scene holds marked slots.
 */

import styles from "./bachelorette.module.css";

const CREW_SLOTS = [
  "Getting ready, side by side at the mirror (group photo, daylight)",
  "The whole crew in the kitchen (group photo)",
  "Out on the courtyard together (group photo)",
];

export function BachCrew() {
  return (
    <section className={`${styles.section} ${styles.linen}`}>
      <div className={styles.inner}>
        <div className={styles.sceneHead}>
          <p className={styles.kicker}>The whole crew</p>
          <h2 className={styles.display}>Everyone under one roof.</h2>
          <p className={styles.sub}>
            Get ready side by side. Never miss a moment.
          </p>
        </div>

        <div className={styles.tileRow}>
          {CREW_SLOTS.map((label) => (
            <div
              key={label}
              className={`${styles.tile} ${styles.tileSlot}`}
              data-asset-slot="crew-photo"
              aria-hidden="true"
            >
              <span className={styles.tileCaption}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
