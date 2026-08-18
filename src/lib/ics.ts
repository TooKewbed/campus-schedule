import ICAL from 'ical.js';
import type { ScheduleEvent } from '../types/event';
import { extractCourseCode, inferCategory } from './categorize';

export interface ImportResult {
  events: ScheduleEvent[];
  /** Non-fatal problems worth showing the user rather than swallowing. */
  warnings: string[];
  /** How many VEVENTs were in the file, before recurrence expansion. */
  sourceEventCount: number;
}

export interface ImportOptions {
  /** Recurring events are expanded only within this window. */
  rangeStart: Date;
  rangeEnd: Date;
}

/** Safety valve for a malformed or absurd RRULE (e.g. FREQ=SECONDLY, no COUNT). */
const MAX_OCCURRENCES_PER_SERIES = 500;

export function parseIcs(text: string, options: ImportOptions): ImportResult {
  const warnings: string[] = [];
  const root = readCalendar(text);

  registerTimezones(root, warnings);

  const vevents =
    root.name === 'vevent' ? [root] : root.getAllSubcomponents('vevent');

  if (vevents.length === 0) {
    throw new Error('No calendar events found in this file.');
  }

  // A recurrence exception (a moved or cancelled single occurrence) is its own
  // VEVENT carrying RECURRENCE-ID. It must be attached to its master rather
  // than imported as a standalone duplicate.
  const masters: ICAL.Component[] = [];
  const exceptions: ICAL.Component[] = [];
  for (const vevent of vevents) {
    (vevent.getFirstPropertyValue('recurrence-id') ? exceptions : masters).push(
      vevent,
    );
  }

  const events: ScheduleEvent[] = [];
  for (const vevent of masters) {
    try {
      events.push(...expandEvent(vevent, exceptions, options, warnings));
    } catch (error) {
      warnings.push(
        `Skipped "${vevent.getFirstPropertyValue('summary') ?? 'untitled event'}": ${message(error)}`,
      );
    }
  }

  return { events, warnings, sourceEventCount: vevents.length };
}

function readCalendar(text: string): ICAL.Component {
  try {
    return new ICAL.Component(ICAL.parse(text));
  } catch (error) {
    throw new Error(`This doesn't look like a valid .ics file — ${message(error)}`);
  }
}

/**
 * Registering the file's own VTIMEZONE blocks is what makes a registrar export
 * land on the right hour. Without it, a TZID ical.js doesn't recognize falls
 * back to UTC and every class shifts.
 */
function registerTimezones(root: ICAL.Component, warnings: string[]): void {
  for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
    try {
      const timezone = new ICAL.Timezone(vtimezone);
      if (!ICAL.TimezoneService.has(timezone.tzid)) {
        ICAL.TimezoneService.register(timezone);
      }
    } catch (error) {
      warnings.push(`Ignored an unreadable timezone block — ${message(error)}`);
    }
  }
}

function expandEvent(
  vevent: ICAL.Component,
  allExceptions: ICAL.Component[],
  options: ImportOptions,
  warnings: string[],
): ScheduleEvent[] {
  const uid = String(vevent.getFirstPropertyValue('uid') ?? '');
  const related = allExceptions.filter(
    (ex) => String(ex.getFirstPropertyValue('uid') ?? '') === uid,
  );

  const icalEvent = new ICAL.Event(vevent, {
    exceptions: related,
    strictExceptions: false,
  });

  const base = describe(icalEvent, vevent);

  if (!icalEvent.isRecurring()) {
    const start = icalEvent.startDate.toJSDate();
    const end = icalEvent.endDate.toJSDate();
    return [
      {
        ...base,
        id: uid || `${base.title}-${start.getTime()}`,
        start,
        end,
        recurring: false,
      },
    ];
  }

  const occurrences: ScheduleEvent[] = [];
  const iterator = icalEvent.iterator();
  const rangeStart = options.rangeStart.getTime();
  const rangeEnd = options.rangeEnd.getTime();

  let next: ICAL.Time | null;
  let guard = 0;
  while ((next = iterator.next())) {
    if (++guard > MAX_OCCURRENCES_PER_SERIES) {
      warnings.push(
        `"${base.title}" repeats more often than expected; showing the first ${MAX_OCCURRENCES_PER_SERIES} occurrences.`,
      );
      break;
    }

    const startMs = next.toJSDate().getTime();
    if (startMs > rangeEnd) break;

    // getOccurrenceDetails applies any RECURRENCE-ID override for this instance.
    const details = icalEvent.getOccurrenceDetails(next);
    const start = details.startDate.toJSDate();
    const end = details.endDate.toJSDate();
    if (end.getTime() < rangeStart) continue;

    occurrences.push({
      ...base,
      id: `${uid}-${start.getTime()}`,
      seriesId: uid || base.title,
      start,
      end,
      recurring: true,
    });
  }

  return occurrences;
}

type EventDescription = Omit<ScheduleEvent, 'id' | 'start' | 'end' | 'recurring'>;

function describe(
  icalEvent: ICAL.Event,
  vevent: ICAL.Component,
): EventDescription {
  const title = (icalEvent.summary || 'Untitled').trim();
  const description = (icalEvent.description || '').trim();
  const location = (icalEvent.location || '').trim();

  const categories = vevent
    .getAllProperties('categories')
    .flatMap((property) => property.getValues().map(String));

  return {
    title,
    category: inferCategory(title, description, categories),
    location: location || undefined,
    courseCode: extractCourseCode(title),
    description: description || undefined,
    source: 'ics',
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
