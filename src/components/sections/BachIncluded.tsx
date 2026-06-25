/**
 * BachIncluded — Scene 2: "It is already done." The value stack: the part
 * she dreads (planning) is handled and waiting, and the included extras get
 * dollar values so "free" reads as real money she keeps. Left: the
 * decorated-arrival image (slot until shot). Right: the icon value stack.
 */

import {
  VALUE_STACK,
  VALUE_STACK_TOTAL_LABEL,
} from "@/lib/bachelorette/packages";
import { BachIcon } from "@/components/brand/BachIcon";
import styles from "./bachelorette.module.css";

export function BachIncluded() {
  return (
    <section id="weekend" className={`${styles.section} ${styles.blush}`}>
      <div className={styles.inner}>
        <div className={styles.includedHead}>
          <p className={styles.kicker}>Before you even arrive</p>
          <h2 className={styles.display}>It is already done.</h2>
          <p className={styles.sub}>
            You book. We handle the rest. It is waiting when you walk in.
          </p>
        </div>

        <div className={styles.vsGrid}>
          <div
            className={styles.assetSlot}
            data-asset-slot="decorated-arrival"
            aria-hidden="true"
            style={{ minHeight: 320 }}
          >
            The decorated arrival: the welcome sign with their names, starter
            decor, something waiting on the counter (photo to add)
          </div>

          <div>
            <ul className={styles.vsList}>
              {VALUE_STACK.map((v) => (
                <li key={v.label} className={styles.vsRow}>
                  <span className={styles.vsIcon}>
                    <BachIcon k={v.icon} size={22} />
                  </span>
                  <span className={styles.vsLabel}>{v.label}</span>
                  <span className={styles.vsValue}>{v.valueLabel}</span>
                </li>
              ))}
            </ul>
            <p className={styles.vsTotal}>{VALUE_STACK_TOTAL_LABEL}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
