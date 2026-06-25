/**
 * BachProof — section 7 lead-in of /bachelorette. Fear-matched proof
 * header that sits above the reused <Testimonials/> (bachelorette-sorted)
 * and <TrustBadges/>. The differentiator slot (thank-you texts +
 * handwritten notes) is a placeholder until those assets exist.
 */

import styles from "./bachelorette.module.css";

export function BachProof() {
  return (
    <section className={`${styles.section} ${styles.linen}`}>
      <div className={styles.inner}>
        <div className={styles.proofHead}>
          <p className={styles.kicker}>Groups like yours</p>
          <h2 className={styles.display}>
            Groups like yours, weekends like this.
          </h2>
          <p className={styles.sub}>
            Everyone had a bed. Nobody looked at the time.
          </p>
        </div>

        <div
          className={styles.assetSlot}
          data-asset-slot="proof-texts-notes"
          aria-hidden="true"
        >
          The texts and notes after: thank-you screenshots and handwritten
          notes (to add)
        </div>
      </div>
    </section>
  );
}
