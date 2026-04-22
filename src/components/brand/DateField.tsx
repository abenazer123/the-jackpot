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
      const handleDismiss = () => setOpen(false);
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("keydown", handleKey);
      window.addEventListener("scroll", handleDismiss, true);
      window.addEventListener("resize", handleDismiss);
      return () => {
        document.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("keydown", handleKey);
        window.removeEventListener("scroll", handleDismiss, true);
        window.removeEventListener("resize", handleDismiss);
      };
    }, [open]);

    // Measure trigger + available space and open. Used by both the click
    // handler and the imperative open() exposed via ref.
    const openCalendar = () => {
      const trigger = triggerRef.current;
      if (trigger) {
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
      }
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
