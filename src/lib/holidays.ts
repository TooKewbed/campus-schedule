import type { DayMarker } from '../types/dayMarker';

/**
 * The eleven US federal holidays, computed per year rather than stored.
 *
 * Most of these move — Thanksgiving is the fourth Thursday in November, not a
 * fixed date — so deriving them for whatever year is on screen is both smaller
 * than a stored table and correct for every year, past or future.
 */
export function usFederalHolidays(year: number): DayMarker[] {
  const fixed: [string, number, number][] = [
    ["New Year's Day", 1, 1],
    ['Juneteenth', 6, 19],
    ['Independence Day', 7, 4],
    ['Veterans Day', 11, 11],
    ['Christmas Day', 12, 25],
  ];

  const floating: [string, number, number, number][] = [
    // title, month, weekday (0=Sun), nth occurrence
    ['Martin Luther King Jr. Day', 1, 1, 3],
    ["Presidents' Day", 2, 1, 3],
    ['Labor Day', 9, 1, 1],
    ['Columbus Day', 10, 1, 2],
    ['Thanksgiving', 11, 4, 4],
  ];

  const markers: DayMarker[] = [];

  for (const [title, month, day] of fixed) {
    markers.push(holiday(title, year, month, day));
  }

  for (const [title, month, weekday, nth] of floating) {
    markers.push(holiday(title, year, month, nthWeekday(year, month, weekday, nth)));
  }

  // Memorial Day is the LAST Monday in May, not an nth.
  markers.push(holiday('Memorial Day', year, 5, lastWeekday(year, 5, 1)));

  return markers.sort((a, b) => a.month - b.month || a.day - b.day);
}

function holiday(title: string, year: number, month: number, day: number): DayMarker {
  return {
    id: `holiday-${year}-${month}-${day}-${title.replace(/\W+/g, '-').toLowerCase()}`,
    title,
    month,
    day,
    year,
    source: 'holiday',
  };
}

/** Day-of-month for the nth given weekday of a month. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): number {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

/** Day-of-month for the last given weekday of a month. */
function lastWeekday(year: number, month: number, weekday: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  const lastDow = new Date(year, month - 1, lastDay).getDay();
  return lastDay - ((lastDow - weekday + 7) % 7);
}
