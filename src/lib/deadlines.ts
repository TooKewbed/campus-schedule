import type { Task } from '../types/task';
import { sameDay, startOfDay, toISODate } from './time';

/**
 * Deadlines on to-do items, and what a deadline means as you approach it.
 *
 * The wording and the grouping live here rather than in the component for the
 * same reason the day brief does: phrasing around dates goes wrong at the
 * edges — a deadline an hour ago, one at midnight tonight, one that has been
 * sitting there a week — and those cases are worth asserting on rather than
 * catching by noticing them later.
 */

export type Urgency = 'overdue' | 'today' | 'soon' | 'later';

/**
 * A deadline given as a date alone means the end of that day.
 *
 * "Due Friday" does not mean Friday at midnight-as-it-begins, which is what a
 * bare date would produce and would mark the task overdue for the whole of the
 * day it is actually due.
 */
export const DUE_HOUR = 23;
export const DUE_MINUTE = 59;

export function endOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(DUE_HOUR, DUE_MINUTE, 0, 0);
  return out;
}

/** Whether a deadline carries a real time, or just names a day. */
export function isEndOfDay(date: Date): boolean {
  return date.getHours() === DUE_HOUR && date.getMinutes() === DUE_MINUTE;
}

/** Today, end of day — what the clock button assigns on first press. */
export function defaultDeadline(now: Date): Date {
  return endOfDay(now);
}

export interface Deadline {
  label: string;
  urgency: Urgency;
  /** Long form for a tooltip and for screen readers. */
  full: string;
}

export function describeDeadline(due: Date, now: Date): Deadline {
  const urgency = urgencyOf(due, now);
  const time = isEndOfDay(due) ? '' : `, ${formatClock(due)}`;

  if (urgency === 'overdue') {
    // How late matters more than when: a thing due at nine this morning and a
    // thing due last Tuesday need different reactions.
    const days = wholeDaysBetween(startOfDay(due), startOfDay(now));
    const label =
      days === 0 ? 'Overdue' : days === 1 ? '1 day late' : `${days} days late`;
    return { label, urgency, full: `Was due ${longForm(due)}` };
  }

  if (sameDay(due, now)) {
    return { label: `Today${time}`, urgency, full: `Due today${time}` };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(due, tomorrow)) {
    return { label: `Tomorrow${time}`, urgency, full: `Due tomorrow${time}` };
  }

  // Inside the coming week a weekday name is the most readable form; past that
  // it stops being unambiguous and a date is clearer.
  const days = wholeDaysBetween(startOfDay(now), startOfDay(due));
  if (days < 7) {
    const weekday = due.toLocaleDateString(undefined, { weekday: 'long' });
    return { label: `${weekday}${time}`, urgency, full: `Due ${weekday}${time}` };
  }

  const date = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label: `${date}${time}`, urgency, full: `Due ${longForm(due)}` };
}

function urgencyOf(due: Date, now: Date): Urgency {
  if (due.getTime() < now.getTime()) return 'overdue';
  if (sameDay(due, now)) return 'today';

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(due, tomorrow)) return 'soon';

  return 'later';
}

function longForm(due: Date): string {
  const date = due.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return isEndOfDay(due) ? date : `${date} at ${formatClock(due)}`;
}

function formatClock(date: Date): string {
  return date
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, ' ');
}

/**
 * Whole days between two local midnights, via UTC.
 *
 * Subtracting local timestamps is an hour out across a daylight-saving
 * boundary, which rounds to the wrong number of days exactly when a deadline
 * is a week or so away.
 */
function wholeDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/* ---------------------------------------------------------------- groups -- */

export interface TaskGroups {
  /** Open, with a deadline. Soonest first. */
  timed: Task[];
  /** Open, no deadline. In the order they were added. */
  anytime: Task[];
  /** Finished, most recently first, whether or not they had a deadline. */
  done: Task[];
}

/**
 * The list, split into its three sections.
 *
 * A finished task leaves the time-sensitive section entirely rather than
 * sitting at the top of it struck through — the section exists to answer "what
 * is coming at me", and something already done is not coming at you.
 */
export function groupTasks(tasks: Task[]): TaskGroups {
  const timed: Task[] = [];
  const anytime: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks) {
    if (task.done) done.push(task);
    else if (task.dueDate) timed.push(task);
    else anytime.push(task);
  }

  timed.sort(
    (a, b) =>
      a.dueDate!.getTime() - b.dueDate!.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  anytime.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  done.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  return { timed, anytime, done };
}

/** How many open deadlines are already past. */
export function overdueCount(tasks: Task[], now: Date): number {
  return tasks.reduce(
    (n, t) => n + (!t.done && t.dueDate && t.dueDate.getTime() < now.getTime() ? 1 : 0),
    0,
  );
}

/* ----------------------------------------------------------- form fields -- */

/** A deadline split into the two inputs the editor shows. */
export function toDueParts(due: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: toISODate(due),
    time: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
  };
}

/**
 * The two inputs back into one moment.
 *
 * Built from parts rather than parsed from a combined string: `new Date(iso)`
 * reads a bare date as UTC midnight, which lands a deadline on the previous day
 * anywhere west of Greenwich.
 */
export function fromDueParts(date: string, time: string): Date | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;

  const [h, min] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(min)) {
    return new Date(y, m - 1, d, DUE_HOUR, DUE_MINUTE);
  }
  return new Date(y, m - 1, d, h, min);
}
