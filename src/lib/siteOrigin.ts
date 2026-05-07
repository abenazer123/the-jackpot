/**
 * Resolve the public site origin (no trailing slash).
 *
 * Order of precedence:
 *   1. NEXT_PUBLIC_SITE_URL — canonical, set in Vercel env. Use this
 *      to control the exact value (custom domain, https, etc.).
 *   2. VERCEL_URL — Vercel-injected auto value, e.g.
 *      "the-jackpot-abc123.vercel.app". Server-side only. Lets
 *      preview deploys work without the operator setting anything.
 *   3. http://localhost:3000 — last-resort fallback for local dev.
 *
 * Why this exists: emails (guest confirmation, host notifications)
 * embed `${origin}/trip/${token}` links. Before this helper the
 * fallback chain was inlined in 6 places and several deploys went
 * out missing NEXT_PUBLIC_SITE_URL — which sent guests localhost
 * URLs in production. Centralising here so a missing env var on
 * Vercel still degrades to the auto-VERCEL_URL instead of
 * localhost.
 */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
