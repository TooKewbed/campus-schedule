/**
 * One ordering for every weekday control in the app.
 *
 * Sunday-first (S M T W T F S), the US convention — this is a US college app,
 * and the week strip, the date-picker grid and the repeat selectors all read
 * from here so they can't drift out of step with each other.
 */
export interface Weekday {
  /** JS getDay() value: 0 = Sunday ... 6 = Saturday. */
  value: number;
  /** Single letter for compact pickers. */
  label: string;
  short: string;
  full: string;
}

export const WEEKDAYS: Weekday[] = [
  { value: 0, label: 'S', short: 'Sun', full: 'Sunday' },
  { value: 1, label: 'M', short: 'Mon', full: 'Monday' },
  { value: 2, label: 'T', short: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'W', short: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'T', short: 'Thu', full: 'Thursday' },
  { value: 5, label: 'F', short: 'Fri', full: 'Friday' },
  { value: 6, label: 'S', short: 'Sat', full: 'Saturday' },
];

/** "Mon, Wed, Fri" in week order, whatever order the values arrived in. */
export function describeDays(weekdays: number[]): string {
  const chosen = new Set(weekdays);
  const named = WEEKDAYS.filter((d) => chosen.has(d.value)).map((d) => d.short);

  if (named.length === 0) return 'No days';
  if (named.length === 7) return 'Every day';
  return named.join(', ');
}

/** Deduplicated and in week order, for comparing two selections. */
export function normalizeDays(weekdays: number[]): number[] {
  return [...new Set(weekdays)].sort((a, b) => a - b);
}

export function sameDays(a: number[], b: number[]): boolean {
  const x = normalizeDays(a);
  const y = normalizeDays(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}
