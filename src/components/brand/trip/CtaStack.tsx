/**
 * CtaStack — the three friend-facing actions on the trip portal:
 *
 *   1. Cast your vote (YES / MAYBE / NO) — group-chat-speed
 *      signal, no name required. The coordinator sees the live
 *      tally on her quote screen.
 *   2. Reserve my stay — name + email form. Registers the friend
 *      against the inquiry; fires Abe a host email.
 *   3. Talk to Abe — mailto with prefilled subject.
 *
 * Owns its own per-CTA state. Doesn't render for the booker
 * herself (the trip page hides this whole block when the owner
 * cookie is present — see /trip/[token]/page.tsx).
 */

"use client";

import { useCallback, useState } from "react";

import styles from "./CtaStack.module.css";

interface CtaStackProps {
  /** Public share token — used in the API route paths. */
  token: string;
  /** Booker's first name — used in the "Reserve" success copy
   *  and the "Talk to Abe" mailto subject. */
  bookerFirstName: string;
  /** Date range like "Sep 26 – Sep 28" for the talk-to-Abe subject. */
  dateRange: string;
}

type Vote = "yes" | "maybe" | "no";

export function CtaStack({ token, bookerFirstName, dateRange }: CtaStackProps) {
  const [vote, setVote] = useState<Vote | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState<Vote | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveName, setReserveName] = useState("");
  const [reserveEmail, setReserveEmail] = useState("");
  const [reserveSubmitting, setReserveSubmitting] = useState(false);
  const [reserveDone, setReserveDone] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const handleVote = useCallback(
    async (next: Vote) => {
      if (voteSubmitting) return;
      setVoteSubmitting(next);
      const previous = vote;
      setVote(next); // optimistic
      try {
        const res = await fetch(`/api/trip-vote/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ vote: next }),
        });
        if (!res.ok) throw new Error("vote failed");
      } catch {
        setVote(previous);
      } finally {
        setVoteSubmitting(null);
      }
    },
    [token, vote, voteSubmitting],
  );

  const handleReserveSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const name = reserveName.trim();
      const email = reserveEmail.trim();
      if (!name || !email) return;
      if (reserveSubmitting) return;
      setReserveSubmitting(true);
      setReserveError(null);
      try {
        const res = await fetch(`/api/trip-reserve/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, email }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({ error: "save failed" }));
          throw new Error(detail.error ?? "save failed");
        }
        setReserveDone(true);
      } catch (err) {
        setReserveError(
          (err as Error).message === "invalid email"
            ? "Double-check your email?"
            : "Couldn\u2019t save that \u2014 try again?",
        );
      } finally {
        setReserveSubmitting(false);
      }
    },
    [reserveEmail, reserveName, reserveSubmitting, token],
  );

  const mailtoHref = `mailto:abe@thejackpotchi.com?subject=${encodeURIComponent(
    `Question about ${bookerFirstName}\u2019s Jackpot trip (${dateRange})`,
  )}`;

  return (
    <section className={styles.section} aria-label="Group actions">
      {/* Vote */}
      <div className={styles.block}>
        <span className={styles.eyebrow}>Cast your vote</span>
        <p className={styles.helper}>
          Quick signal so {bookerFirstName} knows where you land.
        </p>
        <div className={styles.voteRow} role="radiogroup" aria-label="Your vote">
          {(
            [
              ["yes", "Yes \u2014 I\u2019m in"],
              ["maybe", "Maybe"],
              ["no", "Can\u2019t make it"],
            ] as ReadonlyArray<[Vote, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={vote === id}
              className={`${styles.voteButton} ${vote === id ? styles.voteButtonActive : ""}`}
              data-vote={id}
              disabled={voteSubmitting !== null}
              onClick={() => void handleVote(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {vote ? (
          <p className={styles.voteConfirm}>Got it &mdash; {bookerFirstName} can see where you stand.</p>
        ) : null}
      </div>

      {/* Reserve */}
      <div className={styles.block}>
        <span className={styles.eyebrow}>Reserve my stay</span>
        {reserveDone ? (
          <p className={styles.reserveDone}>
            You&rsquo;re in. {bookerFirstName} and Abe will loop you into the rest.
          </p>
        ) : reserveOpen ? (
          <form className={styles.reserveForm} onSubmit={handleReserveSubmit} noValidate>
            <p className={styles.helper}>
              Your name + email so {bookerFirstName} can count you in.
            </p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <input
                type="text"
                className={styles.input}
                value={reserveName}
                onChange={(e) => setReserveName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <input
                type="email"
                className={styles.input}
                value={reserveEmail}
                onChange={(e) => setReserveEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>
            <button
              type="submit"
              className={styles.reserveSubmit}
              disabled={!reserveName.trim() || !reserveEmail.trim() || reserveSubmitting}
            >
              {reserveSubmitting ? "Reserving\u2026" : "Count me in"}
            </button>
            {reserveError ? (
              <p className={styles.error} role="alert">
                {reserveError}
              </p>
            ) : null}
          </form>
        ) : (
          <>
            <p className={styles.helper}>
              Lock your spot. {bookerFirstName} will see your name on the list.
            </p>
            <button
              type="button"
              className={styles.reserveTrigger}
              onClick={() => setReserveOpen(true)}
            >
              Reserve my stay
            </button>
          </>
        )}
      </div>

      {/* Talk to Abe */}
      <div className={styles.block}>
        <span className={styles.eyebrow}>Have a question?</span>
        <p className={styles.helper}>
          Specific concern (parking, accessibility, allergies)? Abe is the host.
        </p>
        <a className={styles.mailto} href={mailtoHref}>
          Talk to Abe <span aria-hidden="true">{"\u2192"}</span>
        </a>
      </div>
    </section>
  );
}
