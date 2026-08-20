import type { Task } from '../types/task';

/**
 * Tasks that come back.
 *
 * A weekly reading or a Friday problem set is the same job every week, and
 * retyping it every week is how a to-do list stops being used. A repeat is
 * always attached to a deadline — "repeats weekly" means nothing without a
 * first date to repeat from — so the control lives with the deadline editor
 * rather than somewhere else.
 *
 * The next occurrence is created when the current one is ticked off, not on a
 * timer. Nothing has to run in the background, the list never fills with future
 * copies nobody asked for, and a task you have not done yet cannot be
 * overtaken by its own successor.
 */

export type Repeat = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export const REPEAT_OPTIONS: { value: Repeat | ''; label: string }[] = [
  { value: '', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
];

export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

export function isRepeat(value: unknown): value is Repeat {
  return value === 'daily' || value === 'weekly' || value === 'biweekly' || value === 'monthly';
}

/**
 * One step forward from a given deadline, keeping the time of day.
 *
 * Monthly is the one that needs care: the 31st of January plus a month is not
 * the 31st of February. Adding to the day-of-month directly makes JavaScript
 * roll over into March, silently moving a month-end deadline to the start of
 * the following month, so the day is clamped to the length of the target month
 * instead.
 */
export function nextDue(due: Date, repeat: Repeat): Date {
  const next = new Date(due);

  switch (repeat) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      return next;
    case 'monthly': {
      const day = due.getDate();
      // Move by month from the first, so the roll-over cannot happen at all.
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      return next;
    }
  }
}

/** A repeat can only ever run so far ahead before something is wrong. */
const MAX_STEPS = 500;

/**
 * The next deadline that has not already passed.
 *
 * Ticking off a task three weeks late should not produce a successor that is
 * itself two weeks overdue, so this steps forward until it lands in the future.
 * It walks from the old deadline rather than from now, which keeps a Monday
 * task on Mondays however late it was finished.
 */
export function nextDueAfter(due: Date, repeat: Repeat, now: Date): Date {
  let next = nextDue(due, repeat);

  for (let i = 0; i < MAX_STEPS && next.getTime() <= now.getTime(); i++) {
    next = nextDue(next, repeat);
  }
  return next;
}

/**
 * The successor to a task being completed, or null when there isn't one.
 *
 * Carries the course and the notes across — they describe the job, which has
 * not changed — but not the completion, and gets its own id so the two are
 * separate records rather than one row that keeps being resurrected.
 */
export function nextOccurrence(task: Task, now: Date): Task | null {
  if (!task.repeat || !isRepeat(task.repeat) || !task.dueDate) return null;

  return {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    done: false,
    completedAt: null,
    createdAt: new Date(),
    dueDate: nextDueAfter(task.dueDate, task.repeat, now),
  };
}

/** "Weekly · every Monday" for a row that needs to explain itself. */
export function describeRepeat(task: Task): string | null {
  if (!task.repeat || !isRepeat(task.repeat)) return null;
  if (!task.dueDate) return REPEAT_LABEL[task.repeat];

  if (task.repeat === 'weekly' || task.repeat === 'biweekly') {
    const weekday = task.dueDate.toLocaleDateString(undefined, { weekday: 'long' });
    return `${REPEAT_LABEL[task.repeat]} · ${weekday}s`;
  }
  return REPEAT_LABEL[task.repeat];
}
