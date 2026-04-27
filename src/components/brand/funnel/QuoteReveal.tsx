/**
 * QuoteReveal — the success-screen quote card + 3 CTA paths +
 * The Details accordion. Self-contained client component used by:
 *   - /book/quote/[token] — interactive booker view
 *   - /trip/[token]       — read-only public share view (Phase 2)
 *
 * Owns all per-CTA state (interest/share/appeal). Makes flag_update
 * POSTs internally with the inquiry_id. The page that mounts it
 * server-fetches the row and passes inquiry data + quote as props.
 *
 * Read-only mode (for the trip portal) hides the CTA stack and
 * renders just the quote card + The Details accordion.
 */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { capture } from "@/components/brand/PostHogProvider";
import { eventForDates } from "@/lib/chicagoEvents";
import type { Quote } from "@/lib/pricing/types";
import styles from "../BookingFunnelSteps.module.css";

/** Per-person-per-night threshold for the sticker-shock nudge. */
const ALT_DATES_THRESHOLD_CENTS = 30000;

export interface QuoteRevealInquiry {
  id: string;
  name: string;
  email: string;
  source?: string | null;
  attribution?: { utm_source?: string | null } | null;
}

interface QuoteRevealProps {
  inquiry: QuoteRevealInquiry;
  quote: Quote;
  /** Public token for `/trip/[shareToken]`. Required when `readOnly`
   *  is false — drives the share preview sheet's URL. */
  shareToken?: string;
  /** Read-only — render quote card + details accordion only. No CTAs.
   *  Used by the public trip portal. */
  readOnly?: boolean;
}

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** Renders a dollar amount with the `$` sign typographically demoted —
 *  smaller and top-aligned — so the digits dominate. */
function fmtMoney(cents: number): React.ReactElement {
  const digits = Math.round(cents / 100).toLocaleString("en-US");
  return (
    <>
      <span className={styles.quoteCurrency}>$</span>
      {digits}
    </>
  );
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Which row of the "The details" accordion is open. */
type DetailRow = "nightly" | "included" | "hotel";

async function flagInquiry(
  inquiryId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flag_update: true,
        inquiry_id: inquiryId,
        ...fields,
      }),
    });
  } catch (err) {
    console.warn("[quote-reveal] flag POST failed", err);
  }
}

export function QuoteReveal({
  inquiry,
  quote,
  shareToken,
  readOnly = false,
}: QuoteRevealProps) {
  const router = useRouter();
  const splitN = quote.guests;
  const totalCents = quote.totalCents;
  const perPersonTotal = Math.round(totalCents / splitN);
  const perPersonNight = Math.round(perPersonTotal / Math.max(1, quote.nights));

  const totalLeads = splitN <= 2 && perPersonNight >= 50000;
  const showAltNudge = perPersonNight >= ALT_DATES_THRESHOLD_CENTS;
  const utmSource = inquiry.attribution?.utm_source ?? undefined;
  const showAirbnbSavings =
    utmSource !== "airbnb" && quote.savedVsAirbnbCents > 0;

  const HOTEL_ROOM_NIGHTLY_CENTS = 25000;
  const hotelTotalCents =
    quote.guests * HOTEL_ROOM_NIGHTLY_CENTS * quote.nights;
  const HOTEL_ANCHOR_MIN_ADVANTAGE = 1.2;
  const showHotelAnchor =
    hotelTotalCents > totalCents * HOTEL_ANCHOR_MIN_ADVANTAGE;

  const stayEvent = eventForDates(quote.arrival, quote.departure);

  const [openDetail, setOpenDetail] = useState<DetailRow | null>(null);
  const toggleDetail = (key: DetailRow) =>
    setOpenDetail((prev) => (prev === key ? null : key));

  // CTA state (interactive mode only)
  const [altDatesSent, setAltDatesSent] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [shareRequested, setShareRequested] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealStretchLevel, setAppealStretchLevel] = useState<
    "close" | "far" | null
  >(null);
  const [appealSent, setAppealSent] = useState(false);

  const handleAltDates = () => {
    if (altDatesSent) return;
    setAltDatesSent(true);
    capture("alt_dates_nudge_clicked", { source: inquiry.source });
    void flagInquiry(inquiry.id, { alt_dates_requested: true });
  };

  const handleInterestClick = () => {
    if (interestSent) return;
    setInterestSent(true);
    capture("primary_cta_clicked", {
      path: "interested",
      surface: "quote_reveal",
      total_cents: totalCents,
      guests: quote.guests,
      nights: quote.nights,
    });
    void flagInquiry(inquiry.id, { primary_cta_path: "interested" });
  };

  const handleShareRequest = () => {
    if (!shareToken) return;
    if (!shareRequested) {
      setShareRequested(true);
      capture("share_cta_clicked", {
        path: "share",
        source: inquiry.source,
        total_cents: totalCents,
        guests: quote.guests,
        nights: quote.nights,
      });
      void flagInquiry(inquiry.id, {
        share_requested: true,
        primary_cta_path: "share",
      });
    }
    // Navigate to the public trip page so the booker sees exactly
    // what her group will see. The page renders a ShareDock
    // (Copy link / Share via…) for browsers carrying the owner
    // cookie, which is set on finalize.
    router.push(`/trip/${shareToken}`);
  };

  const handleAppealSubmit = async () => {
    const text = appealText.trim();
    if (!text || appealSent) return;
    setAppealSent(true);
    capture("appeal_submitted", {
      path: "appeal",
      stretch_level: appealStretchLevel,
      length: text.length,
      source: inquiry.source,
    });
    await flagInquiry(inquiry.id, {
      appeal_text: text,
      appeal_stretch_level: appealStretchLevel ?? undefined,
      primary_cta_path: "appeal",
    });
  };

  const heroNumber = totalLeads ? totalCents : perPersonNight;
  const heroLabel = totalLeads ? "total for your group" : "per person per night";
  const secondaryNumber = totalLeads ? perPersonNight : totalCents;
  const secondaryLabel = totalLeads
    ? `per person per night${splitN > 1 ? ` if you split across ${splitN}` : ""}`
    : "total for your group";

  return (
    <div className={styles.quoteWrap}>
      <div className={styles.quoteCard}>
        <div className={styles.quoteHero}>{fmtMoney(heroNumber)}</div>
        <div className={styles.quoteHeroSub}>{heroLabel}</div>
        <div className={styles.quoteHeroMeta}>
          {quote.guests} {quote.guests === 1 ? "guest" : "guests"} &middot;{" "}
          {quote.nights} {quote.nights === 1 ? "night" : "nights"}
        </div>

        <div className={styles.quoteSecondaryDivider} />

        <div className={styles.quoteSecondary}>{fmtMoney(secondaryNumber)}</div>
        <div className={styles.quoteSubMeta}>{secondaryLabel}</div>

        {showAirbnbSavings ? (
          <div className={styles.savingsLine}>
            You&rsquo;re saving {fmt(quote.savedVsAirbnbCents)} by booking direct
          </div>
        ) : null}
      </div>

      {!readOnly && showAltNudge && !altDatesSent ? (
        stayEvent ? (
          <p className={styles.altNudge}>
            <span className={styles.altNudgeText}>
              These are premium dates &mdash; {stayEvent.reason}.
            </span>
          </p>
        ) : (
          <p className={styles.altNudge}>
            <span className={styles.altNudgeText}>
              These are premium dates &mdash; weeknight stays and shoulder
              weekends often run 30&ndash;40% less. Want me to suggest
              alternatives?
            </span>
            <button
              type="button"
              className={styles.altNudgeButton}
              onClick={handleAltDates}
            >
              Yes, suggest dates
            </button>
          </p>
        )
      ) : null}
      {!readOnly && altDatesSent ? (
        <p className={styles.altNudgeConfirm}>
          Got it &mdash; I&rsquo;ll reach out with options that fit your group.
        </p>
      ) : null}

      {!readOnly ? (
        <div className={styles.ctaStack}>
          <button
            type="button"
            className={styles.submit}
            onClick={handleInterestClick}
            disabled={interestSent}
          >
            {interestSent
              ? "Got it \u2014 Abe will be in touch"
              : "Hold my dates"}
          </button>
          <p className={styles.ctaSubhead}>
            No commitment yet &mdash; just first dibs.
          </p>

          <button
            type="button"
            className={styles.shareButton}
            onClick={handleShareRequest}
          >
            Share with my group
          </button>
          {!shareRequested ? (
            <p className={styles.shareSubhead}>
              They&rsquo;ll see the price, the photos, and the accommodations.
            </p>
          ) : null}

          <div className={styles.appealSection}>
            <p className={styles.appealText}>
              If the numbers don&rsquo;t line up, I&rsquo;d rather hear from you
              than lose you. &mdash; Abe
            </p>

            <button
              type="button"
              className={styles.appealTrigger}
              aria-expanded={appealOpen}
              onClick={() => setAppealOpen((v) => !v)}
            >
              Tell Abe what works <span aria-hidden="true">{"\u2192"}</span>
            </button>

            {appealOpen ? (
              appealSent ? (
                <p className={styles.appealConfirm}>
                  Got it &mdash; I&rsquo;ll review and reach out personally.
                </p>
              ) : (
                <>
                  <span className={styles.appealEyebrow}>How far off are we?</span>
                  <div
                    className={styles.stretchOptions}
                    role="radiogroup"
                    aria-label="How far off are we?"
                  >
                    {(
                      [
                        ["close", "Close \u2014 just a little above what we planned"],
                        ["far", "Pretty far off from what we had in mind"],
                      ] as ReadonlyArray<["close" | "far", string]>
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={appealStretchLevel === id}
                        className={`${styles.stretchRow} ${appealStretchLevel === id ? styles.stretchRowActive : ""}`}
                        onClick={() => setAppealStretchLevel(id)}
                      >
                        <span className={styles.stretchRadio} aria-hidden="true" />
                        <span className={styles.stretchLabel}>{label}</span>
                      </button>
                    ))}
                  </div>

                  {appealStretchLevel ? (
                    <div className={styles.appealFollowUp}>
                      <textarea
                        className={styles.appealInput}
                        value={appealText}
                        onChange={(e) => setAppealText(e.target.value)}
                        placeholder="Anything else — flexible dates, shorter stay, smaller group?"
                        rows={2}
                      />
                      <button
                        type="button"
                        className={styles.appealSendLink}
                        onClick={() => void handleAppealSubmit()}
                        disabled={!appealText.trim()}
                      >
                        Send to Abe
                      </button>
                    </div>
                  ) : null}
                </>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.detailsSection}>
        <span className={styles.detailsEyebrow}>The details</span>

        <div
          className={`${styles.detailRow} ${openDetail === "nightly" ? styles.detailRowOpen : ""}`}
        >
          <button
            type="button"
            className={styles.detailRowHeader}
            aria-expanded={openDetail === "nightly"}
            onClick={() => toggleDetail("nightly")}
          >
            <span className={styles.detailRowLabel}>Nightly breakdown</span>
            <span className={styles.detailRowCaret} aria-hidden="true">
              {"\u25B8"}
            </span>
          </button>
          {openDetail === "nightly" ? (
            <ul className={styles.breakdownList}>
              {quote.nightly.map((n) => (
                <li key={n.date}>
                  <span>{isoToDisplay(n.date)}</span>
                  <span>{fmt(n.rateCents)}</span>
                </li>
              ))}
              <li className={styles.breakdownLine}>
                <span>Cleaning</span>
                <span>{fmt(quote.cleaningCents)}</span>
              </li>
              {quote.taxEnabled && quote.taxCents > 0 ? (
                <li className={styles.breakdownLine}>
                  <span>Taxes ({(quote.taxRateBps / 100).toFixed(2)}%)</span>
                  <span>{fmt(quote.taxCents)}</span>
                </li>
              ) : null}
              <li className={styles.breakdownTotal}>
                <span>Total</span>
                <span>{fmt(quote.totalCents)}</span>
              </li>
            </ul>
          ) : null}
        </div>

        <div
          className={`${styles.detailRow} ${openDetail === "included" ? styles.detailRowOpen : ""}`}
        >
          <button
            type="button"
            className={styles.detailRowHeader}
            aria-expanded={openDetail === "included"}
            onClick={() => toggleDetail("included")}
          >
            <span className={styles.detailRowLabel}>What&rsquo;s included</span>
            <span className={styles.detailRowCaret} aria-hidden="true">
              {"\u25B8"}
            </span>
          </button>
          {openDetail === "included" ? (
            <ul className={styles.valueStack}>
              <li>No platform fees &mdash; direct to Abe</li>
              <li>Split-pay across your group available</li>
              <li>Direct line to Abe for any questions</li>
              <li>Flexible check-in</li>
            </ul>
          ) : null}
        </div>

        {showHotelAnchor ? (
          <div
            className={`${styles.detailRow} ${openDetail === "hotel" ? styles.detailRowOpen : ""}`}
          >
            <button
              type="button"
              className={styles.detailRowHeader}
              aria-expanded={openDetail === "hotel"}
              onClick={() => toggleDetail("hotel")}
            >
              <span className={styles.detailRowLabel}>Hotel comparison</span>
              <span className={styles.detailRowCaret} aria-hidden="true">
                {"\u25B8"}
              </span>
            </button>
            {openDetail === "hotel" ? (
              <p className={styles.hotelAnchor}>
                vs. {quote.guests} hotel rooms at $250/night &times;{" "}
                {quote.nights} nights = {fmt(hotelTotalCents)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
