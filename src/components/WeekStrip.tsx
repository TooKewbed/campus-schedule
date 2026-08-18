import { useMemo } from 'react';
import { isFixed, type ScheduleEvent } from '../types/event';
import { detectConflicts } from '../lib/conflicts';
import { addDays, sameDay, startOfWeek } from '../lib/time';
import type { DayMarker } from '../types/dayMarker';

interface Props {
  events: ScheduleEvent[];
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  onShiftWeek: (delta: number) => void;
  markersOn: (date: Date) => DayMarker[];
}

export default function WeekStrip({
  events,
  selected,
  today,
  onSelect,
  onShiftWeek,
  markersOn,
}: Props) {
  const monday = startOfWeek(selected);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const dayEvents = events.filter((e) => sameDay(e.start, date));
      return {
        date,
        fixedCount: dayEvents.filter(isFixed).length,
        conflictCount: detectConflicts(dayEvents).length,
        markers: markersOn(date),
      };
    });
  }, [events, monday, markersOn]);

  return (
    <div className="week-nav">
      <button className="week-arrow" onClick={() => onShiftWeek(-1)} aria-label="Previous week">
        ‹
      </button>

      <div className="week-strip">
        {days.map(({ date, fixedCount, conflictCount, markers }) => {
          const classes = ['day-chip'];
          if (sameDay(date, selected)) classes.push('selected');
          if (sameDay(date, today)) classes.push('today');

          return (
            <button key={+date} className={classes.join(' ')} onClick={() => onSelect(date)}>
              <span className="dow">
                {date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
              </span>
              <span className="dom">{date.getDate()}</span>
              <span className="marks">
                {fixedCount > 0 && <span className="count">{fixedCount}</span>}
                {conflictCount > 0 && <span className="warn-dot" title="Scheduling conflict" />}
                {markers.length > 0 && (
                  <span className="marker-dot" title={markers.map((m) => m.title).join(', ')} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <button className="week-arrow" onClick={() => onShiftWeek(1)} aria-label="Next week">
        ›
      </button>
    </div>
  );
}
