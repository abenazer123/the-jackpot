/**
 * /trip/[token] — graceful expired/missing fallback.
 *
 * Renders for bogus tokens AND for trips past their 60-day
 * shared_at expiry. Frames the dead end as a *new* top-of-funnel
 * visit ("the property is still here — start fresh") rather than
 * a stark 404.
 */

import Link from "next/link";

import styles from "./not-found.module.css";

export default function TripNotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>The Jackpot</span>
        <h1 className={styles.headline}>This trip has moved on.</h1>
        <p className={styles.body}>
          The link may have expired, or it&rsquo;s for a stay we&rsquo;ve
          already wrapped up. The Jackpot is still here, though &mdash;
          new dates open all the time.
        </p>
        <Link href="/" className={styles.cta}>
          See the home
        </Link>
      </div>
    </main>
  );
}
