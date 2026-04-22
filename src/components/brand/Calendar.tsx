/**
 * Calendar — brand-styled month-grid picker for the hero booking bar.
 *
 * Rendered via React Portal into `portalTarget` (or `document.body` by
 * default) so it can escape the hero's `overflow: hidden`. When the trigger
 * lives inside a native `<dialog>` (modal booking funnel), the caller passes
 * the dialog element as `portalTarget` so the calendar joins the browser's
 * top layer — otherwise it'd render under the modal backdrop.
 *
 * Position is fixed relative to the viewport, anchored to the trigger via
 * CSS variables set from `triggerRect`. On mobile (≤900px) a media-query
 * override pins the calendar as a fixed bottom-sheet regardless of trigger
 * coordinates.
 */

"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";

import styles from "./Calendar.module.css";

interface CalendarProps {
  value: string;
  onSelect: (iso: string) => void;
  min?: string;
  /** Trigger button's getBoundingClientRect at the moment the calendar opened. */
  triggerRect: DOMRect;
  placement: "top" | "bottom";
  /** Optional portal target. Default: document.body. Pass an open <dialog>
   *  element when the trigger is inside one so the calendar joins the
   *  browser's top layer instead of rendering beneath the backdrop. */
  portalTarget?: HTMLElement | null;
  /** When picking the departure date, pass the arrival here so the cell
   *  is visibly highlighted (outlined gold) — gives the user a visual
   *  anchor for the stay range without forcing a full range-picker UX. */
  rangeStart?: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayIso(): string {
  const now = new Date();
  return isoFromParts(now.getFullYear(), now.getMonth(), now.getDate());
}

export function Calendar({
  value,
  onSelect,
  min,
  triggerRect,
  placement,
  portalTarget,
  rangeStart,
}: CalendarProps) {
  // Initial month: prefer the current selection, then the floor (`min`)
  // — typically arrival+2 nights when this is the departure picker —
  // falling back to today only when neither is set. Without the `min`
  // fallback, picking an arrival 6 months out and auto-opening the
  // departure picker showed today's month with everything disabled,
  // forcing the user to chevron forward N times to reach a valid day.
  const initial = (() => {
    const seedIso = value || min || todayIso();
    const [y, m] = seedIso.split("-").map(Number);
    return { year: y, month: m - 1 };
  })();

  const [view, setView] = useState(initial);

  // SSR guard — Calendar only ever mounts from a user click in a "use client"
  // tree, so document.body is always defined in practice. This keeps the
  // static shell safe during prerender.
  if (typeof document === "undefined") return null;

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstDayIndex = new Date(view.year, view.month, 1).getDay();

  const goPrev = () =>
    setView((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: v.month - 1 },
    );

  const goNext = () =>
    setView((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: v.month + 1 },
    );

  const today = todayIso();

  const cells: Array<{ kind: "empty" } | { kind: "day"; day: number; iso: string }> = [
    ...Array.from({ length: firstDayIndex }, () => ({ kind: "empty" as const })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        kind: "day" as const,
        day,
        iso: isoFromParts(view.year, view.month, day),
      };
    }),
  ];

  const positionStyle: CSSProperties =
    placement === "bottom"
      ? ({
          "--jp-cal-top": `${triggerRect.bottom + 10}px`,
          "--jp-cal-left": `${triggerRect.left}px`,
        } as CSSProperties)
      : ({
          "--jp-cal-bottom": `${window.innerHeight - triggerRect.top + 10}px`,
          "--jp-cal-left": `${triggerRect.left}px`,
        } as CSSProperties);

  return createPortal(
    <div
      className={`${styles.calendar} ${placement === "top" ? styles.calendarAbove : ""}`}
      style={positionStyle}
      role="dialog"
      aria-label="Select a date"
    >
      <div className={styles.header}>
        <button
          type="button"
          onClick={goPrev}
          className={styles.nav}
          aria-label="Previous month"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className={styles.title}>
          {MONTHS[view.month]} {view.year}
        </span>
        <button
          type="button"
          onClick={goNext}
          className={styles.nav}
          aria-label="Next month"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <span key={`wd-${i}`} className={styles.weekday}>
            {w}
          </span>
        ))}
        {cells.map((cell, i) =>
          cell.kind === "empty" ? (
            <span key={`e-${i}`} className={styles.empty} />
          ) : (
            (() => {
              const disabled = !!min && cell.iso < min;
              const selected = value === cell.iso;
              const isRangeStart =
                !!rangeStart && cell.iso === rangeStart && !selected;
              const isToday = cell.iso === today;
              const classes = [
                styles.day,
                selected ? styles.daySelected : "",
                disabled ? styles.dayDisabled : "",
                isRangeStart ? styles.dayRangeStart : "",
                isToday && !selected && !isRangeStart ? styles.dayToday : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={classes}
                  disabled={disabled}
                  onClick={() => onSelect(cell.iso)}
                  aria-label={cell.iso}
                  aria-pressed={selected}
                >
                  {cell.day}
                </button>
              );
            })()
          ),
        )}
      </div>
    </div>,
    portalTarget ?? document.body,
  );
}
