/**
 * /admin/login — the only public /admin/* path. Single password
 * field. Server action verifies + sets the session cookie, then
 * redirects to ?next= (or /admin if absent).
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { isAdmin, signIn } from "@/lib/admin/auth";

import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  if (await isAdmin()) {
    redirect(sp.next && sp.next.startsWith("/admin") ? sp.next : "/admin");
  }

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "");
    const ok = await signIn(password);
    if (!ok) {
      const params = new URLSearchParams({ error: "1" });
      if (next) params.set("next", next);
      redirect(`/admin/login?${params.toString()}`);
    }
    redirect(next && next.startsWith("/admin") ? next : "/admin");
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} action={login}>
        <h1 className={styles.title}>Jackpot &middot; Admin</h1>
        <p className={styles.sub}>Operator-only access.</p>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          autoComplete="current-password"
          className={styles.input}
        />
        {sp.error ? (
          <p className={styles.error}>That password didn&rsquo;t match.</p>
        ) : null}
        <button type="submit" className={styles.button}>
          Sign in
        </button>
      </form>
    </main>
  );
}
