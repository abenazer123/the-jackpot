/**
 * MeetAbe — editorial "I'm Abe." trust section between the testimonials
 * and the final CTA. Humanizes the listing by putting a face and voice
 * behind the property.
 *
 * Universal — does NOT adapt to the selected occasion. Trust is
 * non-fragmented.
 *
 * Server component (no hooks, no state, no client interactivity).
 */

import Image from "next/image";

import abePhoto from "@brand/docs/photos/abe.jpg";

import styles from "./MeetAbe.module.css";

const HIGHLIGHTS: ReadonlyArray<{ lead: string; rest: string }> = [
  {
    lead: "A custom package built for your weekend",
    rest: "wedding party blocks, multi-night discounts, late checkout, anything the booking form won\u2019t let me offer",
  },
  {
    lead: "First access to my black book",
    rest: "private chefs, party bus connects, the wedding planners I trust, the restaurants worth the reservation",
  },
  {
    lead: "A real human responding in minutes",
    rest: "not a property manager twelve hours later",
  },
  {
    lead: "No Airbnb fees on your side",
    rest: "book direct, save more",
  },
];

export function MeetAbe() {
  return (
    <section className={styles.section} aria-labelledby="meet-abe-heading">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>&mdash; the person behind the keys</p>

        <div className={styles.photoWrap}>
          <Image
            src={abePhoto}
            alt="Abe at a gathering"
            className={styles.photo}
            sizes="(max-width: 768px) 100vw, 960px"
            priority={false}
            placeholder="blur"
          />
        </div>

        <h2 id="meet-abe-heading" className={styles.headline}>
          I&rsquo;m Abe.
        </h2>

        <div className={styles.body}>
          <p className={styles.paragraph}>
            I bought this house, designed it, and host it personally. Three
            years deep in the wedding and event venue world taught me what
            makes a weekend actually work &mdash; and I built The Jackpot to
            be that. No management company. No outsourced hospitality.
          </p>

          <p className={styles.paragraph}>
            When you book directly, a few things happen that don&rsquo;t
            happen on Airbnb:
          </p>

          <ul className={styles.highlights}>
            {HIGHLIGHTS.map((h) => (
              <li key={h.lead} className={styles.highlight}>
                <span className={styles.bullet} aria-hidden="true" />
                <span>
                  <strong className={styles.highlightLead}>{h.lead}</strong>
                  {" \u2014 "}
                  {h.rest}
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.closing}>
            Submit your dates above and I&rsquo;ll be in touch personally.
          </p>

          <p className={styles.signature} aria-hidden="true">
            &mdash; Abe
          </p>
        </div>
      </div>
    </section>
  );
}
