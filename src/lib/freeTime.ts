import { byStart, isFixed, type ScheduleEvent } from '../types/event';

export interface FreeWindow {
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * Open time between fixed commitments, within [dayStart, dayEnd].
 *
 * Only fixed events consume time — that is the whole payoff of the fixed/
 * flexible split. An hour with optional office hours in it is still an hour
 * the student can spend on something else, so it stays in the free total.
 */
export function findFreeWindows(
  events: ScheduleEvent[],
  dayStart: Date,
  dayEnd: Date,
  minMinutes = 15,
): FreeWindow[] {
  const lower = dayStart.getTime();
  const upper = dayEnd.getTime();

  // Clamp fixed events to the visible day, drop anything outside it.
  const busy = events
    .filter(isFixed)
    .sort(byStart)
    .map((e) => ({
      start: Math.max(e.start.getTime(), lower),
      end: Math.min(e.end.getTime(), upper),
    }))
    .filter((b) => b.end > b.start);

  // Merge overlapping/touching busy blocks so a conflict doesn't double-count.
  const merged: { start: number; end: number }[] = [];
  for (const block of busy) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      last.end = Math.max(last.end, block.end);
    } else {
      merged.push({ ...block });
    }
  }

  const windows: FreeWindow[] = [];
  let cursor = lower;
  for (const block of merged) {
    if (block.start > cursor) windows.push(makeWindow(cursor, block.start));
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < upper) windows.push(makeWindow(cursor, upper));

  return windows.filter((w) => w.minutes >= minMinutes);
}

function makeWindow(start: number, end: number): FreeWindow {
  return {
    start: new Date(start),
    end: new Date(end),
    minutes: Math.round((end - start) / 60000),
  };
}

export function totalFreeMinutes(windows: FreeWindow[]): number {
  return windows.reduce((sum, w) => sum + w.minutes, 0);
}

/** The next fixed event starting after `now`, for the "next up" tile. */
export function nextFixedEvent(
  events: ScheduleEvent[],
  now: Date,
): ScheduleEvent | undefined {
  return events
    .filter(isFixed)
    .filter((e) => e.start.getTime() > now.getTime())
    .sort(byStart)[0];
}

/** The fixed event happening right now, if any. */
export function currentFixedEvent(
  events: ScheduleEvent[],
  now: Date,
): ScheduleEvent | undefined {
  const t = now.getTime();
  return events
    .filter(isFixed)
    .find((e) => e.start.getTime() <= t && e.end.getTime() > t);
}
