import type { ColorName, ScheduleEvent } from '../types/event';

export type { ColorName };

const FIXED_PALETTE: ColorName[] = ['blue', 'orange', 'violet', 'green'];

const FLEXIBLE_COLOR: Record<string, ColorName> = {
  'office-hours': 'aqua',
  study: 'yellow',
  tutoring: 'violet',
};

/**
 * The colour a block is drawn in.
 *
 * A hand-picked colour wins outright. Otherwise it is derived, keyed on course
 * code where there is one so every CHEM 101 meeting — lecture, lab, review —
 * reads as the same course without anyone having to keep them in step.
 *
 * The override is checked first and unconditionally, including for exams: a
 * category that forced its own colour would make the picker silently do
 * nothing on exactly the events people most want to distinguish.
 */
export function colorFor(event: ScheduleEvent): ColorName {
  if (event.color) return event.color;
  if (event.category === 'exam') return 'exam';

  const flexible = FLEXIBLE_COLOR[event.category];
  if (flexible) return flexible;

  const key = event.courseCode ?? event.seriesId ?? event.title;
  return FIXED_PALETTE[hash(key) % FIXED_PALETTE.length];
}

/** The colour an event would get on its own, for previewing "Automatic". */
export function automaticColorFor(event: ScheduleEvent): ColorName {
  return colorFor({ ...event, color: undefined });
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
