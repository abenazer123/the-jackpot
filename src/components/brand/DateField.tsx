/**
 * DateField — pill trigger + popover Calendar. Replaces native <input type="date">
 * in the hero booking bar so the date picker matches the brand.
 *
 * Controlled via an ISO "YYYY-MM-DD" value string. Closes on outside click,
 * ESC, or calendar selection. The trigger pill uses the same field styling
 * as the email input so all three form controls read as one family.
 *
 * Forwards a ref exposing { open() } so a parent can imperatively pop the
 * calendar — used to auto-open Departure right after Arrival is picked.
 */

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Calendar } from "./Calendar";
import styles from "./HeroBookingBar.module.css";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  placeholder?: string;
  /** Forwarded to Calendar — highlights the arrival cell when this is
   *  the departure picker, giving the user a visual anchor for their
   *  stay range. */
  rangeStart?: string;
}

export interface DateFieldHandle {
  /** Programmatically open the calendar popover. */
  open: () => void;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const DateField = forwardRef<DateFieldHandle, DateFieldProps>(
  function DateField(
    {
      label,
      value,
      onChange,
      min,
      placeholder = "Select a date",
      rangeStart,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // Timestamp through which scroll-dismiss should be ignored. Set in
    // openCalendar() right before our own programmatic scrollBy fires —
    // otherwise the scroll event from that call wakes the dismiss
    // listener and closes the calendar a frame after we open it.
    const ignoreScrollUntil = useRef(0);

    useEffect(() => {
      if (!open) return;
      const handleMouseDown = (e: MouseEvent) => {
        const portaled = (e.target as HTMLElement)?.closest?.('[aria-label="Select a date"]');
        if (portaled) return;
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      const handleScrollDismiss = () => {
        if (Date.now() < ignoreScrollUntil.current) return;
        setOpen(false);
      };
      const handleResize = () => setOpen(false);
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("keydown", handleKey);
      window.addEventListener("scroll", handleScrollDismiss, true);
      window.addEventListener("resize", handleResize);
      return () => {
        document.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("keydown", handleKey);
        window.removeEventListener("scroll", handleScrollDismiss, true);
        window.removeEventListener("resize", handleResize);
      };
    }, [open]);

    // Measure trigger + available space and open. Used by both the click
    // handler and the imperative open() exposed via ref.
    const openCalendar = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        setOpen(true);
        return;
      }

      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 900px)").matches;

      // On mobile, center the trigger in the viewport BEFORE measuring,
      // so the calendar's anchored position reflects the post-scroll
      // trigger location. We use direct scrollBy math instead of
      // scrollIntoView because `scrollIntoView({ behavior: "instant" })`
      // has cross-browser quirks (Chrome bug 1257212, iOS Safari
      // smooth-scroll fallback) where the page sometimes animates and
      // getBoundingClientRect returns the pre-scroll position. The
      // legacy 2-arg `window.scrollBy(x, y)` form is always synchronous
      // and instant, so the next `getBoundingClientRect()` call sees
      // the new scroll position.
      if (isMobile) {
        const dialogAncestor = trigger.closest("dialog");
        const r0 = trigger.getBoundingClientRect();
        const triggerCenter = r0.top + r0.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const delta = triggerCenter - viewportCenter;
        if (Math.abs(delta) > 1) {
          // Suppress scroll-dismiss for the next ~400ms so the scroll
          // event from our own programmatic scroll doesn't immediately
          // close the calendar we're about to open. Lingers slightly
          // beyond the synchronous scroll to cover composited /
          // overscroll-bounce events that fire on the next few frames.
          ignoreScrollUntil.current = Date.now() + 400;
          if (dialogAncestor) {
            // Dialog is its own scroll context — scroll the dialog's
            // open <dialog> element instead of window.
            dialogAncestor.scrollTop += delta;
          } else {
            window.scrollBy(0, delta);
          }
        }
      }

      const rect = trigger.getBoundingClientRect();
      const CAL_HEIGHT = 340;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setTriggerRect(rect);
      setPlacement(
        spaceBelow < CAL_HEIGHT && spaceAbove > spaceBelow ? "top" : "bottom",
      );
      // If the trigger is inside a <dialog> (booking modal), portal the
      // calendar into the dialog so it joins the browser's top layer —
      // otherwise it renders under the modal backdrop.
      setPortalTarget(trigger.closest("dialog"));
      setOpen(true);
    };

    const handleToggle = () => {
      if (open) {
        setOpen(false);
        return;
      }
      openCalendar();
    };

    useImperativeHandle(ref, () => ({ open: openCalendar }), []);

    const display = formatDisplay(value);

    return (
      <div className={styles.fieldWrap} ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.field} ${styles.fieldButton}`}
          onClick={handleToggle}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className={styles.fieldLabel}>{label}</span>
          <span className={styles.fieldValue} data-empty={display ? "false" : "true"}>
            {display || placeholder}
          </span>
        </button>
        {open && triggerRect && (
          <Calendar
            value={value}
            min={min}
            placement={placement}
            triggerRect={triggerRect}
            portalTarget={portalTarget}
            rangeStart={rangeStart}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        )}
      </div>
    );
  },
);
