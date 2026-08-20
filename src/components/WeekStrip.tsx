import { useMemo } from 'react';
import { isFixed, type ScheduleEvent } from '../types/event';
import { detectConflicts } from '../lib/conflicts';
import { addDays, parseISODate, sameDay, startOfWeek, toISODate } from '../lib/time';
import DatePicker from './DatePicker';
import SegmentedControl from './SegmentedControl';
import type { DayMarker } from '../types/dayMarker';
import { dominantKind } from '../lib/dateKind';

export type ScheduleView = 'day' | 'week';

const VIEW_OPTIONS: { value: ScheduleView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

interface Props {
  events: ScheduleEvent[];
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  onShiftWeek: (delta: number) => void;
  markersOn: (date: Date) => DayMarker[];
  view: ScheduleView;
  onViewChange: (view: ScheduleView) => void;
}

export default function WeekStrip({
  events,
  selected,
  today,
  onSelect,
  onShiftWeek,
  markersOn,
  view,
  onViewChange,
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
    <div className="week">
      <div className="week-head">
        {/* The same calendar the forms use, wearing a heading instead of a
            field. Reusing it means the month grid, its keyboard handling and
            its scroll-through-months behaviour exist once. */}
        <DatePicker
          variant="inline"
          value={toISODate(selected)}
          onChange={(iso) => onSelect(parseISODate(iso))}
          label={monthLabel(selected)}
        />
        <span className="week-range">{weekRange(monday)}</span>

        {/* Lives with the date navigation rather than in the toolbar: this row
            already governs what stretch of time the schedule below is showing,
            and how much of it is the same question. */}
        <SegmentedControl
          label="Show the schedule a day or a week at a time"
          options={VIEW_OPTIONS}
          value={view}
          onChange={onViewChange}
        />
      </div>

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
                  <span
                    /* Coloured by the most consequential date on the day, so an
                       exam later in the week is visible on approach rather than
                       only once you land on it. */
                    className={`marker-dot kind-${dominantKind(markers)}`}
                    title={markers.map((m) => m.title).join(', ')}
                  />
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
    </div>
  );
}

/**
 * The month the shown week belongs to.
 *
 * A week straddling a month boundary is named for the selected day's month, not
 * the Sunday's: the heading should agree with the day actually being looked at,
 * which is what the schedule below it is showing.
 */
function monthLabel(selected: Date): string {
  return selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Aug 16 – 22", or with both months named when the week crosses one. */
function weekRange(monday: Date): string {
  const end = addDays(monday, 6);
  const start = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const finish =
    monday.getMonth() === end.getMonth()
      ? String(end.getDate())
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${start} – ${finish}`;
}
