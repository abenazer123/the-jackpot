/**
 * Three friend-facing actions on the trip portal, each as its own
 * exported component so the page can place them at different
 * points in the scroll:
 *
 *   <TripVoteCta>    — group-chat-speed YES / MAYBE / NO. Lives
 *                      right after the price (gut-check moment).
 *   <TripReserveCta> — name + email lock-in. Lives after the full
 *                      pitch (sleeping list / photos / location).
 *   <TripTalkCta>    — quiet mailto safety valve at the bottom.
 *
 * They share API + cookie behavior (viewer_id is set on first
 * trip-view call and persisted via httpOnly cookie); state is
 * scoped per component, so each can mount/unmount independently
 * without losing the friend's vote or reservation progress.
 *
 * None of these render for the booker herself — the trip page
 * gates on the owner cookie and shows the ShareDock instead.
 */

"use client";

import { useCallback, useState } from "react";

import styles from "./CtaStack.module.css";

interface CommonProps {
  /** Public share token — used in the API route paths. */
  token: string;
  /** Booker's first name — used in copy + mailto subject. */
  bookerFirstName: string;
}

interface TalkProps extends CommonProps {
  /** Date range like "Sep 26 – Sep 28" for the talk-to-Abe subject. */
  dateRange: string;
}

type Vote = "yes" | "maybe" | "no";

// ──────────────────────────────────────────────────────────────
// Vote
// ──────────────────────────────────────────────────────────────
export function TripVoteCta({ token, bookerFirstName }: CommonProps) {
  const [vote, setVote] = useState<Vote | null>(null);
  const [submitting, setSubmitting] = useState<Vote | null>(null);

  const handleVote = useCallback(
    async (next: Vote) => {
      if (submitting) return;
      setSubmitting(next);
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
        setSubmitting(null);
      }
    },
    [token, vote, submitting],
  );

  return (
    <section className={styles.block} aria-label="Cast your vote">
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
            disabled={submitting !== null}
            onClick={() => void handleVote(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {vote ? (
        <p className={styles.voteConfirm}>
          Got it &mdash; {bookerFirstName} can see where you stand.
        </p>
      ) : null}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Reserve
// ──────────────────────────────────────────────────────────────
export function TripReserveCta({ token, bookerFirstName }: CommonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName || !trimmedEmail) return;
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/trip-reserve/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
        });
        if (!res.ok) {
          const detail = await res
            .json()
            .catch(() => ({ error: "save failed" }));
          throw new Error(detail.error ?? "save failed");
        }
        setDone(true);
      } catch (err) {
        setError(
          (err as Error).message === "invalid email"
            ? "Double-check your email?"
            : "Couldn\u2019t save that \u2014 try again?",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [email, name, submitting, token],
  );

  return (
    <section className={styles.block} aria-label="Reserve my stay">
      <span className={styles.eyebrow}>Reserve my stay</span>
      {done ? (
        <p className={styles.reserveDone}>
          You&rsquo;re in. {bookerFirstName} and Abe will loop you into the rest.
        </p>
      ) : open ? (
        <form
          className={styles.reserveForm}
          onSubmit={handleSubmit}
          noValidate
        >
          <p className={styles.helper}>
            Your name + email so {bookerFirstName} can count you in.
          </p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
          <button
            type="submit"
            className={styles.reserveSubmit}
            disabled={!name.trim() || !email.trim() || submitting}
          >
            {submitting ? "Reserving\u2026" : "Count me in"}
          </button>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
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
            onClick={() => setOpen(true)}
          >
            Reserve my stay
          </button>
        </>
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Talk to Abe
// ──────────────────────────────────────────────────────────────
export function TripTalkCta({ bookerFirstName, dateRange }: TalkProps) {
  const mailtoHref = `mailto:abe@thejackpotchi.com?subject=${encodeURIComponent(
    `Question about ${bookerFirstName}\u2019s Jackpot trip (${dateRange})`,
  )}`;
  return (
    <section className={styles.block} aria-label="Talk to Abe">
      <span className={styles.eyebrow}>Have a question?</span>
      <p className={styles.helper}>
        Specific concern (parking, accessibility, allergies)? Abe is the host.
      </p>
      <a className={styles.mailto} href={mailtoHref}>
        Talk to Abe <span aria-hidden="true">{"\u2192"}</span>
      </a>
    </section>
  );
}
