/**
 * SleepingList — the bedroom-by-bedroom bed list. Renders the
 * static `SLEEPING_ARRANGEMENTS` from src/lib/property as a clean
 * scannable list. No photos — just labels + bed config (the
 * thing every group chat asks). The eyebrow follows the
 * QuoteReveal "The details" pattern so the trip page reads as
 * the same brand family.
 */

import { SLEEPING_ARRANGEMENTS } from "@/lib/property/sleepingArrangements";
import styles from "./SleepingList.module.css";

export function SleepingList() {
  return (
    <section className={styles.section} aria-labelledby="sleeping-eyebrow">
      <span id="sleeping-eyebrow" className={styles.eyebrow}>
        Where everyone sleeps
      </span>
      <ul className={styles.list}>
        {SLEEPING_ARRANGEMENTS.map((row) => (
          <li key={row.label} className={styles.row}>
            <div className={styles.label}>{row.label}</div>
            <div className={styles.beds}>
              {row.beds}
              {row.note ? (
                <span className={styles.note}> &middot; {row.note}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
