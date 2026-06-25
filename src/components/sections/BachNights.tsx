/**
 * BachNights — Scene 5: the nights, and the mornings after. Closes the
 * emotional arc and lands the keepsake. Night palette belongs here. "Stay
 * in" uses a real room photo; the recovery brunch and the recap keepsake
 * are slots until that media exists.
 */

import Image from "next/image";

import cinemaPhoto from "@brand/docs/photos/cinema.jpg";

import styles from "./bachelorette.module.css";

export function BachNights() {
  return (
    <section className={`${styles.section} ${styles.linen}`}>
      <div className={styles.inner}>
        <div className={styles.sceneHead}>
          <p className={styles.kicker}>The nights, and the mornings after</p>
          <h2 className={styles.display}>Stay in. It is better here.</h2>
        </div>

        <div className={styles.tileRow}>
          <div className={styles.tile}>
            <Image
              className={styles.tileImg}
              src={cinemaPhoto}
              alt="The Jackpot cinema with the lights down"
              placeholder="blur"
              sizes="(max-width: 760px) 100vw, 33vw"
            />
            <span className={styles.tileScrim} aria-hidden="true" />
            <span className={styles.tileCaption}>
              The parlor, the cinema, the hot tub. Better than the bar.
            </span>
          </div>

          <div
            className={`${styles.tile} ${styles.tileSlot}`}
            data-asset-slot="morning-brunch"
          >
            <span className={styles.tileCaption}>
              The recovery brunch, handled. (morning photo to add)
            </span>
          </div>

          <div
            className={`${styles.tile} ${styles.tileSlot}`}
            data-asset-slot="recap-clip"
          >
            <span className={styles.tileCaption}>
              And a video to remember all of it. (recap clip to add)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
