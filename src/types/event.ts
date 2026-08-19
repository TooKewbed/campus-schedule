/**
 * The event model. Everything else in the app is a view over this.
 *
 * The central decision: an event's *category* is stored, and whether it blocks
 * time (`kind`) is derived from the category via one table below. Storing both
 * would let them drift — an event tagged "office hours" but flagged fixed would
 * silently produce a phantom conflict. One table, one source of truth.
 */

/** Does this event consume the student's time, or is it merely available? */
export type EventKind = 'fixed' | 'flexible';

export type EventCategory =
  // fixed — blocks time, can produce a real conflict
  | 'class'
  | 'lab'
  | 'exam'
  | 'work'
  | 'appointment'
  // flexible — optional/available, renders in its own lane, never a conflict
  | 'office-hours'
  | 'study'
  | 'tutoring';

/**
 * The one table that decides what blocks time. Adding a category forces a
 * decision here rather than letting it default to something surprising.
 */
export const CATEGORY_KIND: Record<EventCategory, EventKind> = {
  class: 'fixed',
  lab: 'fixed',
  exam: 'fixed',
  work: 'fixed',
  appointment: 'fixed',
  'office-hours': 'flexible',
  study: 'flexible',
  tutoring: 'flexible',
};

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  class: 'Class',
  lab: 'Lab',
  exam: 'Exam',
  work: 'Work',
  appointment: 'Appointment',
  'office-hours': 'Office hours',
  study: 'Study',
  tutoring: 'Tutoring',
};

/**
 * Palette slots, defined once in styles.css and usable on any block.
 *
 * Lives here rather than in lib/colors so an event can name its own colour
 * without the type module depending on the module that derives one.
 */
export type ColorName = 'blue' | 'orange' | 'violet' | 'green' | 'aqua' | 'yellow' | 'exam';

export const COLOR_NAMES: ColorName[] = [
  'blue', 'violet', 'aqua', 'green', 'yellow', 'orange', 'exam',
];

/** What each slot is called when a person has to choose one. */
export const COLOR_LABEL: Record<ColorName, string> = {
  blue: 'Blue',
  violet: 'Indigo',
  aqua: 'Teal',
  green: 'Green',
  yellow: 'Yellow',
  orange: 'Purple',
  exam: 'Red',
};

export interface ScheduleEvent {
  /** Unique per occurrence. Recurring events expand to many ids, one seriesId. */
  id: string;
  title: string;
  start: Date;
  /** Exclusive. An event ending at 09:50 does not overlap one starting at 09:50. */
  end: Date;
  category: EventCategory;
  location?: string;
  /** e.g. "CHEM 101", parsed out of the summary when it looks like a course code. */
  courseCode?: string;
  description?: string;
  /**
   * Everything is hand-entered now. 'ics' is retained only so events saved by
   * an earlier build, when calendar import existed, still load and render
   * rather than being silently dropped on read.
   */
  source: 'ics' | 'manual';
  /**
   * A colour chosen by hand. Absent means the automatic one, derived from the
   * course code so every meeting of a course matches without being told to.
   */
  color?: ColorName;
  /** Shared by every occurrence expanded from one recurring VEVENT. */
  seriesId?: string;
  /** True when this occurrence came from expanding an RRULE. */
  recurring: boolean;
}

export function kindOf(event: ScheduleEvent): EventKind {
  return CATEGORY_KIND[event.category];
}

export function isFixed(event: ScheduleEvent): boolean {
  return kindOf(event) === 'fixed';
}

export function isFlexible(event: ScheduleEvent): boolean {
  return kindOf(event) === 'flexible';
}

export function durationMinutes(event: ScheduleEvent): number {
  return Math.round((event.end.getTime() - event.start.getTime()) / 60000);
}

export function byStart(a: ScheduleEvent, b: ScheduleEvent): number {
  return a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime();
}
