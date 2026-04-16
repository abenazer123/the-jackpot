/**
 * OccasionSelector — "What are you planning?" self-identification section.
 * Five occasion tabs with per-occasion content cards (tagline + copy +
 * highlights + CTA). Wedding tab adds a venue input + "text Abe" link.
 *
 * Reads/writes occasion state from OccasionProvider so future sections
 * can adapt content downstream.
 */

"use client";

import {
  useOccasion,
  type OccasionId,
} from "@/components/brand/OccasionProvider";

import styles from "./OccasionSelector.module.css";

interface OccasionData {
  emoji: string;
  label: string;
  sublabel: string;
  tagline: string;
  paragraph: string;
  highlights: string[];
  cta: string;
}

const OCCASION_IDS: ReadonlyArray<OccasionId> = [
  "bachelorette",
  "wedding",
  "family",
  "birthday",
  "getaway",
];

const OCCASIONS: Record<OccasionId, OccasionData> = {
  bachelorette: {
    emoji: "\uD83D\uDC8D",
    label: "Bachelorette",
    sublabel: "or bachelor",
    tagline: "Your last fling before the ring.",
    paragraph:
      "Thirteen of your favorite humans, one house, three full days. A hot tub for the post-dinner debrief. A parlor with a record player and a fully stocked bar. Getting-ready light in every bedroom. The kind of weekend that becomes a group chat reference for the next decade.",
    highlights: [
      "Sleeps 14 \u2014 no air mattresses, no drawing straws",
      "Hot tub, fire pit, game room, cinema",
      "15 minutes from the boats, the bars, the bottomless brunch",
      "Listed on Batch as a Chicago go-to stay",
    ],
    cta: "Build your weekend",
  },
  wedding: {
    emoji: "\uD83E\uDD0D",
    label: "Wedding",
    sublabel: "bride, groom, or both",
    tagline: "Your bridal party\u2019s home base.",
    paragraph:
      "A 14-person house ten to twenty minutes from most Chicago wedding venues. A natural-light parlor for getting-ready photos. A dining room for the morning-after brunch. One booking instead of eight hotel rooms \u2014 and a fraction of the downtown rate. Tell us where you\u2019re getting married and we\u2019ll put together a custom package.",
    highlights: [
      "10\u201320 min from 40+ Chicago wedding venues",
      "Sleeps the whole bridal party in real beds",
      "Getting-ready space with natural light and mirrors",
      "~$57/person vs. $108+/person at downtown hotels",
    ],
    cta: "Tell us about your wedding",
  },
  family: {
    emoji: "\uD83C\uDFE1",
    label: "Family",
    sublabel: "reunions, holidays, visits",
    tagline: "Room for everyone. Finally.",
    paragraph:
      "Bunk beds for the kids. A cinema with a popcorn machine for movie nights. A fenced backyard where the little ones can actually run. A kitchen big enough to cook Thanksgiving in. Three bathrooms so nobody fights. Quiet streets, loud weekends, and a hot tub after bedtime.",
    highlights: [
      "Five bedrooms, three bathrooms, sleeps 14",
      "Bunk beds the kids genuinely get excited about",
      "Fenced yard, fire pit, movie room with popcorn",
      "15 minutes to O\u2019Hare, 16 to downtown",
    ],
    cta: "Check your dates",
  },
  birthday: {
    emoji: "\uD83E\uDD42",
    label: "Birthday",
    sublabel: "milestone or just because",
    tagline: "Some years deserve a house, not a dinner.",
    paragraph:
      "Eight chairs around the supper club table. Low candles. Two hours in the hot tub before midnight. The parlor open \u2014 poker, ping pong, the record player doing its job. The kind of birthday where nobody wants to go home, so nobody does.",
    highlights: [
      "Supper club for up to 10 with custom menus on request",
      "Hot tub, fire pit, fully stocked bar",
      "Private chef connections if you want to go all-in",
      "The house feels like a venue, not a rental",
    ],
    cta: "Plan the night",
  },
  getaway: {
    emoji: "\uD83C\uDF06",
    label: "Getaway",
    sublabel: "just a good weekend",
    tagline: "No occasion required.",
    paragraph:
      "Sometimes the weekend is the occasion. Three breweries within walking distance. The best Mexican and Filipino food in the city around the corner. A backyard that makes most groups cancel their dinner reservations. Stay two nights, go home Monday wondering why you ever leave.",
    highlights: [
      "North Park \u2014 quiet streets, 10 min from everything",
      "Half Acre, Old Irving, Gene\u2019s Rooftop \u2014 all walkable",
      "Blue Line a 9-minute walk away",
      "Courtyard that does most of the work for you",
    ],
    cta: "See the price guide",
  },
};

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 9h11M10 4.5L14.5 9 10 13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OccasionSelector() {
  const { occasion, setOccasion, venue, setVenue } = useOccasion();
  const data = OCCASIONS[occasion];

  return (
    <section
      className={styles.section}
      aria-labelledby="occasion-heading"
    >
      <div className={styles.inner}>
        {/* ============ HEADER ============ */}
        <p className={styles.eyebrow}>&mdash; before we go further</p>
        <h2 id="occasion-heading" className={styles.headline}>
          What are you <em>planning?</em>
        </h2>
        <p className={styles.lead}>
          The house is the same. The weekend isn&rsquo;t. Tell us what
          you&rsquo;re here for and we&rsquo;ll point you at what matters.
        </p>

        {/* ============ TABS ============ */}
        <div
          role="tablist"
          aria-label="Select your occasion"
          className={styles.tabs}
        >
          {OCCASION_IDS.map((id) => {
            const d = OCCASIONS[id];
            const active = id === occasion;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                onClick={() => setOccasion(id)}
              >
                <span
                  className={`${styles.tabEmoji} ${active ? styles.tabEmojiActive : ""}`}
                  aria-hidden="true"
                >
                  {d.emoji}
                </span>
                <span className={styles.tabLabel}>{d.label}</span>
                <span className={styles.tabSublabel}>{d.sublabel}</span>
              </button>
            );
          })}
        </div>

        {/* ============ CONTENT ============ */}
        <div className={styles.content} key={occasion}>
          {/* Left — tagline + copy */}
          <div className={styles.left}>
            <p className={styles.contentEyebrow}>
              {data.label.toLowerCase()}
            </p>
            <h3 className={styles.tagline}>{data.tagline}</h3>
            <p className={styles.paragraph}>{data.paragraph}</p>
          </div>

          <div className={styles.divider} aria-hidden="true" />

          {/* Right — highlights + CTA */}
          <div className={styles.right}>
            <p className={styles.rightEyebrow}>why this house</p>
            <ul className={styles.highlights}>
              {data.highlights.map((h, i) => (
                <li
                  key={h}
                  className={styles.highlight}
                  style={
                    { "--delay": `${i * 80}ms` } as React.CSSProperties
                  }
                >
                  <span className={styles.bullet} aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>

            {occasion === "wedding" ? (
              <div className={styles.venueGroup}>
                <label
                  htmlFor="venue-input"
                  className={styles.venueLabel}
                >
                  What&rsquo;s your venue?
                </label>
                <input
                  id="venue-input"
                  type="text"
                  className={styles.venueInput}
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g., Artifact Events, Morgan MFG, Bridgeport Art Center"
                />
                <p className={styles.venueHint}>
                  Helps us tailor the package &mdash; and nothing more.
                </p>
              </div>
            ) : null}

            <a href="#book" className={styles.cta}>
              {data.cta}
              <ArrowIcon className={styles.ctaArrow} />
            </a>

            {occasion === "wedding" ? (
              <a href="sms:+10000000000" className={styles.textAbe}>
                or text Abe directly &rarr;
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
