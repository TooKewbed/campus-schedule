/**
 * All-day markers: holidays, birthdays, deadlines-without-a-time.
 *
 * Deliberately NOT a ScheduleEvent. A birthday has no start or end, consumes no
 * time, and can never conflict with anything — modelling it as an event would
 * force it through conflict detection and free-time math where it would either
 * corrupt the numbers or need special-casing at every step. It is a note
 * attached to a date, so that is exactly what it is here.
 */
export interface DayMarker {
  id: string;
  title: string;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
  /** null means it repeats every year — birthdays, anniversaries. */
  year: number | null;
  source: 'holiday' | 'manual';
}

export function createMarker(
  title: string,
  month: number,
  day: number,
  year: number | null,
): DayMarker {
  return {
    id: `mark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim(),
    month,
    day,
    year,
    source: 'manual',
  };
}

/** Markers falling on a given calendar date. */
export function markersOn(markers: DayMarker[], date: Date): DayMarker[] {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return markers.filter(
    (m) => m.month === month && m.day === day && (m.year === null || m.year === year),
  );
}

/** "Every Aug 18" for annual markers, "Aug 18, 2026" for one-offs. */
export function describeMarkerDate(marker: DayMarker): string {
  const sample = new Date(marker.year ?? 2000, marker.month - 1, marker.day);
  const label = sample.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return marker.year === null ? `Every ${label}` : `${label}, ${marker.year}`;
}

/** Annual markers first by calendar position, so the list reads like a year. */
export function sortMarkers(markers: DayMarker[]): DayMarker[] {
  return [...markers].sort((a, b) => a.month - b.month || a.day - b.day);
}
