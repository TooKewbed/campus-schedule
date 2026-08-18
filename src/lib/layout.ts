import { byStart, type ScheduleEvent } from '../types/event';
import { minutesIntoDay } from './time';

/** Grid geometry. The mockup's hardcoded pixel offsets, generalized. */
export const GRID = {
  startHour: 8,
  endHour: 21,
  /** Pixels per hour. */
  rowHeight: 64,
} as const;

export const GRID_HEIGHT = (GRID.endHour - GRID.startHour) * GRID.rowHeight;

export const DAY_START_MINUTES = GRID.startHour * 60;
export const DAY_END_MINUTES = GRID.endHour * 60;

/** Vertical offset in px for minutes-since-midnight, clamped to the window. */
export function yForMinutes(minutes: number): number {
  const y = ((minutes - DAY_START_MINUTES) / 60) * GRID.rowHeight;
  return Math.max(0, Math.min(GRID_HEIGHT, y));
}

/** Inverse of yForMinutes — where a pointer sits, in minutes since midnight. */
export function minutesFromY(y: number): number {
  const minutes = DAY_START_MINUTES + (y / GRID.rowHeight) * 60;
  return Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES, minutes));
}

/** Vertical offset in px for a moment in time, clamped to the visible window. */
export function yFor(date: Date): number {
  return yForMinutes(minutesIntoDay(date));
}

export interface PositionedEvent {
  event: ScheduleEvent;
  top: number;
  height: number;
  /** Column index within its overlap cluster, and how many columns that cluster needs. */
  column: number;
  columns: number;
}

const MIN_BLOCK_HEIGHT = 26;

/**
 * Position events within a single lane, side-by-side where they overlap.
 *
 * Events are grouped into clusters of transitively-overlapping events, and each
 * cluster is packed into the fewest columns that fit. This replaces the mockup's
 * hand-placed `.half.left` / `.half.right` pair and generalizes to any number of
 * simultaneous events.
 */
export function layoutLane(events: ScheduleEvent[]): PositionedEvent[] {
  const sorted = [...events].sort(byStart);
  const positioned: PositionedEvent[] = [];

  let cluster: ScheduleEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length) positioned.push(...packCluster(cluster));
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (cluster.length && event.start.getTime() >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.end.getTime());
  }
  flush();

  return positioned;
}

/** Greedy column assignment: reuse the first column whose last event has ended. */
function packCluster(cluster: ScheduleEvent[]): PositionedEvent[] {
  const columnEnds: number[] = [];
  const assignments = cluster.map((event) => {
    let column = columnEnds.findIndex((end) => end <= event.start.getTime());
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = event.end.getTime();
    return { event, column };
  });

  const columns = columnEnds.length;
  return assignments.map(({ event, column }) => {
    const top = yFor(event.start);
    return {
      event,
      top,
      height: Math.max(MIN_BLOCK_HEIGHT, yFor(event.end) - top),
      column,
      columns,
    };
  });
}

/** Inline CSS for a positioned block's box. */
export function blockStyle(p: PositionedEvent): React.CSSProperties {
  const gap = 3;
  const widthPct = 100 / p.columns;
  return {
    top: `${p.top}px`,
    height: `${p.height}px`,
    left: `calc(${p.column * widthPct}% + ${p.column ? gap : 0}px)`,
    width: `calc(${widthPct}% - ${p.columns > 1 ? gap : 0}px)`,
  };
}
