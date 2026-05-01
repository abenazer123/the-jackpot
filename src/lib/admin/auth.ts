/**
 * Admin auth — single-user password gate.
 *
 * Set two env vars:
 *   ADMIN_PASSWORD       — what you type into the login form
 *   ADMIN_SESSION_TOKEN  — opaque random string used as the cookie
 *                          value. Rotate to invalidate every session.
 *
 * Cookie is HttpOnly + sameSite lax + 30-day expiry. Middleware
 * (src/middleware.ts) gates /admin/* routes by checking the cookie
 * value against ADMIN_SESSION_TOKEN; this module owns sign-in/out
 * + a server-component-friendly `requireAdmin` helper.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const COOKIE_NAME = "jp_admin";

function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD ?? null;
}

function adminToken(): string | null {
  return process.env.ADMIN_SESSION_TOKEN ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  return Boolean(cookie) && cookie === expected;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function signIn(password: string): Promise<boolean> {
  const expected = adminPassword();
  const token = adminToken();
  if (!expected || !token) return false;
  if (password !== expected) return false;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86_400,
  });
  return true;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
