/**
 * The Jackpot — sleeping arrangements.
 *
 * Static property data — the bedroom-by-bedroom bed list a group
 * needs to negotiate "where do I sleep?" before they commit. This
 * is the #1 follow-up question every group chat asks after price.
 *
 * Hardcoded for v1; later this can be lifted into a property
 * config row in Supabase if Abe wants to tweak it without a deploy.
 */

export interface SleepingRow {
  /** Display label — what shows up in the list. */
  label: string;
  /** Bed configuration as a short readable phrase. */
  beds: string;
}

export const SLEEPING_ARRANGEMENTS: ReadonlyArray<SleepingRow> = [
  { label: "Bedroom 1", beds: "King" },
  { label: "Bedroom 2", beds: "Queen" },
  { label: "Bedroom 3", beds: "Queen" },
  { label: "Bedroom 4", beds: "Full bunk" },
  { label: "Bedroom 5", beds: "Two twin bunks" },
  { label: "Living room", beds: "Two pull-outs" },
];

/** Total individual beds across the home. Surfaced as a one-line
 *  intro on the trip page so the group sees the count before
 *  scanning the breakdown. */
export const TOTAL_BEDS = 11;

/** Total sleep capacity. The hero strip on the landing page
 *  shows "14 sleeps"; if we ever change the bed list, both should
 *  stay in sync via this constant. */
export const SLEEPS = 14;
