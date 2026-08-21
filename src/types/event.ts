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
  /** A type the person typed in themselves; the words live in `categoryLabel`. */
  | 'other'
  // flexible — optional/available, renders in its own lane, never a conflict
  | 'office-hours'
  | 'study'
  | 'tutoring'
  /** The same, but for something optional. */
  | 'other-flexible';

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
  other: 'fixed',
  'office-hours': 'flexible',
  study: 'flexible',
  tutoring: 'flexible',
  'other-flexible': 'flexible',
};

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  class: 'Class',
  lab: 'Lab',
  exam: 'Exam',
  work: 'Work',
  appointment: 'Appointment',
  other: 'Other',
  'office-hours': 'Office hours',
  study: 'Study',
  tutoring: 'Tutoring',
  'other-flexible': 'Other',
};

/**
 * A cap on the typed type name.
 *
 * It is drawn in the commitment list beside a title that has its own limit,
 * and it travels to the database on every occurrence of a series. Long enough
 * for anything anyone would actually call a commitment, short enough that it
 * cannot become a paragraph pasted in by accident.
 */
export const MAX_CATEGORY_LABEL = 40;

/**
 * Categories whose real name the person writes in themselves.
 *
 * There are two rather than one because the fixed/flexible split is the whole
 * point of the category: a custom type still has to say whether it blocks
 * time, and the dropdown already groups by exactly that. Deriving the kind
 * from a stored flag instead would put a second source of truth next to the
 * table above, which is the drift this file exists to prevent.
 */
export function isOtherCategory(category: EventCategory): boolean {
  return category === 'other' || category === 'other-flexible';
}

/** What to call this event's type in the interface. */
export function categoryNameOf(
  event: Pick<ScheduleEvent, 'category' | 'categoryLabel'>,
): string {
  return event.categoryLabel?.trim() || CATEGORY_LABEL[event.category];
}

export function isCategory(value: unknown): value is EventCategory {
  // hasOwn, not `in`: `in` walks the prototype chain, so "toString" and
  // "constructor" would both answer yes and then have no kind to look up.
  return typeof value === 'string' && Object.hasOwn(CATEGORY_KIND, value);
}

/**
 * A category read back from storage or the network, made safe.
 *
 * An unrecognised one — written by a newer build, or corrupted — has no entry
 * in the kind table, so it is neither fixed nor flexible and the event
 * silently appears in neither lane. Falling back to 'other' keeps it on the
 * grid, where it can be seen and fixed, instead of vanishing.
 */
export function toCategory(value: unknown): EventCategory {
  return isCategory(value) ? value : 'other';
}

/**
 * Palette slots, defined once in styles.css and usable on any block.
 *
 * Lives here rather than in lib/colors so an event can name its own colour
 * without the type module depending on the module that derives one.
 *
 * 'exam' is the red slot. The name is a leftover from when the palette was
 * keyed to categories rather than to colours, and it is kept because it is
 * the value already written on saved events and in the database — renaming
 * it would silently repaint every exam anyone has ever coloured.
 */
export type ColorName =
  | 'exam'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'magenta'
  | 'pink';

/**
 * Spectrum order — red through violet, the way a rainbow runs.
 *
 * This is the order the picker draws them in, and the order is the point: a
 * row of swatches sorted by hue can be scanned for "the green one" without
 * reading anything, where an arbitrary order has to be searched. Adding a
 * colour means putting it at its wavelength, not on the end.
 */
export const COLOR_NAMES: ColorName[] = [
  'exam',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'aqua',
  'blue',
  'indigo',
  'violet',
  'magenta',
  'pink',
];

/** What each slot is called when a person has to choose one. */
export const COLOR_LABEL: Record<ColorName, string> = {
  exam: 'Red',
  orange: 'Orange',
  amber: 'Amber',
  yellow: 'Yellow',
  lime: 'Lime',
  green: 'Green',
  aqua: 'Aqua',
  blue: 'Blue',
  indigo: 'Indigo',
  violet: 'Violet',
  magenta: 'Magenta',
  pink: 'Pink',
};

/** A colour name written by an older or newer build, made safe on read. */
export function isColorName(value: unknown): value is ColorName {
  return typeof value === 'string' && (COLOR_NAMES as string[]).includes(value);
}

export interface ScheduleEvent {
  /** Unique per occurrence. Recurring events expand to many ids, one seriesId. */
  id: string;
  title: string;
  start: Date;
  /** Exclusive. An event ending at 09:50 does not overlap one starting at 09:50. */
  end: Date;
  category: EventCategory;
  /**
   * The words typed for an 'other' category — "Band practice", "Physio".
   *
   * Only meaningful alongside one of the two 'other' categories, and cleared
   * when the type changes away from them, so a label can never linger behind a
   * built-in category and reappear later.
   */
  categoryLabel?: string;
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
