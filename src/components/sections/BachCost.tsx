/**
 * BachCost — Scene 6: what it costs, anchor flipped. Lead with the
 * done-for-you ceiling ($15k, itemized, struck through ~$18k piece by
 * piece), THEN step down to the per-person floor as relief (never the
 * headline, never "cheaper than a hotel"), then the middle named. Single
 * CTA into the bachelorette chat. Figures are provisional (packages.ts).
 */

"use client";

import { useState } from "react";
import Link from "next/link";

import { BachIcon } from "@/components/brand/BachIcon";
import {
  ANCHOR_DONE_FROM_USD,
  ANCHOR_ITEMS,
  ANCHOR_PIECEMEAL_USD,
  BACH_SCARCITY,
  MIDDLE_BUNDLE,
  PER_PERSON,
  perPersonWeekend,
} from "@/lib/bachelorette/packages";
import styles from "./bachelorette.module.css";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const CHAT_HREF = "/chat/session?occasion=bachelorette";

export function BachCost() {
  const [group, setGroup] = useState(PER_PERSON.maxGroup);

  return (
    <section className={`${styles.section} ${styles.linen} ${styles.cost}`}>
      <div className={styles.inner}>
        <p className={styles.kicker}>What it costs</p>
        <h2 className={styles.display}>The whole weekend, done for you.</h2>

        {/* The ceiling, first */}
        <div className={styles.ceiling}>
          <div className={styles.ceilingLabel}>From</div>
          <div className={styles.ceilingPrice}>{usd(ANCHOR_DONE_FROM_USD)}</div>
          <div className={styles.anchorList}>
            {ANCHOR_ITEMS.map((it) => (
              <div key={it.label} className={styles.anchorRow}>
                <span className={styles.anchorIcon}>
                  <BachIcon k={it.icon} size={20} />
                </span>
                <span>{it.label}</span>
                <span className={styles.anchorVal}>{usd(it.valueUsd)}</span>
              </div>
            ))}
          </div>
          <p className={styles.compareLine}>
            Booked piece by piece, about{" "}
            <span className={styles.strike}>{usd(ANCHOR_PIECEMEAL_USD)}</span>.
            Done by us, from {usd(ANCHOR_DONE_FROM_USD)}.
          </p>
        </div>

        {/* The step down, as relief */}
        <div className={styles.stepDown}>
          <p className={styles.stepDownLine}>
            Just want the house and everything included? That splits to about
            ${perPersonWeekend(group)} each for the weekend.
          </p>
          <div className={styles.ppSliderWrap}>
            <label className={styles.ppControlLabel} htmlFor="bach-cost-group">
              <span>How many of you?</span>
              <span className={styles.ppCount}>{group}</span>
            </label>
            <input
              id="bach-cost-group"
              type="range"
              className={styles.slider}
              min={PER_PERSON.minGroup}
              max={PER_PERSON.maxGroup}
              value={group}
              onChange={(e) => setGroup(Number(e.target.value))}
            />
          </div>
        </div>

        {/* The middle, named */}
        <p className={styles.middleLine}>{MIDDLE_BUNDLE.line}</p>

        <p className={styles.scarcity}>{BACH_SCARCITY}</p>
        <div className={styles.ctaRow}>
          <Link href={CHAT_HREF} className={styles.ctaSolid}>
            Get your group&rsquo;s number
          </Link>
        </div>
      </div>
    </section>
  );
}
