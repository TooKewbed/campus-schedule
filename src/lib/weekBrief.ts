import { isFixed, type ScheduleEvent } from '../types/event';
import type { DayMarker } from '../types/dayMarker';
import { detectConflicts } from './conflicts';
import { markerKind } from './dateKind';
import { addDays, formatDuration, sameDay } from './time';
import { GRID } from './layout';
import type { BriefTone } from './dayBrief';

/**
 * The week in one line.
 *
 * The day brief answers "what am I walking into today". Opened on the week
 * view, that is the wrong question — the whole point of looking at a week is to
 * see its shape — so the week gets its own sentence rather than the day's one
 * sitting above seven columns it does not describe.
 *
 * Same three tones as the day brief, and the same rule about which one wins: a
 * clash is the only thing here that needs acting on rather than merely knowing.
 */

export interface WeekBrief {
  tone: BriefTone;
  headline: string;
  detail: string;
  facts: string[];
}

export interface WeekBriefInput {
  /** The whole schedule; this picks out the week it needs. */
  events: ScheduleEvent[];
  /** Sunday of the week being described. */
  weekStart: Date;
  markers: DayMarker[];
  today: Date;
}

/** Hours in a day the grid actually covers, for the free-time figure. */
const DAY_HOURS = GRID.endHour - GRID.startHour;

/** Above this many fixed commitments in a week, it is a heavy one. */
const BUSY_WEEK = 20;

export function buildWeekBrief({
  events,
  weekStart,
  markers,
  today,
}: WeekBriefInput): WeekBrief {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayEvents = events.filter((e) => sameDay(e.start, date) && e.start < e.end);
    return {
      date,
      events: dayEvents,
      fixed: dayEvents.filter(isFixed),
      conflicts: detectConflicts(dayEvents),
      markers: markers.filter(
        (m) =>
          m.month === date.getMonth() + 1 &&
          m.day === date.getDate() &&
          (m.year === null || m.year === date.getFullYear()),
      ),
    };
  });

  const totalFixed = days.reduce((n, d) => n + d.fixed.length, 0);
  const conflictDays = days.filter((d) => d.conflicts.length > 0);
  const conflictCount = days.reduce((n, d) => n + d.conflicts.length, 0);

  // Holidays are generated rather than entered, so they do not count as
  // "things you put in the calendar because they matter".
  const realMarkers = days.flatMap((d) => d.markers.filter((m) => m.source !== 'holiday'));
  const exams = realMarkers.filter((m) => markerKind(m) === 'exam');

  const busiest = days.reduce((a, b) => (b.fixed.length > a.fixed.length ? b : a), days[0]);
  const freeMinutes = days.reduce(
    (n, d) => n + Math.max(0, DAY_HOURS * 60 - bookedMinutes(d.fixed)),
    0,
  );

  const tone: BriefTone =
    conflictCount > 0 ? 'warn' : totalFixed >= BUSY_WEEK ? 'busy' : 'calm';

  return {
    tone,
    ...phrasing({ totalFixed, conflictDays, conflictCount, exams, busiest, today }),
    facts: buildFacts(totalFixed, freeMinutes, realMarkers.length, conflictCount),
  };
}

/** Minutes a day's fixed events occupy, overlaps counted once. */
function bookedMinutes(events: ScheduleEvent[]): number {
  const spans = events
    .map((e) => [e.start.getTime(), e.end.getTime()] as const)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let cursor = -Infinity;
  for (const [start, end] of spans) {
    // Two classes double-booked at nine do not consume two hours of the day.
    const from = Math.max(start, cursor);
    if (end > from) {
      total += (end - from) / 60000;
      cursor = end;
    }
  }
  return total;
}

interface PhrasingInput {
  totalFixed: number;
  conflictDays: { date: Date }[];
  conflictCount: number;
  exams: DayMarker[];
  busiest: { date: Date; fixed: ScheduleEvent[] };
  today: Date;
}

function phrasing({
  totalFixed,
  conflictDays,
  conflictCount,
  exams,
  busiest,
  today,
}: PhrasingInput): { headline: string; detail: string } {
  if (conflictCount > 0) {
    const where = conflictDays.map((d) => weekdayName(d.date)).join(' and ');
    return {
      headline:
        conflictCount === 1 ? 'One clash this week' : `${conflictCount} clashes this week`,
      detail: `Double-booked on ${where}`,
    };
  }

  if (totalFixed === 0) {
    return {
      headline: 'Nothing scheduled this week',
      detail: 'No classes or commitments on any day.',
    };
  }

  // An exam outranks how busy the week is: it is the thing that changes how
  // the rest of the week should be spent.
  if (exams.length > 0) {
    const first = exams[0];
    return {
      headline: exams.length === 1 ? 'An exam this week' : `${exams.length} exams this week`,
      detail: first.title,
    };
  }

  const heaviest = busiest.fixed.length;
  return {
    headline: `${totalFixed} commitment${totalFixed === 1 ? '' : 's'} this week`,
    detail:
      heaviest > 0
        ? `${weekdayName(busiest.date, today)} is the heaviest, with ${heaviest}`
        : '',
  };
}

/** "Wednesday", or "Today" when it is. */
function weekdayName(date: Date, today?: Date): string {
  if (today && sameDay(date, today)) return 'Today';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

function buildFacts(
  totalFixed: number,
  freeMinutes: number,
  markerCount: number,
  conflictCount: number,
): string[] {
  const facts: string[] = [];

  if (totalFixed > 0) {
    facts.push(`${totalFixed} commitment${totalFixed === 1 ? '' : 's'}`);
  }
  if (freeMinutes > 0) facts.push(`${formatDuration(freeMinutes)} free`);
  if (markerCount > 0) {
    facts.push(`${markerCount} important date${markerCount === 1 ? '' : 's'}`);
  }
  if (conflictCount > 0) {
    facts.push(`${conflictCount} clash${conflictCount === 1 ? '' : 'es'}`);
  }

  return facts;
}
