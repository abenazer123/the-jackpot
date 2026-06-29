/**
 * ConfirmBooking — the interactive body of /confirm/[token]. Ticket,
 * payment schedule, security-hold callout, the agreement (modal + five
 * acknowledgments + typed signature + ID upload), and the gated Stripe
 * payment panel.
 *
 * Card data is entered in Stripe Elements (a Stripe-hosted iframe) and goes
 * straight to Stripe, never our server. The pay button unlocks only after
 * ID + all acknowledgments + a first-and-last-name signature; on success it
 * records the signed agreement (with the payment reference) and confirms.
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import {
  ACKNOWLEDGMENTS,
  AGREEMENT_DISCLAIMER,
  AGREEMENT_SECTIONS,
  paymentSchedule,
  planAmountCents,
} from "@/lib/booking/agreement";
import type { PaymentPlan } from "@/lib/booking/agreement";
import styles from "./confirm.module.css";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#c49025",
    colorText: "#5a4420",
    fontFamily: "Outfit, system-ui, sans-serif",
    borderRadius: "9px",
  },
};

export interface BookingData {
  token: string;
  guestName: string;
  firstName: string;
  address: string;
  arrivalLong: string;
  departureLong: string;
  arrivalDateLong: string;
  departureDateLong: string;
  nights: number;
  checkIn: string;
  checkInNote: string;
  checkOut: string;
  checkOutNote: string;
  guests: number;
  maxGuests: number;
  bookingRef: string;
  totalCents: number;
  holdUsd: number;
  milestone1: string;
  milestone2: string;
}

/** The three ways a guest can pay today. Same grand total in every case. */
const PLAN_OPTIONS: ReadonlyArray<{
  plan: PaymentPlan;
  title: string;
  sub: string;
}> = [
  {
    plan: "reserve",
    title: "Reserve your dates",
    sub: "Lowest to commit today. The balance follows the schedule.",
  },
  {
    plan: "half",
    title: "Pay half now",
    sub: "50 percent today, the final 50 percent before arrival.",
  },
  {
    plan: "full",
    title: "Pay in full",
    sub: "Settle everything now. Nothing else is due.",
  },
];

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtRound(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** Require a first and last name (at least two words). */
function isFullName(s: string): boolean {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => p.length >= 1);
}

export function ConfirmBooking({ booking }: { booking: BookingData }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [signature, setSignature] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [idPath, setIdPath] = useState<string | null>(null);
  const [idFileName, setIdFileName] = useState<string | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PaymentPlan>("reserve");

  const ackCount = ACKNOWLEDGMENTS.filter((a) => checks[a.id]).length;
  const allAck = ackCount === ACKNOWLEDGMENTS.length;
  const signed = isFullName(signature);
  const ready = !!idPath && allAck && signed;

  // The 50/100 percent plans need a known total; with no quote only the flat
  // reserve makes sense.
  const hasTotal = booking.totalCents > 0;
  const planOptions = hasTotal
    ? PLAN_OPTIONS
    : PLAN_OPTIONS.filter((o) => o.plan === "reserve");

  const schedule = useMemo(
    () =>
      paymentSchedule(
        booking.totalCents,
        booking.milestone1,
        booking.milestone2,
        plan,
      ),
    [booking.totalCents, booking.milestone1, booking.milestone2, plan],
  );
  const depositCents = planAmountCents(booking.totalCents, plan);

  async function handleIdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setIdUploading(true);
    setIdError(null);
    try {
      const fd = new FormData();
      fd.append("token", booking.token);
      fd.append("file", file);
      const res = await fetch("/api/booking/id-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "upload_failed");
      setIdPath(json.path);
      setIdFileName(json.filename ?? file.name);
    } catch {
      setIdError("We could not upload that. Use a clear photo or PDF under 10 MB.");
    } finally {
      setIdUploading(false);
    }
  }

  // Create the deposit PaymentIntent so Stripe Elements has a client secret
  // to confirm against. Re-runs when the plan changes so the charge amount
  // tracks the chosen option. No-op if Stripe is not configured.
  useEffect(() => {
    if (!stripePromise) return;
    let active = true;
    setClientSecret(null);
    fetch("/api/booking/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: booking.token, plan }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (active && j.ok) setClientSecret(j.clientSecret);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [booking.token, plan]);

  // Records the signed agreement (one contract package: signature + acks +
  // ID + the deposit payment reference) after a successful charge.
  async function recordSignature(paymentRef: string): Promise<boolean> {
    try {
      const res = await fetch("/api/booking/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: booking.token,
          signatureName: signature.trim(),
          ackIds: ACKNOWLEDGMENTS.filter((a) => checks[a.id]).map((a) => a.id),
          idDocumentPath: idPath,
          depositPaymentRef: paymentRef,
          plan,
        }),
      });
      const json = await res.json();
      return res.ok && json.ok;
    } catch {
      return false;
    }
  }

  const notReadyLabel = !idPath
    ? "Add your ID to continue"
    : !allAck
      ? "Complete checklist to pay"
      : "Sign to continue";
  const gateMsg = ready
    ? plan === "full"
      ? "This pays your stay in full. Your dates are locked, nothing else is due."
      : plan === "half"
        ? "This pays half today. The final 50 percent follows the schedule above."
        : "Your deposit reserves the dates. The balance follows the schedule above."
    : !idPath
      ? "Add a photo of your ID above to continue."
      : !allAck
        ? `Check all ${ACKNOWLEDGMENTS.length} items above, then sign. ${ACKNOWLEDGMENTS.length - ackCount} to go.`
        : "Type your first and last name to sign, and you are ready.";

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const toggle = (id: string) =>
    setChecks((c) => ({ ...c, [id]: !c[id] }));

  return (
    <main className={styles.wrap}>
      <div className={styles.grid}>
        <div className={styles.left}>
          {/* Ticket */}
          <section className={`${styles.card} ${styles.ticket}`}>
            <div className={styles.ticketTop}>
              <div className={styles.label}>Reservation for</div>
              <div className={styles.guest}>{booking.guestName}</div>
              <div className={styles.where}>The Jackpot &middot; {booking.address}</div>
              <div className={styles.ticketGrid}>
                <div className={styles.tg}>
                  <div className={styles.k}>Check in</div>
                  <div className={styles.v}>
                    {booking.arrivalLong}
                    <small>from {booking.checkIn}</small>
                    <span className={styles.exclusive}>{booking.checkInNote}</span>
                  </div>
                </div>
                <div className={styles.tg}>
                  <div className={styles.k}>Check out</div>
                  <div className={styles.v}>
                    {booking.departureLong}
                    <small>by {booking.checkOut}</small>
                    <span className={styles.exclusive}>{booking.checkOutNote}</span>
                  </div>
                </div>
                <div className={styles.tg}>
                  <div className={styles.k}>Guests</div>
                  <div className={styles.v}>
                    {booking.maxGuests} max<small>overnight, registered</small>
                  </div>
                </div>
                <div className={styles.tg}>
                  <div className={styles.k}>Booking ref</div>
                  <div className={styles.v}>
                    {booking.bookingRef}
                    <small>direct booking</small>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.perf} aria-hidden="true" />
            <div className={styles.ticketBottom}>
              <div>
                <div className={styles.totK}>Weekend total</div>
                <div className={styles.totV}>{fmt(booking.totalCents)}</div>
              </div>
              <span className={styles.pill}>
                <span aria-hidden="true">&#10038;</span> All inclusive direct rate
              </span>
            </div>
          </section>

          {/* Choose how you pay + the resulting schedule */}
          <section className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>01</span>
              <h2>Choose how you pay</h2>
            </div>
            <div
              className={styles.planGrid}
              role="radiogroup"
              aria-label="How much to pay today"
            >
              {planOptions.map((opt) => {
                const amt = planAmountCents(booking.totalCents, opt.plan);
                const selected = plan === opt.plan;
                return (
                  <button
                    type="button"
                    key={opt.plan}
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.planOption} ${selected ? styles.planSelected : ""}`}
                    onClick={() => setPlan(opt.plan)}
                  >
                    <span className={styles.planDot} aria-hidden="true" />
                    <span className={styles.planMain}>
                      <span className={styles.planTitle}>{opt.title}</span>
                      <span className={styles.planSub}>{opt.sub}</span>
                    </span>
                    <span className={styles.planAmt}>
                      {fmtRound(amt)}
                      <small>today</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.sched}>
              {schedule.map((row, i) => (
                <div
                  key={i}
                  className={`${styles.row} ${row.now ? styles.now : ""}`}
                >
                  <span className={styles.node} aria-hidden="true" />
                  <div>
                    <div className={styles.when}>
                      {row.when}
                      {row.now && <span className={styles.tag}>Due now</span>}
                    </div>
                    <div className={styles.what}>{row.what}</div>
                  </div>
                  <div className={styles.amt}>{fmt(row.amountCents)}</div>
                </div>
              ))}
            </div>
            <div className={styles.divider} />
            <p className={styles.fine}>
              Each payment is processed securely. We send a reminder before
              every due date. Nothing is ever charged without notice.
            </p>
          </section>

          {/* Security hold */}
          <section className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>02</span>
              <h2>About your security hold</h2>
            </div>
            <div className={styles.callout}>
              <h3>
                <span className={styles.ico} aria-hidden="true">
                  &#10038;
                </span>
                A ${booking.holdUsd} hold, not a charge.
              </h3>
              <p>
                Shortly before check in, we place a temporary{" "}
                <b>${booking.holdUsd} authorization hold</b> on your card. It
                simply reserves the amount, <b>no money moves to us</b>, and it
                releases automatically after your stay. You may briefly see a
                pending line in your banking app. That is normal.
              </p>
              <div className={styles.mini}>
                <span aria-hidden="true">&#10038;</span>
                <span>
                  <b>You are only ever charged if something happens.</b> Any fee
                  for damage, excessive cleaning, or a rule violation comes only
                  with written notice, photos, and a conversation with us first,
                  never a silent charge.
                </span>
              </div>
            </div>
          </section>

          {/* Verify your identity */}
          <section className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>03</span>
              <h2>Verify your identity</h2>
            </div>
            <p className={styles.fine} style={{ marginBottom: 16 }}>
              For everyone&rsquo;s safety, add a photo of the primary
              guest&rsquo;s government ID. It is stored privately, used only to
              confirm your booking, and never shared.
            </p>
            <label
              className={`${styles.idUpload} ${idPath ? styles.idDone : ""}`}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                hidden
                onChange={handleIdFile}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="11" r="2" />
                <path d="M14 10h4M14 13h4M6 16h9" />
              </svg>
              <span>
                {idUploading
                  ? "Uploading…"
                  : idPath
                    ? `Added: ${idFileName}. Tap to replace.`
                    : "Add a photo of your ID"}
              </span>
            </label>
            {idError && <div className={styles.payError}>{idError}</div>}
          </section>

          {/* Agreement + acknowledgments */}
          <section className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.secHead}>
              <span className={styles.secNum}>04</span>
              <h2>Review and agree</h2>
            </div>
            <p className={styles.fine} style={{ marginBottom: 16 }}>
              Please read the full agreement, then confirm each point below.
              Each box is its own acknowledgment so you know exactly what you
              are agreeing to.
            </p>

            <button
              type="button"
              className={styles.readlink}
              onClick={() => setModalOpen(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              Read the full Rental Agreement and House Rules
            </button>

            <div className={styles.ackProgress}>
              <span>
                {ackCount} of {ACKNOWLEDGMENTS.length} acknowledged
              </span>
              <div className={styles.ackBar}>
                <span
                  style={{
                    width: `${(ackCount / ACKNOWLEDGMENTS.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {ACKNOWLEDGMENTS.map((a) => (
              <label
                key={a.id}
                className={`${styles.check} ${checks[a.id] ? styles.done : ""}`}
              >
                <input
                  type="checkbox"
                  checked={!!checks[a.id]}
                  onChange={() => toggle(a.id)}
                />
                <span className={styles.ctxt}>
                  <b>{a.lead}</b> {a.rest}{" "}
                  <span className={styles.req}>Required</span>
                </span>
              </label>
            ))}

            <div className={styles.sign}>
              <label htmlFor="sigName">Type your full legal name to sign</label>
              <div className={styles.signRow}>
                <input
                  type="text"
                  id="sigName"
                  className={styles.sigInput}
                  placeholder="First and last name"
                  autoComplete="name"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
                <span className={styles.sigDate}>Signed {today}</span>
              </div>
              <p className={styles.sigHelp}>
                Use your full legal name, first and last, as it appears on
                your ID.
              </p>
            </div>
          </section>
        </div>

        {/* Payment panel */}
        <aside>
          <div className={`${styles.card} ${styles.pay}`}>
            {!confirmed ? (
              <>
                <div className={styles.payHead}>
                  <div className={styles.k}>Due today</div>
                  <div className={styles.payV}>
                    {fmtRound(depositCents)}{" "}
                    <small>
                      &middot;{" "}
                      {plan === "full" ? "paid in full" : "balance later"}
                    </small>
                  </div>
                </div>
                <div className={styles.payBody}>
                  {stripePromise && clientSecret ? (
                    <Elements
                      key={clientSecret}
                      stripe={stripePromise}
                      options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
                    >
                      <PaymentForm
                        ready={ready}
                        readyLabel={`Pay ${fmtRound(depositCents)} and confirm`}
                        notReadyLabel={notReadyLabel}
                        gateMsg={gateMsg}
                        holdUsd={booking.holdUsd}
                        recordSignature={recordSignature}
                        onConfirmed={() => setConfirmed(true)}
                      />
                    </Elements>
                  ) : (
                    <>
                      <div className={styles.stripeMount}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="10" rx="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        <span>
                          {stripePromise
                            ? "Loading secure payment…"
                            : "Connect Stripe to activate payment."}
                        </span>
                      </div>
                      <div className={styles.gateMsg}>{gateMsg}</div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.confirmed}>
                <div className={styles.seal} aria-hidden="true">
                  &#10038;
                </div>
                <h3>You are all set, {booking.firstName}.</h3>
                <p>
                  Your deposit is in and your dates are locked. A signed copy of
                  your agreement and your receipt are on the way by email.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Agreement modal */}
      {modalOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Rental Agreement and House Rules">
            <div className={styles.modalHead}>
              <h3>Rental Agreement and House Rules</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              {AGREEMENT_SECTIONS.map((s) => (
                <div key={s.h}>
                  <h4>{s.h}</h4>
                  {s.h === "Fees" ? (
                    <ul>
                      {s.body.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    s.body.map((p, i) => <p key={i}>{p}</p>)
                  )}
                </div>
              ))}
              <p className={styles.modalDisc}>{AGREEMENT_DISCLAIMER}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** The Stripe card field + gated pay button. Lives inside <Elements>, so it
 *  can use the Stripe hooks. On a successful charge it records the signed
 *  agreement (with the payment reference) and confirms. */
function PaymentForm({
  ready,
  readyLabel,
  notReadyLabel,
  gateMsg,
  holdUsd,
  recordSignature,
  onConfirmed,
}: {
  ready: boolean;
  readyLabel: string;
  notReadyLabel: string;
  gateMsg: string;
  holdUsd: number;
  recordSignature: (paymentRef: string) => Promise<boolean>;
  onConfirmed: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!ready || busy || !stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (error) {
      setErr(error.message ?? "Your payment could not be completed.");
      setBusy(false);
      return;
    }
    if (
      paymentIntent &&
      (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")
    ) {
      const ok = await recordSignature(paymentIntent.id);
      if (!ok) {
        setErr(
          "Your payment went through but we could not save your agreement. Please contact us and we will sort it out.",
        );
        setBusy(false);
        return;
      }
      onConfirmed();
      return;
    }
    setErr("Your payment could not be completed.");
    setBusy(false);
  }

  return (
    <>
      <PaymentElement />
      <div className={styles.cardNote}>
        <span aria-hidden="true">&#10038;</span> This same card is saved for
        your ${holdUsd} hold, not charged now.
      </div>
      <button
        type="button"
        className={`${styles.paybtn} ${ready ? styles.ready : ""}`}
        disabled={!ready || busy || !stripe}
        onClick={submit}
      >
        {busy ? "Processing payment…" : ready ? readyLabel : notReadyLabel}
      </button>
      {err && <div className={styles.payError}>{err}</div>}
      <div className={styles.gateMsg}>{gateMsg}</div>
      <div className={styles.trust}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        Encrypted and processed securely
      </div>
    </>
  );
}
