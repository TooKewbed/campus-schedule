/** Small local-time date helpers. Everything renders in the browser's zone. */

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Sunday-based start of the week containing `d`.
 *
 * Sunday-first is the US convention, and it has to match the S M T W T F S
 * repeat pickers — a week strip that starts on a different day than the day
 * selectors is a quiet source of off-by-one mistakes.
 */
export function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  return addDays(out, -out.getDay());
}

/** Minutes since midnight, as a float so partial hours position correctly. */
export function minutesIntoDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function formatTime(d: Date): string {
  return d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, ' ');
}

/** "9:00 – 9:50 AM" — drops the meridiem on the start when both halves share it. */
export function formatRange(start: Date, end: Date): string {
  const a = formatTime(start);
  const b = formatTime(end);
  const meridiemA = a.slice(-2);
  const meridiemB = b.slice(-2);
  const left = meridiemA === meridiemB ? a.slice(0, -3) : a;
  return `${left} – ${b}`;
}

/** "1h 45m", "45m", "2h" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDayHeading(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
