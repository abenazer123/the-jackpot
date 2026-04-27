import type { Metadata } from "next";
import Link from "next/link";

import { OccasionProvider } from "@/components/brand/OccasionProvider";
import { Starburst } from "@/components/brand/Starburst";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Book",
  robots: { index: false, follow: false },
};

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OccasionProvider>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brandLink} aria-label="Back to home">
            <Starburst
              size={11}
              tier={6}
              color="#d4a930"
              secondary="#e8a040"
              center="#ff9050"
              axisOpacity={0.95}
              diagOpacity={0.7}
              terOpacity={0.5}
            />
            <span className={styles.wordmark}>Jackpot</span>
          </Link>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </OccasionProvider>
  );
}
