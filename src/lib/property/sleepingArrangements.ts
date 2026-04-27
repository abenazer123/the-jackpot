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
  /** Optional secondary line (e.g. floor / location hint). */
  note?: string;
}

export const SLEEPING_ARRANGEMENTS: ReadonlyArray<SleepingRow> = [
  { label: "Bedroom 1", beds: "King", note: "Main floor" },
  { label: "Bedroom 2", beds: "Queen" },
  { label: "Bedroom 3", beds: "Two twins" },
  { label: "Bedroom 4", beds: "Queen" },
  { label: "Bedroom 5", beds: "Bunks + twin" },
  { label: "Sofa beds", beds: "Two pull-outs", note: "Living room" },
];

/** Total sleep capacity — single source of truth. The hero strip
 *  on the landing page already shows "14 sleeps"; if we ever change
 *  the bed list, both should stay in sync via this constant. */
export const SLEEPS = 14;
