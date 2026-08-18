import type { DayMarker } from '../types/dayMarker';
import { KIND_LABEL, markerKind, type MarkerKind } from '../lib/dateKind';

interface Props {
  markers: DayMarker[];
  /** Whether the day being shown is today, which is when these matter most. */
  isToday: boolean;
}

/**
 * All-day markers for the selected day.
 *
 * These are the things that ruin a week if they go unnoticed — an exam, a
 * deadline, a birthday — so they are sized to be read before the schedule
 * underneath them, not tucked above it as chips. An exam and a birthday get
 * different colours because they need different reactions; the kind is read
 * from the title, so a hand-typed "CHEM 101 Final" is treated exactly like an
 * imported one.
 *
 * Still never drawn into the time grid: they occupy no time, and giving them a
 * position on an hour axis would be a lie about when they happen.
 */
export default function DayNotes({ markers, isToday }: Props) {
  if (markers.length === 0) return null;

  return (
    <div className="day-notes">
      {markers.map((marker) => {
        const kind = markerKind(marker);
        return (
          <div
            key={marker.id}
            className={`day-note kind-${kind}${isToday ? ' today' : ''}`}
          >
            <span className="day-note-rail" aria-hidden="true" />
            <div className="day-note-body">
              <span className="day-note-eyebrow">
                {isToday && <span className="day-note-now">Today</span>}
                <span>{eyebrow(marker, kind)}</span>
              </span>
              <strong className="day-note-title">{marker.title}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The small line above the title: what this is, and which course it belongs to. */
function eyebrow(marker: DayMarker, kind: MarkerKind): string {
  if (kind === 'holiday') return 'Holiday';

  const what = kind === 'other' ? 'Important date' : KIND_LABEL[kind];

  // A title can be as bare as its label — "Exam" under "Exam · CHEM 101" says
  // the same word twice. When they collide, the course carries the information.
  if (marker.title.trim().toLowerCase() === what.toLowerCase()) {
    return marker.courseCode ?? what;
  }

  return marker.courseCode ? `${what} · ${marker.courseCode}` : what;
}
