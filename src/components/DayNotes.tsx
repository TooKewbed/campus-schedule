import type { DayMarker } from '../types/dayMarker';

/**
 * All-day markers for the selected day, shown as a note above the schedule.
 * Never rendered into the time grid — these occupy no time, so giving them a
 * position on an hour axis would be a lie.
 */
export default function DayNotes({ markers }: { markers: DayMarker[] }) {
  if (markers.length === 0) return null;

  return (
    <div className="day-notes">
      {markers.map((marker) => (
        <span key={marker.id} className={`day-note ${marker.source}`}>
          <span className="day-note-dot" aria-hidden="true" />
          {marker.title}
        </span>
      ))}
    </div>
  );
}
