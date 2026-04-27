/**
 * PhotoGrid — compact 4-up photo grid for the trip page.
 *
 * Lighter than the landing-hero carousel — no auto-advance, no
 * arrows, no dots. Just four well-cropped images so the friend
 * gets a sense of the home beyond the cover shot. The hero
 * carousel at the top already does the dramatic-photo job.
 *
 * Pulls 4 photos from `BRAND_PHOTOS` skipping the cover (which
 * already runs at the top). Order: spa, fireside, parlor, supper
 * club — the most "evening with friends" feeling shots.
 */

import Image from "next/image";

import { BRAND_PHOTOS } from "@/lib/property/photos";
import styles from "./PhotoGrid.module.css";

const GRID_PHOTOS = BRAND_PHOTOS.slice(1, 5);

export function PhotoGrid() {
  return (
    <section className={styles.section} aria-label="Around the house">
      <div className={styles.grid}>
        {GRID_PHOTOS.map((photo) => (
          <div key={photo.label} className={styles.cell}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 600px) 50vw, 240px"
              placeholder="blur"
              className={styles.image}
            />
            <div className={styles.caption}>
              <span className={styles.captionLabel}>{photo.label}</span>
              <span className={styles.captionPlace}>{photo.place}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
