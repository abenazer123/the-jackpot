/**
 * Location context for the trip portal page.
 * Kept text-only for v1 — no map embed (heavy + slow on mobile).
 */

export const LOCATION = {
  neighborhood: "West Loop, Chicago",
  /** Short two-line context line. The trip page renders this verbatim. */
  travelTimes: "18 min from O'Hare \u00B7 12 min from downtown",
} as const;
