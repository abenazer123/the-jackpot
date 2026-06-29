"use client";

/**
 * Per-inquiry composer for emailing a guest their payment link. Abe edits
 * the subject + a personal note; the summary card, secure button, and
 * signature are templated by the server action. Lives inside the inquiry
 * detail on /admin/inquiries.
 */

import { useState } from "react";

import { sendPaymentLink } from "./actions";
import own from "./inquiries.module.css";

type Status = "idle" | "sending" | "sent" | "error";

const ERRORS: Record<string, string> = {
  no_email_on_file: "No email on file for this inquiry.",
  no_dates_on_file: "This inquiry has no dates.",
  no_quote_total: "No quote total yet. Update prices first.",
  email_not_configured: "Email is not configured on the server.",
  test_email_skipped: "That looks like a test address, so it was not sent.",
  subject_required: "Add a subject.",
  note_required: "Add a note.",
};

export function PaymentLinkComposer({
  token,
  recipient,
  defaultSubject,
  defaultNote,
  canSend,
  disabledReason,
  alreadySent,
}: {
  token: string;
  recipient: string | null;
  defaultSubject: string;
  defaultNote: string;
  canSend: boolean;
  disabledReason?: string;
  alreadySent?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [note, setNote] = useState(defaultNote);
  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setStatus("sending");
    setErr(null);
    const res = await sendPaymentLink({ token, subject, note });
    if (res.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErr(ERRORS[res.error ?? ""] ?? "Could not send. Try again.");
    }
  }

  if (!open) {
    return (
      <div className={own.plkRow}>
        <button
          type="button"
          className={own.plkOpen}
          onClick={() => setOpen(true)}
          disabled={!canSend}
          title={!canSend ? disabledReason : undefined}
        >
          {alreadySent ? "Resend payment link" : "Send payment link"}
        </button>
        {!canSend && disabledReason ? (
          <span className={own.plkHint}>{disabledReason}</span>
        ) : alreadySent ? (
          <span className={own.plkHint}>Last sent {alreadySent}</span>
        ) : recipient ? (
          <span className={own.plkHint}>To {recipient}</span>
        ) : null}
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className={own.plkRow}>
        <span className={own.plkSent}>Payment link sent to {recipient}.</span>
        <button
          type="button"
          className={own.plkLink}
          onClick={() => {
            setOpen(false);
            setStatus("idle");
          }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className={own.plkComposer}>
      <div className={own.plkField}>
        <label className={own.plkLabel}>To</label>
        <span className={own.plkTo}>{recipient}</span>
      </div>
      <div className={own.plkField}>
        <label className={own.plkLabel} htmlFor={`subj-${token}`}>
          Subject
        </label>
        <input
          id={`subj-${token}`}
          className={own.plkInput}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className={own.plkField}>
        <label className={own.plkLabel} htmlFor={`note-${token}`}>
          Your note
        </label>
        <textarea
          id={`note-${token}`}
          className={own.plkTextarea}
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <p className={own.plkHint}>
        The dates, total, payment options, secure button, and signature are
        added automatically.
      </p>
      {err ? <div className={own.plkError}>{err}</div> : null}
      <div className={own.plkActions}>
        <button
          type="button"
          className={own.plkSend}
          onClick={send}
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Send email"}
        </button>
        <button
          type="button"
          className={own.plkLink}
          onClick={() => setOpen(false)}
          disabled={status === "sending"}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
