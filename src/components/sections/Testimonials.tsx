/**
 * Testimonials — horizontal scrolling carousel of real 5-star guest
 * quotes from Airbnb and VRBO. Curated from the actual review pages:
 *   Airbnb: https://www.airbnb.com/rooms/1517776645045787467/reviews
 *   VRBO:   https://www.vrbo.com/4913261
 *
 * Every review in this carousel is a verbatim excerpt (trimmed to 2–4
 * sentences) from a real guest. The "Verified guest · Read on …" footer
 * link sends visitors straight to the platform's review page so they can
 * confirm the quote themselves. Each card alternates between platforms so
 * the social proof reads as balanced across both channels.
 *
 * Structurally mirrors RoomsStrip: native overflow-x strip, scroll-snap,
 * hover-revealed arrow buttons on desktop, natural swipe on touch.
 */

"use client";

import { useRef } from "react";

import styles from "./Testimonials.module.css";

type Platform = "airbnb" | "vrbo";

interface Testimonial {
  quote: string;
  name: string;
  occasion: string;
  platform: Platform;
}

const AIRBNB_REVIEWS_URL =
  "https://www.airbnb.com/rooms/1517776645045787467/reviews";
const VRBO_REVIEWS_URL = "https://www.vrbo.com/4913261";

const TESTIMONIALS: ReadonlyArray<Testimonial> = [
  {
    // Christine Short · Airbnb · Nov 2025
    quote:
      "If you are reading this review while searching for a rental property in Chicago, just stop immediately. THIS IS THE PLACE. Guaranteed.",
    name: "Christine S.",
    occasion: "Chicago getaway",
    platform: "airbnb",
  },
  {
    // Margaret P. · VRBO · Nov 2025 · Traveled with family and young children
    quote:
      "Tucked in the middle of a friendly Chicago neighborhood, it truly felt like we were in an urban oasis. The kids loved the bunk beds, ping pong table and of course the hot tub. Abe was super responsive and went well above and beyond.",
    name: "Margaret P.",
    occasion: "Family visit",
    platform: "vrbo",
  },
  {
    // Kim · Airbnb · 3 weeks ago · Group trip
    quote:
      "We had a bachelorette party for 13 guests. Everyone had a bed, a place to eat, and a place to sit around and relax. It was really well done.",
    name: "Kim",
    occasion: "Bachelorette party",
    platform: "airbnb",
  },
  {
    // Rob M. · VRBO · Feb 2026 · Traveled with family and young children
    quote:
      "The house was very clean and comfortable. The kids loved the hot tub and the movie room. The host was very attentive and available for any questions we had.",
    name: "Rob M.",
    occasion: "Family weekend",
    platform: "vrbo",
  },
  {
    // Becky · Airbnb · Feb 2026 · Group trip
    quote:
      "The kitchen was the perfect space for entertaining for a girl\u2019s night! The outdoor hot tub and fire pit were a great bonus. Go ahead and save for your next girls trip to Chicago!",
    name: "Becky",
    occasion: "Girls\u2019 trip",
    platform: "airbnb",
  },
  {
    // Jo Ann S. · VRBO · Mar 2026 · Traveled with partner
    quote:
      "Clean, well-stocked, great amenities, inviting decor, accessible location. The host is organized, flexible, thoughtful and supportive.",
    name: "Jo Ann S.",
    occasion: "Couples getaway",
    platform: "vrbo",
  },
  {
    // Nathan · Airbnb · March 2026 · Group trip
    quote:
      "Phenomenal space! It was perfect for my large group of 14!",
    name: "Nathan",
    occasion: "Friends getaway",
    platform: "airbnb",
  },
  {
    // Gerry-Lynn W. · VRBO · Apr 2026 · Traveled with family and young children
    quote:
      "This exceeded our expectations. The home was even nicer in person and the host was attentive every step of the way. It felt like we were staying at a 5-star hotel. We will definitely book again next time we are in Chicago.",
    name: "Gerry-Lynn W.",
    occasion: "Family trip",
    platform: "vrbo",
  },
];

function VerifiedCheck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="5.25" fill="currentColor" opacity="0.15" />
      <path
        d="M3.5 6.2l1.7 1.7 3.3-3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function sourceLabel(platform: Platform): { label: string; url: string } {
  return platform === "airbnb"
    ? { label: "Read on Airbnb", url: AIRBNB_REVIEWS_URL }
    : { label: "Read on VRBO", url: VRBO_REVIEWS_URL };
}

export function Testimonials() {
  const stripRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const firstCard = strip.querySelector("article");
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 300;
    const gap = 18;
    strip.scrollBy({
      left: direction * (cardWidth + gap) * 2,
      behavior: "smooth",
    });
  };

  return (
    <section className={styles.section} aria-labelledby="testimonials-heading">
      <div className={styles.inner}>
        <h2 id="testimonials-heading" className={styles.headline}>
          What guests are saying
        </h2>

        <div className={styles.stripWrap}>
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            className={`${styles.arrow} ${styles.arrowPrev}`}
            aria-label="Scroll testimonials left"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          <div className={styles.strip} ref={stripRef}>
            {TESTIMONIALS.map((t, i) => {
              const source = sourceLabel(t.platform);
              return (
                <article key={`${t.name}-${i}`} className={styles.card}>
                  <div className={styles.top}>
                    <span
                      className={styles.stars}
                      aria-label="5 out of 5 stars"
                    >
                      {"\u2605\u2605\u2605\u2605\u2605"}
                    </span>
                    <span
                      className={`${styles.platform} ${
                        t.platform === "airbnb"
                          ? styles.platform_airbnb
                          : styles.platform_vrbo
                      }`}
                    >
                      {t.platform === "airbnb" ? "Airbnb" : "VRBO"}
                    </span>
                  </div>

                  <p className={styles.quote}>
                    {"\u201C"}
                    {t.quote}
                    {"\u201D"}
                  </p>

                  <footer className={styles.footer}>
                    <p className={styles.name}>
                      {t.name}
                      <span className={styles.verified}>
                        <VerifiedCheck className={styles.verifiedIcon} />
                        Verified guest
                      </span>
                    </p>
                    <p className={styles.occasion}>{t.occasion}</p>
                    <a
                      className={`${styles.sourceLink} ${
                        t.platform === "airbnb"
                          ? styles.platform_airbnb
                          : styles.platform_vrbo
                      }`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.label}
                      {"\u00a0\u2197"}
                    </a>
                  </footer>
                </article>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollByCard(1)}
            className={`${styles.arrow} ${styles.arrowNext}`}
            aria-label="Scroll testimonials right"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className={styles.allLinkRow}>
          <a
            className={styles.allLink}
            href={AIRBNB_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            See all reviews &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
