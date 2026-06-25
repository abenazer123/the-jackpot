/**
 * BachHold — section 9 of /bachelorette. Risk reversal: kill the "blamed
 * for cost / on the hook" fear right before the final ask. Reserve now,
 * nothing due; flexible cancellation; send the link so the crew looks
 * first. Copy only.
 */

import Link from "next/link";

import { BACH_SCARCITY } from "@/lib/bachelorette/packages";
import styles from "./bachelorette.module.css";

const RESERVE_HREF = "/chat/session?occasion=bachelorette&intent=reserve";

export function BachHold() {
  return (
    <section className={`${styles.section} ${styles.blush} ${styles.hold}`}>
      <div className={styles.innerNarrow}>
        <p className={styles.kicker}>No money stress</p>
        <h2 className={styles.display}>Hold your dates. Decide the rest later.</h2>
        <p className={styles.lede}>
          Reserve today and nothing is due now. Cancellation stays flexible,
          because group plans move. Want the crew to see it before anyone
          pays? Send them the link and let them look first. No one chases
          anyone for money.
        </p>
        <p className={styles.scarcity}>{BACH_SCARCITY}</p>
        <div className={styles.ctaRow}>
          <Link href={RESERVE_HREF} className={styles.ctaSolid}>
            Hold your dates
          </Link>
        </div>
      </div>
    </section>
  );
}
