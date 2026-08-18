import type { ScheduleEvent } from '../types/event';
import type { Conflict } from '../lib/conflicts';
import { currentFixedEvent, nextFixedEvent, totalFreeMinutes, type FreeWindow } from '../lib/freeTime';
import { formatDuration, formatTime } from '../lib/time';

interface Props {
  events: ScheduleEvent[];
  conflicts: Conflict[];
  freeWindows: FreeWindow[];
  now: Date;
  isToday: boolean;
}

export default function StatTiles({ events, conflicts, freeWindows, now, isToday }: Props) {
  const current = isToday ? currentFixedEvent(events, now) : undefined;
  const next = nextFixedEvent(events, isToday ? now : startOfViewedDay(events));
  const freeMinutes = totalFreeMinutes(freeWindows);

  return (
    <div className="stats">
      <div className="stat-tile">
        <div className="label">{isToday ? 'Right now' : 'This day'}</div>
        <div className="value">{current ? current.title : isToday ? 'Free' : `${events.length} events`}</div>
        <div className="sub">
          {current
            ? `until ${formatTime(current.end)}`
            : next
              ? `${next.title} at ${formatTime(next.start)}`
              : 'Nothing scheduled'}
        </div>
      </div>

      <div className="stat-tile">
        <div className="label">Next up</div>
        <div className="value">{next ? next.title : '—'}</div>
        <div className="sub">
          {next
            ? `${formatTime(next.start)}${next.location ? ` · ${next.location}` : ''}`
            : 'Rest of the day is open'}
        </div>
      </div>

      <div className="stat-tile">
        <div className="label">Free time</div>
        <div className="value">{formatDuration(freeMinutes)}</div>
        <div className="sub">
          across {freeWindows.length} open window{freeWindows.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className={`stat-tile${conflicts.length ? ' warn' : ''}`}>
        <div className="label">Conflicts</div>
        <div className="value">{conflicts.length}</div>
        <div className="sub">
          {conflicts.length
            ? `${conflicts[0].a.title} overlaps ${conflicts[0].b.title}`
            : 'No double-bookings'}
        </div>
      </div>
    </div>
  );
}

/** For a non-today view, "next up" means the first event of that day. */
function startOfViewedDay(events: ScheduleEvent[]): Date {
  const earliest = events.reduce<Date | null>(
    (min, e) => (min === null || e.start < min ? e.start : min),
    null,
  );
  return earliest ? new Date(earliest.getTime() - 1) : new Date(0);
}
