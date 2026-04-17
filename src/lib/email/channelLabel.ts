/**
 * channelLabel — map (utm_source, utm_medium) to a human-readable label
 * for the host notification email's glance-line banner.
 *
 * Fallback returns the raw source so custom UTMs invented later
 * (?utm_source=artifact-events) render as "artifact-events" without a
 * code change. Promote entries to the explicit table below once a source
 * is worth a better display name.
 */

export function channelLabel(
  source?: string | null,
  medium?: string | null,
): string | null {
  if (!source) return null;
  const s = source.toLowerCase();
  const m = medium?.toLowerCase();

  if (s === "google" && m === "cpc") return "Google Ads";
  if (s === "batch") return "Batch";
  if (s === "instagram" || m === "social") return "Instagram";
  if (s === "facebook" || s === "meta") return "Meta Ads";
  if (s === "planner") return "Wedding Planner Referral";
  if (s === "venue") return "Venue Referral";
  if (s === "email") return "Email";
  if (s === "direct") return "Direct";

  return source;
}
