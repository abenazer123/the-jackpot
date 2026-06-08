/**
 * HeroChatSection — alternative hero used on /chat. Mirrors HeroSection
 * exactly (wordmark, tagline, trust stats, gradient + pattern, photo
 * column, mobile editorial photo) but replaces the date+email booking
 * bar with the conversational InquiryChat card. The pricing note moves
 * out of the form and lives directly on the gradient as a small caption
 * above the chat.
 *
 * Server-rendered shell. InquiryChat is the only client island inside.
 */

import Image from "next/image";

import cinemaPhoto from "@brand/docs/photos/cinema.jpg";
import firePitPhoto from "@brand/docs/photos/fire-pit.jpg";
import gameRoomPhoto from "@brand/docs/photos/game-room.jpg";
import heroPhoto from "@brand/docs/photos/hero.jpg";
import hotTubPhoto from "@brand/docs/photos/hot-tub.jpg";
import supperClubPhoto from "@brand/docs/photos/supper-club.jpg";

import { InquiryChat } from "@/components/brand/InquiryChat";
import { Starburst } from "@/components/brand/Starburst";
import { StatStrip } from "@/components/brand/StatStrip";
import { Wordmark } from "@/components/brand/Wordmark";

import {
  HeroPhotoCarousel,
  type HeroCarouselPhoto,
} from "./HeroPhotoCarousel";
import styles from "./HeroChatSection.module.css";

const HERO_STATS = [
  { value: "14", label: "sleeps" },
  { value: "5", label: "BR" },
  { value: "3", label: "BA" },
  { value: "5.0 ★ 47", label: "" },
];

const NIGHTLY_MIN = 620;
const MIN_NIGHTS = 2;

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

export function HeroChatSection() {
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
          className={styles.bgStarburst}
        />

        <div className={styles.content}>
          <Wordmark size="xl" color="white" align="left" as="h1" />

          <p className={styles.tagline}>you found something special</p>

          <div className={styles.statStrip}>
            <StatStrip stats={HERO_STATS} tone="light" />
          </div>

          <p className={styles.priceLine}>
            From ${NIGHTLY_MIN}/night &middot; {MIN_NIGHTS}-night minimum
          </p>

          <div className={styles.chatHolder}>
            <InquiryChat />
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <HeroPhotoCarousel photos={HERO_PHOTOS} />
      </div>

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
