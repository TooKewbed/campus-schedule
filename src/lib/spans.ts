import { byStart, type ScheduleEvent } from '../types/event';
import { addDays, sameDay, startOfDay } from './time';
import { GRID } from './layout';

/**
 * Events that are not one block on one day.
 *
 * Two shapes the grid could not previously express:
 *
 *   A moment — "flight leaves at 5:30pm". It has a time but no end, because
 *   nobody knows or cares how long a departure takes. Forcing an end time on it
 *   means inventing one, and an invented hour then blocks an hour that is not
 *   actually blocked.
 *
 *   A span — a trip, a conference, spring break. It starts on one day and ends
 *   on another, so "which day does it belong to" has no single answer.
 *
 * Neither needs a new field. A moment is an event whose end is its start, and a
 * span is one whose end lands on a later date; both already fit `start`/`end`,
 * so nothing had to change in storage, in the database, or in sync. The
 * predicates below are the only place that reading is defined.
 */

/** An event that marks a point in time rather than occupying a range. */
export function isMoment(event: ScheduleEvent): boolean {
  return event.end.getTime() <= event.start.getTime();
}

/** An event that starts on one calendar day and ends on a later one. */
export function isSpan(event: ScheduleEvent): boolean {
  return !isMoment(event) && !sameDay(event.start, dayOf(event.end));
}

/**
 * The last day a span is actually on.
 *
 * An event ending at exactly midnight ends *at the start of* that day, not
 * during it — a trip through the 22nd entered as ending 23rd 00:00 should not
 * put a band on the 23rd.
 */
function dayOf(end: Date): Date {
  const t = end.getTime();
  const midnight = startOfDay(end).getTime();
  return t === midnight ? new Date(t - 1) : end;
}

export interface DayOccurrence {
  /**
   * The event as it appears on this one day, with start and end clipped to it.
   * Keeps the original id: it is the same event, seen through one day.
   */
  event: ScheduleEvent;
  /** The unclipped original, for editing and for describing the whole span. */
  source: ScheduleEvent;
  /** Runs from before this day began. */
  continuesBefore: boolean;
  /** Runs past the end of this day. */
  continuesAfter: boolean;
  /** Covers this whole day, so it is a band rather than a block. */
  allDay: boolean;
  /** A point in time, so it is a marker rather than a block. */
  moment: boolean;
}

/** How `event` appears on `day`, or null when it does not appear at all. */
export function occurrenceOn(event: ScheduleEvent, day: Date): DayOccurrence | null {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();

  if (isMoment(event)) {
    const at = event.start.getTime();
    if (at < from || at >= to) return null;
    return {
      event,
      source: event,
      continuesBefore: false,
      continuesAfter: false,
      allDay: false,
      moment: true,
    };
  }

  const start = event.start.getTime();
  const end = event.end.getTime();
  // Half-open: an event ending at exactly midnight belongs to the day before,
  // the same rule that makes back-to-back classes not overlap.
  if (end <= from || start >= to) return null;

  const clippedStart = Math.max(start, from);
  // A second before midnight, not midnight itself.
  //
  // Everything that positions a block asks for minutes-into-the-day, and
  // midnight is zero minutes into the *next* day — so an event clipped to the
  // exact boundary drew as a stub at the top of the grid instead of running off
  // the bottom of it. Ending a second early is invisible on screen, rounds back
  // to 24:00 wherever the end is reported in minutes, and costs nothing to the
  // conflict and free-time maths.
  const clippedEnd = Math.min(end, to - 1000);

  return {
    event:
      clippedStart === start && clippedEnd === end
        ? event
        : { ...event, start: new Date(clippedStart), end: new Date(clippedEnd) },
    source: event,
    continuesBefore: start < from,
    continuesAfter: end > to,
    allDay: clippedStart === from && clippedEnd >= to - 1000,
    moment: false,
  };
}

/** Everything appearing on `day`, in start order. */
export function occurrencesOn(events: ScheduleEvent[], day: Date): DayOccurrence[] {
  const out: DayOccurrence[] = [];
  for (const event of events) {
    const occurrence = occurrenceOn(event, day);
    if (occurrence) out.push(occurrence);
  }
  return out.sort((a, b) => byStart(a.event, b.event));
}

export interface SplitDay {
  /** Ordinary blocks on the grid. Clipped, so a span's first day ends at midnight. */
  timed: DayOccurrence[];
  /** Bands above the grid: whole-day events, and moments outside grid hours. */
  banner: DayOccurrence[];
  /** Markers drawn on the grid at a single point. */
  moments: DayOccurrence[];
}

/**
 * Sort one day's occurrences into how each should be drawn.
 *
 * A moment outside the visible hours goes to the banner rather than being
 * clamped to the top or bottom edge, where it would sit on a gridline claiming
 * a time it does not have. A 5:30am flight is real information; drawing it at
 * 8:00 because that is where the grid starts is not.
 */
export function splitDay(occurrences: DayOccurrence[]): SplitDay {
  const timed: DayOccurrence[] = [];
  const banner: DayOccurrence[] = [];
  const moments: DayOccurrence[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.allDay) {
      banner.push(occurrence);
    } else if (occurrence.moment) {
      if (withinGridHours(occurrence.event.start)) moments.push(occurrence);
      else banner.push(occurrence);
    } else {
      timed.push(occurrence);
    }
  }

  return { timed, banner, moments };
}

function withinGridHours(at: Date): boolean {
  const hour = at.getHours() + at.getMinutes() / 60;
  return hour >= GRID.startHour && hour <= GRID.endHour;
}

/** Just the clipped events, for the code that only wants ScheduleEvents. */
export function eventsOf(occurrences: DayOccurrence[]): ScheduleEvent[] {
  return occurrences.map((o) => o.event);
}

/**
 * How many days a span covers, counting both ends.
 *
 * Measured in calendar days rather than elapsed hours, because that is the
 * question being asked: a trip from Friday evening to Sunday morning is three
 * days on a calendar and thirty-six hours on a clock.
 */
export function spanDays(event: ScheduleEvent): number {
  if (isMoment(event)) return 1;
  const first = startOfDay(event.start).getTime();
  const last = startOfDay(dayOf(event.end)).getTime();
  return Math.max(1, Math.round((last - first) / 86_400_000) + 1);
}

/** "Aug 20 – 22", or "Aug 30 – Sep 2" when it crosses a month. */
export function describeSpan(event: ScheduleEvent): string {
  const first = event.start;
  const last = dayOf(event.end);
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();

  const left = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const right = sameMonth
    ? String(last.getDate())
    : last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return `${left} – ${right}`;
}

/** Where a span's day sits in it, for "Day 2 of 4". */
export function dayNumberIn(event: ScheduleEvent, day: Date): number {
  const first = startOfDay(event.start).getTime();
  const here = startOfDay(day).getTime();
  return Math.round((here - first) / 86_400_000) + 1;
}
