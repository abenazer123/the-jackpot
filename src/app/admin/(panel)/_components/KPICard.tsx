"use client";

/**
 * Click-to-explain KPI card. Each card is a button that opens
 * a modal with the four-section explanation pulled from
 * `KPI_META`: what it is, why it matters, what it tells us,
 * how it's computed.
 *
 * Optional `drillHref` adds a "View detail" link inside the
 * modal — keeps drill-down navigation accessible without
 * making the card itself a link.
 *
 * Built on the native HTML5 <dialog> element so escape and
 * backdrop-click closing work without hand-rolled modal
 * plumbing.
 */

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { KpiMeta } from "@/lib/admin/kpis";

import styles from "./KPICard.module.css";

interface KPICardProps {
  meta: KpiMeta;
  value: ReactNode;
  sub?: ReactNode;
  drillHref?: string;
}

export function KPICard({ meta, value, sub, drillHref }: KPICardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function open() {
    dialogRef.current?.showModal();
    setIsOpen(true);
  }

  function close() {
    dialogRef.current?.close();
    setIsOpen(false);
  }

  // Close on backdrop click. <dialog> by default closes on
  // ESC; we attach this for the click-outside behavior.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onClick(e: MouseEvent) {
      if (e.target === dialog) close();
    }
    function onCancel() {
      setIsOpen(false);
    }

    dialog.addEventListener("click", onClick);
    dialog.addEventListener("close", onCancel);
    return () => {
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("close", onCancel);
    };
  }, []);

  return (
    <>
      <button type="button" onClick={open} className={styles.card}>
        <p className={styles.label}>{meta.label}</p>
        <p className={styles.value}>{value}</p>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        <span className={styles.hint} aria-hidden="true">
          tap for detail
        </span>
      </button>

      <dialog ref={dialogRef} className={styles.modal}>
        <div className={styles.modalInner}>
          <div className={styles.modalHeader}>
            <p className={styles.modalCategory}>
              {meta.category === "cost"
                ? "Cost"
                : meta.category === "drift"
                  ? "Drift signal"
                  : "Pricing"}
            </p>
            <h2 className={styles.modalTitle}>{meta.label}</h2>
            <button
              type="button"
              onClick={close}
              className={styles.modalClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <p className={styles.modalCurrentLabel}>Current value</p>
          <p className={styles.modalCurrent}>{value}</p>
          {sub ? <p className={styles.modalSub}>{sub}</p> : null}

          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>What it is</h3>
            <p className={styles.modalSectionBody}>{meta.whatIs}</p>
          </div>

          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Why it matters</h3>
            <p className={styles.modalSectionBody}>{meta.relevance}</p>
          </div>

          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>What it tells us</h3>
            <p className={styles.modalSectionBody}>{meta.business}</p>
          </div>

          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>How it&rsquo;s computed</h3>
            <p className={styles.modalSectionBody}>{meta.formula}</p>
          </div>

          {drillHref ? (
            <div className={styles.modalActions}>
              <Link
                href={drillHref}
                className={styles.modalDrill}
                onClick={close}
              >
                View detail →
              </Link>
            </div>
          ) : null}
        </div>
      </dialog>

      {isOpen ? null : null}
    </>
  );
}
