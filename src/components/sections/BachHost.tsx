/**
 * BachHost — Scene 8: your host, and the instant-vs-personal contradiction
 * resolved. Olivia is the fast helper, Abe is the human who owns it.
 * Dash-free. Reuses the founder photo. (Separate from the shared MeetAbe so
 * the bachelorette voice and the roles framing stay specific here.)
 */

import Image from "next/image";

import abePhoto from "@brand/docs/photos/abe.jpg";

import styles from "./bachelorette.module.css";

export function BachHost() {
  return (
    <section className={`${styles.section} ${styles.linen}`}>
      <div className={styles.inner}>
        <div className={styles.hostGrid}>
          <Image
            className={styles.hostPhoto}
            src={abePhoto}
            alt="Abe, the host of The Jackpot"
            placeholder="blur"
            sizes="(max-width: 760px) 100vw, 360px"
          />
          <div className={styles.hostBody}>
            <p className={styles.kicker}>Your host</p>
            <h2 className={styles.display} style={{ marginBottom: 18 }}>
              The person behind the keys.
            </h2>
            <p>
              I am Abe. I bought this house, designed it, and host it myself.
              No management company. Three years in the wedding and event
              world taught me what makes a weekend work, and I built The
              Jackpot to be exactly that.
            </p>
            <p className={styles.hostRoles}>
              Olivia helps you plan in seconds, any time. I handle your actual
              weekend, personally. Book direct and you get a weekend built for
              your group, my black book of chefs and boats and planners, and
              no platform fees.
            </p>
            <p className={styles.hostSign}>Abe</p>
          </div>
        </div>
      </div>
    </section>
  );
}
