/**
 * /confirm/[token] not-found — shown for a bad or expired confirmation link.
 */

import styles from "@/components/booking/confirm.module.css";

export default function ConfirmNotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.wordmark}>
          <span className={styles.pip} aria-hidden="true">
            &#10038;
          </span>
          The Jackpot
        </div>
      </div>
      <main className={styles.wrap}>
        <div style={{ maxWidth: 520, margin: "80px auto", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--jp-font-display)",
              fontSize: 32,
              color: "#5a4420",
              margin: 0,
            }}
          >
            This link has moved on.
          </h1>
          <p style={{ color: "#9a8456", marginTop: 12, lineHeight: 1.6 }}>
            Your confirmation link is no longer active. Text us and we will send
            a fresh one so you can finish locking in your dates.
          </p>
        </div>
      </main>
    </div>
  );
}
