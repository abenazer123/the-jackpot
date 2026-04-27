/**
 * Location content shared between the landing-page LocationSection
 * and the trip-portal page.
 *
 * Single source of truth — copy edits here propagate to both
 * surfaces. Don't inline location strings anywhere else.
 */

import type { OccasionId } from "@/components/brand/OccasionProvider";

/** Two-line headline. The trip page renders this with a leading
 *  starburst (same lock-up as the landing page). */
export const HEADLINE_LINE_1 = "Chicago\u2019s north side.";
export const HEADLINE_LINE_2 = "Quiet streets, loud weekends.";

export const PARAGRAPH =
  "The Jackpot sits in North Park, a tree-lined neighborhood ten minutes from everything and a world away from downtown noise. Three breweries within walking distance. Some of the best Mexican and Filipino food in the city around the corner. And a backyard that makes most groups cancel their dinner reservations.";

export const NAMED_SPOTS =
  "Half Acre Beer Garden \u00B7 Lula Cafe \u00B7 Old Irving Brewing \u00B7 Gene\u2019s Rooftop Wine Garden \u2014 all within 10 minutes.";

export interface DistancePill {
  time: string;
  label: string;
}

export const DISTANCES: ReadonlyArray<DistancePill> = [
  { time: "15 min", label: "to O\u2019Hare" },
  { time: "16 min", label: "to downtown" },
  { time: "15 min", label: "to Wrigley Field" },
  { time: "12 min", label: "to Wicker Park" },
  { time: "9 min walk", label: "to the Blue Line" },
];

export interface OccasionPill {
  time: string;
  label: string;
  sub?: string;
}

export interface OccasionPillConfig {
  eyebrow: string;
  pills: OccasionPill[];
}

export const OCCASION_PILLS: Record<
  Exclude<OccasionId, "getaway">,
  OccasionPillConfig
> = {
  bachelorette: {
    eyebrow:
      "\u2014 what groups on Batch are searching for, within 20 minutes",
    pills: [
      { time: "20 min", label: "Boats" },
      { time: "12 min", label: "Hibachi row" },
      { time: "15 min", label: "Rooftop bars" },
      { time: "here", label: "Party bus pickups" },
      { time: "in-house", label: "Private chef" },
    ],
  },
  wedding: {
    eyebrow: "\u2014 venues within 22 minutes, plus 40+ others",
    pills: [
      { time: "8 min", label: "Artifact Events" },
      { time: "15 min", label: "Morgan MFG" },
      { time: "18 min", label: "West Loop", sub: "20+ venues" },
      { time: "20 min", label: "Lacuna Lofts" },
      { time: "22 min", label: "Bridgeport Art Center" },
    ],
  },
  family: {
    eyebrow: "\u2014 classics within 25 minutes",
    pills: [
      { time: "18 min", label: "Lincoln Park Zoo" },
      { time: "22 min", label: "Navy Pier" },
      { time: "25 min", label: "Field Museum" },
      { time: "25 min", label: "Shedd Aquarium" },
    ],
  },
  birthday: {
    eyebrow: "\u2014 dinner and drinks within 20 minutes",
    pills: [
      { time: "18 min", label: "West Loop dining", sub: "many spots" },
      { time: "15 min", label: "River North", sub: "many spots" },
      { time: "18 min", label: "Fulton Market" },
      { time: "15 min", label: "Rooftop bars" },
    ],
  },
};

/** Map an inquiry's `reason` (the funnel chip the booker picked)
 *  to the matching occasion id used by ChicagoMapViewer + the
 *  occasion pill row. Returns null for reasons that don't have
 *  occasion-specific content (e.g. "Work retreat", "Other"). */
export function reasonToOccasion(
  reason: string | null | undefined,
): OccasionId | null {
  switch (reason) {
    case "Birthday":
      return "birthday";
    case "Bachelor/ette":
      return "bachelorette";
    case "Wedding":
      return "wedding";
    case "Family trip":
      return "family";
    case "Getaway":
      return "getaway";
    default:
      return null;
  }
}
