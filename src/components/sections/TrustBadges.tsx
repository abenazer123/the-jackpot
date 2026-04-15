/**
 * TrustBadges — credibility beat between the hero and the highlights
 * grid. Two platform cards (Airbnb + VRBO) with their native brand
 * logos + the host's actual accolades:
 *   - Airbnb: Guest favorite (with laurels), Superhost, Top 5% in Chicago
 *   - VRBO: 10/10 overall rating, "Exceptional" badge
 * An italic anchor line tallies the verified stays across platforms.
 *
 * Server component. Update the REVIEW constants as counts change.
 */

import { Starburst } from "@/components/brand/Starburst";

import styles from "./TrustBadges.module.css";

const AIRBNB_REVIEWS = 15;
const VRBO_REVIEWS = 5;
const TOTAL_REVIEWS = AIRBNB_REVIEWS + VRBO_REVIEWS;

// A single laurel branch. Used twice (second one is mirrored via CSS
// transform: scaleX(-1)) to flank the "Guest favorite" text the way
// Airbnb's native badge displays it.
function Laurel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 22 28"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Stem */}
      <path
        d="M17 2 C 13 8, 10 14, 9 22 L 10 27"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Leaves — alternating along the stem */}
      <ellipse cx="15" cy="5" rx="3.2" ry="1.4" transform="rotate(-55 15 5)" />
      <ellipse cx="13" cy="9" rx="3.6" ry="1.6" transform="rotate(-45 13 9)" />
      <ellipse cx="11" cy="13" rx="3.8" ry="1.7" transform="rotate(-30 11 13)" />
      <ellipse cx="10" cy="17.5" rx="3.8" ry="1.7" transform="rotate(-15 10 17.5)" />
      <ellipse cx="10" cy="22" rx="3.6" ry="1.6" transform="rotate(-5 10 22)" />
      <ellipse cx="11" cy="26" rx="3" ry="1.4" transform="rotate(10 11 26)" />
    </svg>
  );
}

// Small medal icon for the "Superhost" pill.
function MedalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 1l2 4 4 .6-3 2.8.7 4L8 10.4 4.3 12.4 5 8.4 2 5.6 6 5z" />
    </svg>
  );
}

export function TrustBadges() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.starburst}>
            <Starburst
              size={9}
              tier={6}
              color="#d4a930"
              secondary="#e8a040"
              center="#ff9050"
              axisOpacity={0.95}
              diagOpacity={0.7}
              terOpacity={0.5}
            />
          </div>
          <h2 className={styles.headline}>
            Rated <span className={styles.headlineAccent}>perfect</span> on
            every platform
          </h2>
        </header>

        <div className={styles.cards}>
          {/* ============================================
              Airbnb card
              ============================================ */}
          <div className={styles.card}>
            <div className={styles.logoRow}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, unoptimized */}
              <img
                src="/logos/airbnb.svg"
                alt="Airbnb"
                className={styles.airbnbLogo}
                width="96"
                height="30"
              />
            </div>

            <div className={styles.guestFavorite}>
              <Laurel className={styles.laurel} />
              <span className={styles.guestFavoriteText}>Guest favorite</span>
              <Laurel className={`${styles.laurel} ${styles.laurelRight}`} />
            </div>
            <p className={styles.guestFavoriteSub}>
              One of the most loved homes on Airbnb, according to guests.
            </p>

            <div className={styles.rating}>5.0</div>
            <div className={styles.stars} aria-label="5 out of 5 stars">
              ★★★★★
            </div>

            <div className={styles.pillRow}>
              <span className={`${styles.pill} ${styles.pillAirbnb}`}>
                <MedalIcon className={styles.pillIcon} />
                Superhost
              </span>
              <span className={`${styles.pill} ${styles.pillNeutral}`}>
                Top 5% in Chicago
              </span>
            </div>

            <div className={styles.reviewCount}>{AIRBNB_REVIEWS} reviews</div>
          </div>

          {/* ============================================
              VRBO card
              ============================================ */}
          <div className={styles.card}>
            <div className={styles.logoRow}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, unoptimized */}
              <img
                src="/logos/vrbo.svg"
                alt="Vrbo"
                className={styles.vrboLogo}
                width="90"
                height="28"
              />
            </div>

            <div className={styles.rating}>10/10</div>
            <div className={styles.ratingLabel}>overall rating</div>

            <div className={styles.pillRow}>
              <span className={`${styles.pill} ${styles.pillVrbo}`}>
                Exceptional
              </span>
              <span className={`${styles.pill} ${styles.pillVrbo}`}>
                <MedalIcon className={styles.pillIcon} />
                Premier Host
              </span>
            </div>

            <p className={styles.guestFavoriteSub}>
              Reserved for homes with 9+/10 ratings and verified-guest
              satisfaction.
            </p>

            <div className={styles.categoryScores}>
              <span>
                Cleanliness <strong className={styles.categoryScore}>10</strong>
              </span>
              <span className={styles.categoryDot}>·</span>
              <span>
                Check-in <strong className={styles.categoryScore}>10</strong>
              </span>
              <span className={styles.categoryDot}>·</span>
              <span>
                Communication <strong className={styles.categoryScore}>10</strong>
              </span>
            </div>

            <div className={styles.reviewCount}>{VRBO_REVIEWS} reviews</div>
          </div>
        </div>

        <p className={styles.anchor}>
          Perfect rating across {TOTAL_REVIEWS} verified stays
        </p>
      </div>
    </section>
  );
}
