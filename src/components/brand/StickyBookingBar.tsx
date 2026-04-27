/**
 * StickyBookingBar — persistent conversion surface pinned to the TOP of the
 * viewport (desktop) or BOTTOM of the viewport (mobile peek card) after the
 * user scrolls past the hero. Desktop shows a warm cream-gold bar with two
 * date fields and a dark gradient-text CTA; mobile shows a slim peek card
 * with a handle bar, prompt, and gradient CTA.
 *
 * Visibility: driven by an IntersectionObserver on `#hero` with
 * `threshold: 0` — the bar shows only when the hero has ZERO pixels in the
 * viewport (i.e., fully scrolled past). A second observer on `#inquiry`
 * hides the bar when that section comes into view (no-ops until the section
 * exists).
 *
 * Clicking the CTA opens the booking funnel — BookingPricingModal on
 * desktop, BookingBottomSheet on mobile (viewport-driven via matchMedia).
 * Either container wraps the same BookingFunnelSteps content so the flow
 * feels identical; only the chrome (centered card vs bottom-pinned sheet)
 * differs. Email is always collected inside the funnel since neither the
 * bar nor the peek captures it.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Calendar, todayIso } from "./Calendar";
import { HostPresence } from "./HostPresence";
import { capture } from "./PostHogProvider";
import { readDraft, writeDraft } from "@/lib/funnel-draft";
import { Starburst } from "./Starburst";
import styles from "./StickyBookingBar.module.css";

const MIN_NIGHTS = 2;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
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

/**
 * Compact date-picker trigger — same Calendar popover as the hero's DateField
 * but a slimmer 40px pill trigger suited to the sticky bar. Duplicates the
 * open / outside-click / scroll-dismiss logic; if this pattern shows up in a
 * third place we should lift it to a `useDatePicker` hook.
 */
function CompactDatePicker({
  label,
  value,
  onChange,
  min,
  rangeStart,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  rangeStart?: string;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const portaled = (e.target as HTMLElement)?.closest?.(
        '[aria-label="Select a date"]',
      );
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

  // Sticky bar now sits at the viewport TOP — open the calendar downward
  // below the pill.
  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (trigger) {
      setTriggerRect(trigger.getBoundingClientRect());
      setPlacement("bottom");
    }
    setOpen(true);
  };

  const display = formatDisplay(value);

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.field}
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
      >
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldValue} data-empty={display ? "false" : "true"}>
          {display || "Add date"}
        </span>
      </button>
      {open && triggerRect && (
        <Calendar
          value={value}
          min={min}
          placement={placement}
          triggerRect={triggerRect}
          rangeStart={rangeStart}
          onSelect={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function StickyBookingBar() {
  const router = useRouter();
  const [pastHero, setPastHero] = useState(false);
  const [inquiryVisible, setInquiryVisible] = useState(false);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [draftEmail, setDraftEmail] = useState("");

  // Hydrate from the shared funnel-draft on mount so a guest who entered
  // dates + email in the hero earlier doesn't see an empty peek card.
  // Deferred via 0ms setTimeout to stay off the effect's synchronous
  // path (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const d = readDraft();
      if (d.arrival) setArrival(d.arrival);
      if (d.departure) setDeparture(d.departure);
      if (d.email) setDraftEmail(d.email);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);


  // Bar is visible when the user has scrolled past the hero AND the inquiry
  // section (if present) is NOT in view.
  const visible = pastHero && !inquiryVisible;

  // Observe #hero itself at threshold 0 — `isIntersecting` is true as long
  // as any pixel of the hero is in the viewport. Only when the hero is
  // completely off-screen does `pastHero` flip to true and the bar appear.
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const inquiry = document.getElementById("inquiry");
    if (!inquiry) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInquiryVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(inquiry);
    return () => observer.disconnect();
  }, []);

  // No past dates anywhere. Departure floors at arrival+MIN_NIGHTS when
  // arrival is set, otherwise at today.
  const today = todayIso();
  const minDeparture = useMemo(
    () => (arrival ? addDaysIso(arrival, MIN_NIGHTS) : today),
    [arrival, today],
  );

  const handleOpen = () => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    capture("booking_cta_clicked", {
      surface: isMobile ? "peek_mobile" : "sticky_desktop",
    });
    // Re-read the draft at click-time so if the user typed their email
    // into the hero AFTER the sticky bar mounted, the route lands with
    // the latest values.
    const d = readDraft();
    const a = d.arrival || arrival;
    const dep = d.departure || departure;
    const em = d.email || draftEmail;
    // Sync local state for any subsequent peek visibility decisions.
    if (d.arrival && !arrival) setArrival(d.arrival);
    if (d.departure && !departure) setDeparture(d.departure);
    if (d.email && d.email !== draftEmail) setDraftEmail(d.email);
    // If the entry didn't capture everything, route through Step 1
    // (collect) to gather the missing field; otherwise jump straight
    // to the checking animation.
    if (a && dep && em) router.push("/book/checking");
    else router.push("/book/availability");
  };

  // Let other sections (e.g. OccasionSelector CTA) open the booking
  // funnel by dispatching a "open-booking" custom event on window.
  useEffect(() => {
    const handler = () => {
      const d = readDraft();
      if (d.arrival && d.departure && d.email)
        router.push("/book/checking");
      else router.push("/book/availability");
    };
    window.addEventListener("open-booking", handler);
    return () => window.removeEventListener("open-booking", handler);
  }, [router]);

  // Peek swipe-up: track pointer, fire the sheet when the user drags the
  // peek card up by SWIPE_THRESHOLD px. The ref guards the follow-up click
  // from re-firing handleOpen on release.
  const peekGestureRef = useRef<{ startY: number; handled: boolean } | null>(
    null,
  );
  const SWIPE_THRESHOLD = 40;

  const handlePeekPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    peekGestureRef.current = { startY: e.clientY, handled: false };
  };

  const handlePeekPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = peekGestureRef.current;
    if (!g || g.handled) return;
    const dy = g.startY - e.clientY; // positive = upward swipe
    if (dy > SWIPE_THRESHOLD) {
      g.handled = true;
      handleOpen();
    }
  };

  const handlePeekPointerEnd = () => {
    // Leave `handled` flag until click processes, then clear after a tick.
    const g = peekGestureRef.current;
    if (!g) return;
    window.setTimeout(() => {
      peekGestureRef.current = null;
    }, 0);
  };

  const handlePeekClick = () => {
    if (peekGestureRef.current?.handled) return; // swipe already opened it
    handleOpen();
  };

  return (
    <>
      <div className={styles.root} data-visible={visible} aria-hidden={!visible}>
        {/* Desktop — top-pinned bar:
            LEFT  : starburst + wordmark
            RIGHT : dates + CTA grouped together */}
        <div className={styles.bar}>
          <div className={styles.left}>
            <a
              href="#hero"
              className={styles.wordmark}
              aria-label="Jackpot — back to top"
            >
              <Starburst
                size={9}
                tier={6}
                color="#ffffff"
                secondary="#ffffff"
                center="#ffffff"
                axisOpacity={0.85}
                diagOpacity={0.6}
                terOpacity={0.4}
              />
              <span className={styles.wordmarkText}>Jackpot</span>
            </a>
            <HostPresence variant="compact" tone="light" />
          </div>

          <div className={styles.right}>
            <CompactDatePicker
              label="Arrival"
              value={arrival}
              onChange={(iso) => {
                setArrival(iso);
                writeDraft({ arrival: iso });
              }}
              min={today}
            />
            <CompactDatePicker
              label="Departure"
              value={departure}
              onChange={(iso) => {
                setDeparture(iso);
                writeDraft({ departure: iso });
              }}
              min={minDeparture}
              rangeStart={arrival}
            />
            <button
              type="button"
              className={styles.cta}
              onClick={handleOpen}
              disabled={!arrival || !departure}
              aria-label="See the price guide — opens booking form"
            >
              <span className={styles.ctaText}>See the price guide</span>
            </button>
          </div>
        </div>

      </div>

      {/* Mobile — bottom-pinned peek card. The whole card is one
          semantic <button>: tap anywhere to open, or swipe up from the
          card to open. The visible CTA pill inside is just a styled span
          (a nested <button> would be invalid HTML).

          Rendered OUTSIDE .root so its position:fixed is relative to the
          viewport (a transformed ancestor would otherwise become the
          containing block for fixed children and pin the peek to the top). */}
      <button
        type="button"
        className={styles.peek}
        data-visible={visible}
        aria-hidden={!visible}
        aria-label="See the price guide — opens booking form"
        onClick={handlePeekClick}
        onPointerDown={handlePeekPointerDown}
        onPointerMove={handlePeekPointerMove}
        onPointerUp={handlePeekPointerEnd}
        onPointerCancel={handlePeekPointerEnd}
      >
        <span className={styles.peekHandle} aria-hidden="true" />
        <HostPresence variant="compact" className={styles.peekPresence} />
        <span className={styles.peekRow}>
          <span className={styles.peekPrompt}>Check dates for pricing</span>
          <span className={styles.peekCta} aria-hidden="true">
            See the price guide
          </span>
        </span>
      </button>
    </>
  );
}
