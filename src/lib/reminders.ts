import type { Task } from '../types/task';
import { describeDeadline, isEndOfDay } from './deadlines';
import { toISODate } from './time';

/**
 * Deciding what to remind someone about.
 *
 * Kept separate from actually showing a notification so the rules can be
 * tested. The rules are the part that matters: a reminder that fires twice, or
 * fires at 3am, or fires again every time the page is refreshed, is worse than
 * no reminder at all — people switch those off and never switch them back on.
 *
 * What this cannot do: reach you when the app is closed. Real push needs a
 * service worker and a server holding a subscription, which this app has
 * neither of. Reminders fire while Skedge is open in a tab, and the app says so
 * rather than letting someone find out by missing a deadline.
 */

export type ReminderKind = 'soon' | 'today' | 'overdue';

export interface Reminder {
  /** Identity for de-duplication; stable across reloads. */
  key: string;
  taskId: string;
  kind: ReminderKind;
  title: string;
  body: string;
}

/** A deadline this close is worth interrupting someone for. */
export const SOON_MINUTES = 60;

/**
 * Nothing fires before this hour.
 *
 * A tab left open overnight should not announce at 4am that something is due
 * today. The day's reminders wait until the day has plausibly started.
 */
export const QUIET_UNTIL_HOUR = 7;

export interface ReminderSettings {
  enabled: boolean;
  /** Keys already delivered, so a refresh does not repeat them. */
  sent: string[];
}

export function pendingReminders(tasks: Task[], now: Date, sent: string[]): Reminder[] {
  if (now.getHours() < QUIET_UNTIL_HOUR) return [];

  const already = new Set(sent);
  const today = toISODate(now);
  const out: Reminder[] = [];

  for (const task of tasks) {
    if (task.done || !task.dueDate) continue;

    const kind = kindFor(task.dueDate, now);
    if (!kind) continue;

    // One of each kind per task per day: a task due today that then goes
    // overdue gets two reminders, which is right, but not two of the same.
    const key = `${task.id}|${kind}|${today}`;
    if (already.has(key)) continue;

    out.push({ key, taskId: task.id, kind, ...wording(task, kind, now) });
  }

  return out;
}

function kindFor(due: Date, now: Date): ReminderKind | null {
  const minutes = (due.getTime() - now.getTime()) / 60000;

  if (minutes < 0) return 'overdue';
  if (minutes <= SOON_MINUTES) return 'soon';

  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();

  // A deadline that is just "end of today" is a day-shaped thing, so it gets
  // the morning heads-up rather than a countdown an hour before midnight.
  return sameDay ? 'today' : null;
}

function wording(task: Task, kind: ReminderKind, now: Date): { title: string; body: string } {
  const course = task.courseCode ? `${task.courseCode} · ` : '';
  const deadline = task.dueDate ? describeDeadline(task.dueDate, now) : null;

  if (kind === 'overdue') {
    return { title: `Overdue: ${task.title}`, body: `${course}${deadline?.full ?? ''}` };
  }

  if (kind === 'soon') {
    const minutes = Math.max(1, Math.round((task.dueDate!.getTime() - now.getTime()) / 60000));
    return { title: `Due in ${minutes}m: ${task.title}`, body: `${course}${deadline?.full ?? ''}` };
  }

  return {
    title: `Due today: ${task.title}`,
    body: task.dueDate && !isEndOfDay(task.dueDate) ? `${course}${deadline?.full}` : `${course}By the end of today`,
  };
}

/**
 * Forget delivered keys once their day has passed.
 *
 * Without this the list grows for as long as the app is used and is written to
 * local storage on every change. Two days is enough to cover a tab left open
 * across midnight.
 */
export function pruneSent(sent: string[], now: Date): string[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 2);
  const oldest = toISODate(cutoff);

  return sent.filter((key) => {
    const day = key.split('|')[2];
    return day !== undefined && day >= oldest;
  });
}

/** A one-line summary for the app itself, which works with no permission at all. */
export function summarize(tasks: Task[], now: Date): string | null {
  let overdue = 0;
  let today = 0;

  for (const task of tasks) {
    if (task.done || !task.dueDate) continue;
    if (task.dueDate.getTime() < now.getTime()) overdue++;
    else if (
      task.dueDate.getFullYear() === now.getFullYear() &&
      task.dueDate.getMonth() === now.getMonth() &&
      task.dueDate.getDate() === now.getDate()
    ) {
      today++;
    }
  }

  if (overdue === 0 && today === 0) return null;

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (today > 0) parts.push(`${today} due today`);
  return parts.join(' · ');
}
