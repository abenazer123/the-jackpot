/**
 * BacheloretteHero — Scene 1: the arrival / the dream. Two-column split on
 * desktop: rose-gold gradient + a PORTRAIT (9:16) video loop on the left
 * (full-bleed background behind the text on mobile), the content (headline,
 * one line, the Olivia chat card) on the right. No price/specs/hotel; the
 * chat card is the entry.
 */

import { bachThemeVars } from "@/components/brand/bachTheme";
import { InquiryChat } from "@/components/brand/InquiryChat";
import { Wordmark } from "@/components/brand/Wordmark";
import { BACH_SCARCITY } from "@/lib/bachelorette/packages";
import styles from "./bachelorette.module.css";

/** Portrait (9:16) hero loop, web-encoded (audio stripped, fast-start).
 *  WebM for browsers that support it, MP4 fallback, poster for first paint. */
const HERO_VIDEO = {
  webm: "/video/bach-hero.webm",
  mp4: "/video/bach-hero.mp4",
  poster: "/video/bach-hero-poster.jpg",
};

export function BacheloretteHero() {
  return (
    <header className={styles.heroSplit} style={bachThemeVars}>
      {/* Left: rose-gold gradient + content (mirrors the root hero). */}
      <div className={styles.heroContentSide}>
        <div className={styles.heroContentInner}>
          <div className={styles.heroGroup}>
            <Wordmark size="sm" color="white" align="left" as="div" />
            <p className={styles.splitEyebrow}>The Chicago bachelorette</p>
          </div>
          <div className={styles.heroGroup}>
            <h1 className={styles.splitHeadline}>
              The weekend{" "}
              <span className={styles.splitAccent}>
                she&rsquo;ll never stop talking about.
              </span>
            </h1>
            <p className={styles.splitLine}>
              All the gals. One house. Everything handled.
            </p>
          </div>
          <div className={styles.heroGroup}>
            <div className={styles.heroChat}>
              <InquiryChat
                occasion="bachelorette"
                chips={["check_dates"]}
                showFallback={false}
              />
            </div>
            <p className={styles.heroScarcity}>{BACH_SCARCITY}</p>
          </div>
        </div>
      </div>

      {/* Right: the portrait (9:16) video column. Poster still until the
          loop is supplied. */}
      <div className={styles.heroMediaSide}>
        <video
          className={styles.heroMediaEl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={HERO_VIDEO.poster}
        >
          <source src={HERO_VIDEO.webm} type="video/webm" />
          <source src={HERO_VIDEO.mp4} type="video/mp4" />
        </video>
        {/* Scrim: invisible on desktop, dark on mobile where the video
            becomes the full-bleed background behind the text. */}
        <div className={styles.heroMediaScrim} aria-hidden="true" />
      </div>
    </header>
  );
}
