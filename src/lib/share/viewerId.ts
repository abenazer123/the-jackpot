/**
 * Anonymous per-viewer id used by the trip-portal vote and
 * reservation routes. Stored in a long-lived cookie
 * (`jp_viewer`, 1-year TTL) so a friend who returns can update
 * their vote / reservation without logging in.
 *
 * 16 chars from a URL-safe alphabet — enough entropy that
 * collisions are effectively impossible at our scale, short enough
 * to keep the row PK reasonable.
 *
 * Privacy: the id is opaque. We don't log IP or fingerprint. The
 * coordinator only sees the tally (and reservation names that
 * friends explicitly leave).
 */

import type { NextRequest, NextResponse } from "next/server";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const LENGTH = 16;
const COOKIE_NAME = "jp_viewer";
const TTL_SECONDS = 365 * 86_400;

function randomId(): string {
  const bytes = new Uint8Array(LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i] & 63];
  return out;
}

/**
 * Read the viewer's id from the request cookie. Returns null if
 * absent — the caller can decide to mint one and call
 * `setViewerCookie` on the response.
 */
export function readViewerId(req: NextRequest): string | null {
  const v = req.cookies.get(COOKIE_NAME)?.value;
  return v && v.length === LENGTH ? v : null;
}

/**
 * Mint + set a viewer cookie on the given response. Returns the
 * id so the caller can use it for the row write in the same
 * round trip.
 */
export function mintViewerCookie(res: NextResponse): string {
  const id = randomId();
  res.cookies.set(COOKIE_NAME, id, {
    maxAge: TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return id;
}

/** Convenience: read or mint. */
export function ensureViewerId(
  req: NextRequest,
  res: NextResponse,
): string {
  const existing = readViewerId(req);
  if (existing) return existing;
  return mintViewerCookie(res);
}
