/**
 * SleepingList — the bedroom-by-bedroom bed list. Renders the
 * static `SLEEPING_ARRANGEMENTS` from src/lib/property as a clean
 * scannable list. Leads with the total-bed count so the group
 * sees the magnitude before scanning the breakdown.
 */

import {
  SLEEPING_ARRANGEMENTS,
  TOTAL_BEDS,
} from "@/lib/property/sleepingArrangements";
import styles from "./SleepingList.module.css";

export function SleepingList() {
  return (
    <section className={styles.section} aria-labelledby="sleeping-eyebrow">
      <span id="sleeping-eyebrow" className={styles.eyebrow}>
        Where everyone sleeps
      </span>
      <p className={styles.intro}>
        <span className={styles.introCount}>{TOTAL_BEDS}</span>
        <span className={styles.introText}>
          individual beds &mdash; here&rsquo;s the breakdown.
        </span>
      </p>
      <ul className={styles.list}>
        {SLEEPING_ARRANGEMENTS.map((row) => (
          <li key={row.label} className={styles.row}>
            <div className={styles.label}>{row.label}</div>
            <div className={styles.beds}>{row.beds}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
