import { byStart, isFixed, type ScheduleEvent } from '../types/event';

export interface Conflict {
  id: string;
  a: ScheduleEvent;
  b: ScheduleEvent;
  /** The overlapping window itself — what the UI labels. */
  start: Date;
  end: Date;
}

/** Intersection of two events' time ranges, or null if they merely touch. */
export function overlapWindow(
  a: ScheduleEvent,
  b: ScheduleEvent,
): { start: Date; end: Date } | null {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());
  // Strict: back-to-back classes (one ends 09:50, next starts 09:50) are fine.
  return end > start ? { start: new Date(start), end: new Date(end) } : null;
}

/**
 * Real conflicts only: fixed vs. fixed. Two office hours at the same time are
 * two options, not a problem, so flexible events are never conflict operands.
 */
export function detectConflicts(events: ScheduleEvent[]): Conflict[] {
  const fixed = events.filter(isFixed).sort(byStart);
  const conflicts: Conflict[] = [];

  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      // Sorted by start: once one event starts at/after i ends, so does every
      // event after it, so nothing further can overlap i.
      if (fixed[j].start.getTime() >= fixed[i].end.getTime()) break;

      const window = overlapWindow(fixed[i], fixed[j]);
      if (window) {
        conflicts.push({
          id: `${fixed[i].id}::${fixed[j].id}`,
          a: fixed[i],
          b: fixed[j],
          ...window,
        });
      }
    }
  }

  return conflicts;
}

/** Ids of every event caught up in at least one conflict, for badge rendering. */
export function conflictedEventIds(conflicts: Conflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.a.id);
    ids.add(c.b.id);
  }
  return ids;
}
