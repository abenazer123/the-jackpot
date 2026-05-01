/**
 * Admin shell — only wraps protected pages. The login route is
 * outside this route group so it doesn't inherit the nav.
 */

import Link from "next/link";

import { signOut } from "@/lib/admin/auth";

import styles from "./layout.module.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  async function logout() {
    "use server";
    await signOut();
    const { redirect } = await import("next/navigation");
    redirect("/admin/login");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.brand}>
          Jackpot · Admin
        </Link>
        <nav className={styles.nav}>
          <Link href="/admin">Overview</Link>
          <Link href="/admin/categories">Categories</Link>
          <Link href="/admin/entries">Entries</Link>
          <Link href="/admin/monthly">Monthly</Link>
          <Link href="/admin/capex">Capex</Link>
        </nav>
        <form action={logout} className={styles.logoutForm}>
          <button type="submit" className={styles.logout}>
            Sign out
          </button>
        </form>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
