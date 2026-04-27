/**
 * TripHero — eyebrow + headline lockup for the trip portal page.
 *
 * Sits immediately under the photo strip so the context lands in
 * the same eye-fixation as the cover image. The eyebrow makes the
 * page feel like an *invitation* (from {firstName}), not a
 * generic listing.
 */

import styles from "./TripHero.module.css";

interface TripHeroProps {
  firstName: string;
  dateRange: string;
  occasion: string;
}

export function TripHero({ firstName, dateRange, occasion }: TripHeroProps) {
  return (
    <header className={styles.header}>
      <span className={styles.eyebrow}>An invitation from {firstName}</span>
      <h1 className={styles.headline}>
        The Jackpot &middot; {dateRange}
      </h1>
      <p className={styles.sub}>{occasion} weekend</p>
    </header>
  );
}
