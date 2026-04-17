/**
 * HeroSection — the homepage hero (locked design: C4).
 *
 * 60/40 grid on desktop with the gradient + brand content on the left and the
 * patio photo column on the right. On mobile, the photo orders BELOW the brand
 * content (not above) so the wordmark is the first thing a visitor sees.
 *
 * Server component.
 *
 * MOTION NOTE — `animate` is intentionally off by default.
 *   The site ships static. We evaluated a 1deg/sec rotation on the corner
 *   starburst and decided to save the motion budget for the hero→reveal-photo
 *   sticky scroll transition (next round). The rotation infrastructure is
 *   left in place so we can A/B it again later: pass `animate={true}` (the
 *   /with-motion route does this), and the keyframe in HeroSection.module.css
 *   takes over. Pure CSS, zero JS, already gated by prefers-reduced-motion.
 */

import Image from "next/image";

import cinemaPhoto from "@brand/docs/photos/cinema.png";
import firePitPhoto from "@brand/docs/photos/fire-pit.png";
import gameRoomPhoto from "@brand/docs/photos/game-room.png";
import heroPhoto from "@brand/docs/photos/hero.png";
import hotTubPhoto from "@brand/docs/photos/hot-tub.png";
import supperClubPhoto from "@brand/docs/photos/supper-club.png";

import { Wordmark } from "@/components/brand/Wordmark";
import { StatStrip } from "@/components/brand/StatStrip";
import { HeroBookingBar } from "@/components/brand/HeroBookingBar";
import { GroundingLine } from "@/components/brand/GroundingLine";
import { Starburst } from "@/components/brand/Starburst";

import {
  HeroPhotoCarousel,
  type HeroCarouselPhoto,
} from "./HeroPhotoCarousel";
import styles from "./HeroSection.module.css";

interface HeroSectionProps {
  animate?: boolean;
}

const HERO_STATS = [
  { value: "14", label: "sleeps" },
  { value: "5", label: "BR" },
  { value: "3", label: "BA" },
  { value: "5.0 ★ 47", label: "" },
];

const HERO_PHOTOS: ReadonlyArray<HeroCarouselPhoto> = [
  {
    src: heroPhoto,
    alt: "The Jackpot — courtyard at dusk",
    label: "THE COURTYARD",
    place: "at dusk",
  },
  {
    src: hotTubPhoto,
    alt: "The Jackpot — spa after dark",
    label: "THE SPA",
    place: "after dark",
  },
  {
    src: firePitPhoto,
    alt: "The Jackpot — fireside with embers up",
    label: "THE FIRESIDE",
    place: "embers up",
  },
  {
    src: gameRoomPhoto,
    alt: "The Jackpot — parlor with the bar open",
    label: "THE PARLOR",
    place: "bar open",
  },
  {
    src: cinemaPhoto,
    alt: "The Jackpot — cinema with the lights down",
    label: "THE CINEMA",
    place: "lights down",
  },
  {
    src: supperClubPhoto,
    alt: "The Jackpot — supper club at seven o'clock",
    label: "THE SUPPER CLUB",
    place: "seven o'clock",
  },
];

export function HeroSection({ animate = false }: HeroSectionProps) {
  const bgStarburstClass = animate
    ? `${styles.bgStarburst} ${styles.bgStarburstRotate}`
    : styles.bgStarburst;

  return (
    <header id="hero" className={styles.hero}>
      <div className={styles.left}>
        <Starburst
          size={360}
          tier={8}
          color="#ffffff"
          secondary="#ffffff"
          center="#ffffff"
          axisOpacity={1}
          diagOpacity={0.7}
          terOpacity={0.45}
          className={bgStarburstClass}
        />

        <div className={styles.content}>
          <Wordmark size="xl" color="white" align="left" as="h1" />

          <p className={styles.tagline}>you found something special</p>

          <div className={styles.statStrip}>
            <StatStrip stats={HERO_STATS} tone="light" />
          </div>

          <div id="book" className={styles.bookingBar}>
            <HeroBookingBar
              trailing={<GroundingLine>A luxury group home in Chicago</GroundingLine>}
            />
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <HeroPhotoCarousel photos={HERO_PHOTOS} />
      </div>

      {/* Mobile-only editorial photo — the desktop carousel stays hidden
          on mobile; one strong static shot (courtyard at dusk) with an
          uppercase-label + italic-place caption stands in for it. */}
      <div className={styles.mobilePhoto}>
        <div className={styles.mobilePhotoCard}>
          <Image
            src={heroPhoto}
            alt="The Jackpot — courtyard at dusk"
            className={styles.mobilePhotoImg}
            sizes="(max-width: 600px) 100vw, 560px"
            placeholder="blur"
          />
        </div>
        <p className={styles.mobilePhotoCaption}>
          <span className={styles.mobilePhotoLabel}>THE COURTYARD</span>
          <span className={styles.mobilePhotoPlace}>at dusk</span>
        </p>
      </div>
    </header>
  );
}
