/**
 * Bachelorette product data for the /bachelorette landing page: the
 * per-person hook inputs, the named add-ons, the three tiers, and the
 * itemized "whole weekend" anchor.
 *
 * IMPORTANT: every number here is PROVISIONAL — there is no tier/add-on
 * pricing in the system yet. These are placeholders for Abe to confirm or
 * replace. The page presents them as "built per group" and "about", never
 * as a hard quote; real numbers are finalized in the Olivia conversation.
 */

/** Inputs for the on-page per-person figure. Representative, not a live
 *  quote — the slider math is baseNightly / group, labeled "about". */
export const PER_PERSON = {
  baseNightlyUsd: 700, // provisional representative weekend nightly
  nights: 2,
  minGroup: 6,
  maxGroup: 14,
  defaultGroup: 12,
};

export function perPersonPerNight(group: number): number {
  const g = Math.max(1, group);
  return Math.round(PER_PERSON.baseNightlyUsd / g);
}

export function perPersonWeekend(group: number): number {
  const g = Math.max(1, group);
  return Math.round((PER_PERSON.baseNightlyUsd * PER_PERSON.nights) / g);
}

/** Add-ons, named as possibility (no prices on the page; numbers live in
 *  the conversation). */
export const ADD_ONS: ReadonlyArray<{ label: string; blurb: string }> = [
  { label: "Glam for the morning out", blurb: "Hair and makeup for the whole crew." },
  { label: "A boat day on the lake", blurb: "The afternoon everyone remembers." },
  { label: "A private chef", blurb: "The dinner you will still be talking about." },
  { label: "A photographer and a video", blurb: "So it is documented properly." },
  { label: "Decor done right", blurb: "Balloons, florals, a backdrop worth the photos." },
];

export interface BachTier {
  key: "base" | "middle" | "full";
  name: string;
  tagline: string;
  priceNote: string; // shown instead of a hard price
  includes: ReadonlyArray<string>;
}

export const TIERS: ReadonlyArray<BachTier> = [
  {
    key: "base",
    name: "The house",
    tagline: "Start with the house and everything already included.",
    priceNote: "Included",
    includes: [
      "The whole home, sleeps 14",
      "Free planning with us",
      "Your Chicago bachelorette playbook",
      "Welcome setup, in-house camera, recap video",
    ],
  },
  {
    key: "middle",
    name: "The favorites",
    tagline:
      "Add the few things almost every group does anyway, bundled for less than booking them one by one.",
    priceNote: "Built per group",
    includes: [
      "A boat day on the lake",
      "Glam for the morning out",
      "A private chef dinner",
      "Decor done right",
    ],
  },
  {
    key: "full",
    name: "The whole weekend",
    tagline:
      "Or hand us the whole weekend, start to finish. We build it, you just show up.",
    priceNote: "around $15,000 for the group",
    includes: [
      "Everything in the house, all weekend",
      "Glam for the crew",
      "A private chef dinner",
      "A boat day on the lake",
      "Photographer and a recap video",
      "Full decor: balloons, florals, a backdrop",
      "Private transport for the weekend",
    ],
  },
];

/** The anchor's itemized contents (provisional values) so the number reads
 *  as a stack of real value rather than a bare figure. Values sum to the
 *  "piece by piece" total; the done-for-you price is lower (ANCHOR_DONE_*).
 *  Abe confirms/replaces. */
export const ANCHOR_ITEMS: ReadonlyArray<{
  label: string;
  valueUsd: number;
  /** icon key for BachIcon */
  icon: string;
}> = [
  { label: "The house for the weekend", valueUsd: 1800, icon: "house" },
  { label: "Glam for the crew", valueUsd: 2800, icon: "glam" },
  { label: "The chef’s dinner", valueUsd: 3000, icon: "chef" },
  { label: "The boat day", valueUsd: 3800, icon: "boat" },
  { label: "Photos and a video", valueUsd: 2600, icon: "camera" },
  { label: "Full decor: balloons, florals, a backdrop", valueUsd: 2200, icon: "decor" },
  { label: "Private transport all weekend", valueUsd: 1800, icon: "transport" },
];

/** Flipped anchor: lead with the done-for-you ceiling, strike it through
 *  the piece-by-piece total (the sum of ANCHOR_ITEMS). Provisional. */
export const ANCHOR_DONE_FROM_USD = 15000;
export const ANCHOR_PIECEMEAL_USD = 18000;
export const ANCHOR_TOTAL_LABEL = "from $15,000 for the group";

/** The "favorites" middle, named not numbered on the page. */
export const MIDDLE_BUNDLE = {
  name: "The favorites",
  line: "Most groups land in between. The boat, glam, the chef, the decor, bundled for your group. We price it for your dates.",
};

/** Value stack: the included extras, given dollar values so "free" reads
 *  as real money she keeps. Provisional. */
export const VALUE_STACK: ReadonlyArray<{
  label: string;
  valueLabel: string;
  icon: string;
}> = [
  { label: "We plan the whole weekend with you", valueLabel: "$500 value", icon: "planning" },
  { label: "Your Chicago bachelorette playbook", valueLabel: "$150 value", icon: "playbook" },
  { label: "The house set for her arrival: sign, decor, welcome", valueLabel: "$250 value", icon: "welcome" },
  { label: "A camera in the house for the weekend", valueLabel: "$100 value", icon: "camera" },
  { label: "A recap video to keep", valueLabel: "$800 value", icon: "recap" },
  { label: "Early check in and late check out when we can", valueLabel: "$150 value", icon: "clock" },
  { label: "Flexible deposit and cancellation", valueLabel: "Peace of mind", icon: "shield" },
];

export const VALUE_STACK_TOTAL_LABEL = "About $2,000 of it, handled, in every weekend. No extra charge.";

/** The day/experience story tiles (named as outcomes, no prices). */
export const EXPERIENCE_TILES: ReadonlyArray<{ line: string; icon: string }> = [
  { line: "The boat day everyone remembers.", icon: "boat" },
  { line: "Glam, before you go out.", icon: "glam" },
  { line: "A chef, for the dinner you talk about for years.", icon: "chef" },
  { line: "Photos and a video, so it is documented properly.", icon: "camera" },
];

/** Static, editable scarcity line. Abe sets the true number and keeps it
 *  current. (A real-availability counter is a later pass.) */
export const BACH_SCARCITY = "4 summer weekends left";
