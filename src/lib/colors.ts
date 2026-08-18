import type { ScheduleEvent } from '../types/event';

/** Palette slots defined in styles.css. */
export type ColorName = 'blue' | 'orange' | 'violet' | 'green' | 'aqua' | 'yellow' | 'exam';

const FIXED_PALETTE: ColorName[] = ['blue', 'orange', 'violet', 'green'];

const FLEXIBLE_COLOR: Record<string, ColorName> = {
  'office-hours': 'aqua',
  study: 'yellow',
  tutoring: 'violet',
};

/**
 * Stable color per course. Keyed on course code where we have one so every
 * CHEM 101 meeting — lecture, lab, review — reads as the same course.
 */
export function colorFor(event: ScheduleEvent): ColorName {
  if (event.category === 'exam') return 'exam';

  const flexible = FLEXIBLE_COLOR[event.category];
  if (flexible) return flexible;

  const key = event.courseCode ?? event.seriesId ?? event.title;
  return FIXED_PALETTE[hash(key) % FIXED_PALETTE.length];
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
