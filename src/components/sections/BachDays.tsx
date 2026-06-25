/**
 * BachDays — Scene 4: the days fill in. Introduce the boat, glam, chef as
 * desire, as story beats, before they ever become a price (seeds the
 * package). Outcome tiles, image + one line. Experience photography doesn't
 * exist yet, so each tile holds its icon + line as a marked slot.
 */

import { EXPERIENCE_TILES } from "@/lib/bachelorette/packages";
import { BachIcon } from "@/components/brand/BachIcon";
import styles from "./bachelorette.module.css";

export function BachDays() {
  return (
    <section className={`${styles.section} ${styles.deep}`}>
      <div className={styles.inner}>
        <div className={styles.sceneHead}>
          <p className={styles.kicker}>The days</p>
          <h2 className={styles.display}>And then the good part.</h2>
        </div>

        <div className={styles.tileRow}>
          {EXPERIENCE_TILES.map((t) => (
            <div
              key={t.line}
              className={`${styles.tile} ${styles.tileSlot}`}
              data-asset-slot="experience-photo"
            >
              <span className={styles.tileIcon}>
                <BachIcon k={t.icon} size={26} />
              </span>
              <span className={styles.tileCaption}>{t.line}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
