import Link from "next/link";

import styles from "./not-found.module.css";

export default function QuoteNotFound() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>This quote couldn&rsquo;t be found.</h1>
      <p className={styles.body}>
        The link may have expired or been mistyped. Start a new pricing
        guide from the home page.
      </p>
      <Link href="/" className={styles.link}>
        Take me home
      </Link>
    </div>
  );
}
