/**
 * Chicago event calendar — drives the honest "why these dates are
 * expensive" copy on the quote reveal screen.
 *
 * Replaces the generic "peak pricing for these dates" message with
 * specific, verifiable context ("Lollapalooza takes Grant Park that
 * weekend"). Research finding: specific reasons read as honest; generic
 * phrasing reads as surge-pricing evasion.
 *
 * Ordering matters: eventForDates() returns the FIRST match, so list
 * the most-specific / highest-demand drivers before broad windows.
 * Graduation season sits last because it's a four-week bucket that
 * would shadow more specific events if listed earlier.
 *
 * Date confidence (2026):
 *   - CONFIRMED annual pattern: Marathon (2nd Sun of Oct), Memorial Day,
 *     Labor Day, July 4, NYE, St. Patrick's.
 *   - ESTIMATED from recent-years pattern (verify before season):
 *     Lollapalooza (late Jul / early Aug), NASCAR Street Race (early
 *     Jul), Air & Water Show (mid Aug).
 */

export interface ChicagoEvent {
  /** Short internal label — not shown to users. */
  label: string;
  /** Sentence fragment dropped into copy: "These are premium dates — {reason}." */
  reason: string;
  /** First night of the event (inclusive). */
  startIso: string;
  /** Last night of the event (inclusive). */
  endIso: string;
}

export const CHICAGO_EVENTS: ChicagoEvent[] = [
  {
    label: "Lollapalooza",
    reason:
      "Lollapalooza takes Grant Park that weekend and the whole city books up",
    startIso: "2026-07-30",
    endIso: "2026-08-02",
  },
  {
    label: "NASCAR Street Race",
    reason:
      "NASCAR's Chicago Street Race turns the Loop into a track that weekend",
    startIso: "2026-07-04",
    endIso: "2026-07-05",
  },
  {
    label: "Chicago Marathon",
    reason:
      "the Chicago Marathon brings 50,000 runners and their families into the city that weekend",
    startIso: "2026-10-09",
    endIso: "2026-10-11",
  },
  {
    label: "Air & Water Show",
    reason:
      "the Air & Water Show draws huge crowds to the lakefront that weekend",
    startIso: "2026-08-15",
    endIso: "2026-08-16",
  },
  {
    label: "St. Patrick's weekend",
    reason:
      "it's St. Patrick's weekend and the Chicago River gets dyed green",
    startIso: "2026-03-14",
    endIso: "2026-03-17",
  },
  {
    label: "Memorial Day weekend",
    reason:
      "it's Memorial Day weekend, one of the biggest tourism weekends of the year",
    startIso: "2026-05-22",
    endIso: "2026-05-25",
  },
  {
    label: "Labor Day weekend",
    reason: "it's Labor Day weekend",
    startIso: "2026-09-04",
    endIso: "2026-09-07",
  },
  {
    label: "July 4 weekend",
    reason: "it's Fourth of July weekend in Chicago",
    startIso: "2026-07-03",
    endIso: "2026-07-06",
  },
  {
    label: "New Year's Eve",
    reason: "it's New Year's Eve weekend in Chicago",
    startIso: "2026-12-30",
    endIso: "2027-01-01",
  },
  {
    label: "Chicago graduation season",
    reason:
      "Chicago's college graduation season overlaps these dates — Northwestern, UChicago, DePaul, Loyola all commence in this window",
    startIso: "2026-05-15",
    endIso: "2026-06-15",
  },
];

/**
 * Returns the first event whose date range overlaps with the stay, or
 * null if none match. A stay "overlaps" an event if any night of the
 * stay falls within the event's inclusive range.
 *
 * Stay convention: `arrivalIso` is the first night (inclusive),
 * `departureIso` is the checkout day (exclusive — so the last NIGHT
 * slept is `departureIso - 1 day`).
 *
 * Overlap condition: `arrival <= event.end` (stay starts on or before
 * event ends) AND `departure > event.start` (last night of stay is on
 * or after event start).
 */
export function eventForDates(
  arrivalIso: string,
  departureIso: string,
): ChicagoEvent | null {
  for (const event of CHICAGO_EVENTS) {
    if (arrivalIso <= event.endIso && departureIso > event.startIso) {
      return event;
    }
  }
  return null;
}
