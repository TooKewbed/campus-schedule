import type { ScheduleEvent } from '../types/event';
import type { Conflict } from './conflicts';
import { currentFixedEvent, nextFixedEvent, totalFreeMinutes, type FreeWindow } from './freeTime';
import { formatDuration, formatTime } from './time';

/**
 * The sentence at the top of a day.
 *
 * The grid answers "what is at 2pm". This answers the question actually being
 * asked on opening the app, which is "what am I walking into" — one line that
 * makes the day legible before any of it is read in detail.
 *
 * Written as data rather than JSX so the wording can be tested. Phrasing that
 * only ever gets checked by looking at it drifts into being wrong at the edges:
 * an event that ended a minute ago, a day with nothing on it, midnight.
 */

export type BriefTone = 'calm' | 'busy' | 'warn';

export interface Brief {
  tone: BriefTone;
  /** The one thing worth knowing. */
  headline: string;
  /** Supporting line under it; empty when the headline says everything. */
  detail: string;
  /** Short facts, rendered as chips. */
  facts: string[];
}

export interface BriefInput {
  /** Events on the day being shown, not the whole schedule. */
  events: ScheduleEvent[];
  conflicts: Conflict[];
  freeWindows: FreeWindow[];
  /** All-day markers on this day, holidays included. */
  markerCount: number;
  openTasks: number;
  now: Date;
  isToday: boolean;
}

/** Inside this, the next thing is imminent enough to count down to. */
const SOON_MINUTES = 90;

export function buildBrief(input: BriefInput): Brief {
  const { events, conflicts, freeWindows, markerCount, openTasks, now, isToday } = input;

  const fixed = events.filter((e) => e.start < e.end).sort((a, b) => +a.start - +b.start);
  const tone: BriefTone = conflicts.length > 0 ? 'warn' : fixed.length >= 5 ? 'busy' : 'calm';

  return {
    tone,
    ...phrasing(fixed, conflicts, now, isToday),
    facts: buildFacts(fixed, freeWindows, markerCount, openTasks),
  };
}

function phrasing(
  events: ScheduleEvent[],
  conflicts: Conflict[],
  now: Date,
  isToday: boolean,
): { headline: string; detail: string } {
  // A double-booking outranks everything else: it is the only thing here that
  // needs doing something about rather than merely knowing.
  if (conflicts.length > 0) {
    const first = conflicts[0];
    return {
      headline: conflicts.length === 1 ? 'Two things overlap' : `${conflicts.length} overlaps`,
      detail: `${first.a.title} and ${first.b.title} at ${formatTime(first.a.start)}`,
    };
  }

  if (events.length === 0) {
    return {
      headline: isToday ? 'Nothing scheduled today' : 'Nothing scheduled',
      detail: 'The whole day is yours.',
    };
  }

  const first = events[0];
  const last = events[events.length - 1];

  // A day that is not today has no "now" to speak from, so it is described
  // rather than narrated.
  if (!isToday) {
    return {
      headline: `${events.length} commitment${events.length === 1 ? '' : 's'}`,
      detail: `${formatTime(first.start)} to ${formatTime(last.end)}`,
    };
  }

  const current = currentFixedEvent(events, now);
  if (current) {
    return {
      headline: `${current.title} until ${formatTime(current.end)}`,
      detail: describeAfter(events, now),
    };
  }

  const next = nextFixedEvent(events, now);
  if (!next) {
    return {
      headline: 'Nothing left today',
      detail: `${events.length} done, finishing at ${formatTime(last.end)}.`,
    };
  }

  const minutes = Math.round((next.start.getTime() - now.getTime()) / 60000);
  if (minutes <= SOON_MINUTES) {
    return {
      headline: `${next.title} in ${formatDuration(Math.max(minutes, 1))}`,
      detail: `Starts ${formatTime(next.start)}${next.location ? ` · ${next.location}` : ''}`,
    };
  }

  return {
    headline: `Free until ${formatTime(next.start)}`,
    detail: `Then ${next.title}${next.location ? ` · ${next.location}` : ''}`,
  };
}

/** What follows the thing currently happening. */
function describeAfter(events: ScheduleEvent[], now: Date): string {
  const current = currentFixedEvent(events, now);
  const after = current ? nextFixedEvent(events, current.end) : undefined;
  if (!after) return 'Last one of the day.';
  return `Then ${after.title} at ${formatTime(after.start)}`;
}

function buildFacts(
  events: ScheduleEvent[],
  freeWindows: FreeWindow[],
  markerCount: number,
  openTasks: number,
): string[] {
  const facts: string[] = [];

  if (events.length > 0) {
    facts.push(`${events.length} commitment${events.length === 1 ? '' : 's'}`);
  }

  const free = totalFreeMinutes(freeWindows);
  if (free > 0) facts.push(`${formatDuration(free)} free`);

  if (markerCount > 0) {
    facts.push(`${markerCount} important date${markerCount === 1 ? '' : 's'}`);
  }

  if (openTasks > 0) facts.push(`${openTasks} task${openTasks === 1 ? '' : 's'} open`);

  return facts;
}
