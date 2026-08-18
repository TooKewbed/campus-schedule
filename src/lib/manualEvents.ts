import { byStart, type EventCategory, type ScheduleEvent } from '../types/event';
import { extractCourseCode } from './categorize';
import { addDays, startOfDay } from './time';

/**
 * Manually entered commitments.
 *
 * A hand-entered class is a weekly recurring series, so it expands into
 * individual occurrences up front. Everything downstream — conflict detection,
 * free-time math, layout — then works on plain ScheduleEvents and never has to
 * reason about recurrence rules.
 */
export interface ManualSeriesInput {
  title: string;
  category: EventCategory;
  /** JS getDay() values: 0 = Sunday ... 6 = Saturday. */
  weekdays: number[];
  startMinutes: number;
  endMinutes: number;
  location?: string;
  /** Last day the series runs. Omitted means "as far as the window allows". */
  until?: Date;
}

/** Returns a human-readable problem, or null when the input is usable. */
export function validateSeries(input: ManualSeriesInput): string | null {
  if (!input.title.trim()) return 'Give it a name.';
  if (input.weekdays.length === 0) return 'Pick at least one day of the week.';
  return validateCore(input);
}

export function expandManualSeries(
  input: ManualSeriesInput,
  rangeStart: Date,
  rangeEnd: Date,
): ScheduleEvent[] {
  const seriesId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const days = new Set(input.weekdays);
  const title = input.title.trim();
  const location = input.location?.trim() || undefined;
  const courseCode = extractCourseCode(title);

  // An explicit end date can only shorten the window, never extend it past
  // what the caller is prepared to hold.
  const stop =
    input.until && startOfDay(input.until) < startOfDay(rangeEnd)
      ? startOfDay(input.until)
      : rangeEnd;

  const events: ScheduleEvent[] = [];
  for (let day = startOfDay(rangeStart); day <= stop; day = addDays(day, 1)) {
    if (!days.has(day.getDay())) continue;

    const start = atMinutes(day, input.startMinutes);
    const end = atMinutes(day, input.endMinutes);
    events.push({
      id: `${seriesId}-${start.getTime()}`,
      seriesId,
      title,
      start,
      end,
      category: input.category,
      location,
      courseCode,
      source: 'manual',
      recurring: true,
    });
  }
  return events;
}

/** One row per manually added series, rebuilt from its expanded occurrences. */
export interface ManualSeries {
  seriesId: string;
  title: string;
  category: EventCategory;
  location?: string;
  weekdays: number[];
  startMinutes: number;
  endMinutes: number;
  occurrences: number;
}

export function summarizeManualSeries(events: ScheduleEvent[]): ManualSeries[] {
  const groups = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    if (event.source !== 'manual' || !event.seriesId) continue;
    const bucket = groups.get(event.seriesId);
    if (bucket) bucket.push(event);
    else groups.set(event.seriesId, [event]);
  }

  const series: ManualSeries[] = [];
  for (const [seriesId, occurrences] of groups) {
    const first = occurrences.reduce((a, b) => (a.start <= b.start ? a : b));
    series.push({
      seriesId,
      title: first.title,
      category: first.category,
      location: first.location,
      weekdays: [...new Set(occurrences.map((e) => e.start.getDay()))].sort(),
      startMinutes: minutesOf(first.start),
      endMinutes: minutesOf(first.end),
      occurrences: occurrences.length,
    });
  }
  return series.sort((a, b) => a.startMinutes - b.startMinutes || a.title.localeCompare(b.title));
}

/** "09:30" from an <input type="time"> to minutes since midnight. */
export function parseTimeInput(value: string): number {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function toTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function atMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * A single, non-repeating commitment on one specific day.
 *
 * Left without a seriesId on purpose: that absence is what tells the delete
 * dialog to offer a plain "Delete" instead of the this-one/all-occurrences
 * choice that only makes sense for a series.
 */
export function createSingleCommitment(
  input: Omit<ManualSeriesInput, 'weekdays'>,
  date: Date,
): ScheduleEvent {
  const title = input.title.trim();
  const start = atMinutes(date, input.startMinutes);

  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    start,
    end: atMinutes(date, input.endMinutes),
    category: input.category,
    location: input.location?.trim() || undefined,
    courseCode: extractCourseCode(title),
    source: 'manual',
    recurring: false,
  };
}

/** Fields an existing commitment can be edited to. */
export interface CommitmentValues {
  title: string;
  category: EventCategory;
  location: string;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Re-time and re-label one occurrence, keeping it on its own date.
 *
 * Applied across a series this moves every occurrence to the new time without
 * touching which days it falls on, which is what "change all" should mean.
 */
export function applyValues(event: ScheduleEvent, values: CommitmentValues): ScheduleEvent {
  const title = values.title.trim();
  const day = startOfDay(event.start);

  return {
    ...event,
    title,
    category: values.category,
    location: values.location.trim() || undefined,
    courseCode: extractCourseCode(title),
    start: atMinutes(day, values.startMinutes),
    end: atMinutes(day, values.endMinutes),
  };
}

/** Minutes since midnight for an existing event, for seeding the edit form. */
export function minutesOfDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** How many occurrences a weekly pattern yields between two dates, inclusive. */
export function countOccurrences(weekdays: number[], from: Date, until: Date): number {
  const days = new Set(weekdays);
  const stop = startOfDay(until);
  let count = 0;
  for (let day = startOfDay(from); day <= stop; day = addDays(day, 1)) {
    if (days.has(day.getDay())) count++;
  }
  return count;
}

/** The last day a series actually runs, from its expanded occurrences. */
export function seriesEndDate(events: ScheduleEvent[], seriesId: string): Date | null {
  let latest: Date | null = null;
  for (const e of events) {
    if (e.seriesId !== seriesId) continue;
    if (!latest || e.start > latest) latest = e.start;
  }
  return latest ? startOfDay(latest) : null;
}

/** Checks that apply whether or not the commitment repeats. */
function validateCore(input: {
  title: string;
  startMinutes: number;
  endMinutes: number;
}): string | null {
  if (!input.title.trim()) return 'Give it a name.';
  if (input.endMinutes <= input.startMinutes) return 'The end time must be after the start time.';
  return null;
}

/** A one-off commitment on a specific date — a final, a doctor's appointment. */
export function validateOnce(input: Omit<ManualSeriesInput, 'weekdays'>): string | null {
  return validateCore(input);
}

/**
 * One-off commitments, for listing beside the recurring ones.
 *
 * The absence of a seriesId is what makes an event a one-off, which is the same
 * signal the delete dialog uses to decide whether to offer "this occurrence or
 * the whole series".
 */
export function singleCommitments(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => e.source === 'manual' && !e.seriesId).sort(byStart);
}

/* --------------------------------------------------- grouping for display -- */

/**
 * One commitment as it appears on one day.
 *
 * A weekly series meeting Mon/Wed/Fri produces three of these, one per day,
 * because the question the list answers is "what do I have on Wednesday" —
 * not "what series exist".
 */
export interface DayCommitment {
  /** Unique per row; a series appears on several days so its id is not. */
  key: string;
  title: string;
  category: EventCategory;
  location?: string;
  startMinutes: number;
  endMinutes: number;
  /** Set only for one-offs, which belong to a date rather than a weekday. */
  date?: Date;
  /** Whichever of these is set decides what deleting the row removes. */
  seriesId?: string;
  eventId?: string;
}

/**
 * Commitments arranged by day of the week, indexed by getDay().
 *
 * Always seven entries, including empty ones, so callers index by weekday
 * rather than having to search — and so a day with nothing on it is a fact the
 * caller can choose to show rather than one it has to infer.
 */
export function groupByWeekday(
  series: ManualSeries[],
  singles: ScheduleEvent[],
): DayCommitment[][] {
  const days: DayCommitment[][] = Array.from({ length: 7 }, () => []);

  for (const s of series) {
    for (const weekday of s.weekdays) {
      if (weekday < 0 || weekday > 6) continue;
      days[weekday].push({
        key: `${s.seriesId}-${weekday}`,
        title: s.title,
        category: s.category,
        location: s.location,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        seriesId: s.seriesId,
      });
    }
  }

  for (const event of singles) {
    days[event.start.getDay()].push({
      key: event.id,
      title: event.title,
      category: event.category,
      location: event.location,
      startMinutes: minutesOfDate(event.start),
      endMinutes: minutesOfDate(event.end),
      date: event.start,
      eventId: event.id,
    });
  }

  // Earliest first, then by name so two things at the same hour hold a stable
  // order instead of shuffling between renders.
  for (const day of days) {
    day.sort((a, b) => a.startMinutes - b.startMinutes || a.title.localeCompare(b.title));
  }
  return days;
}
