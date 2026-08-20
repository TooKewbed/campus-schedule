import { useMemo, type CSSProperties } from 'react';
import { isFixed, type ScheduleEvent } from '../types/event';
import { conflictedEventIds, detectConflicts } from '../lib/conflicts';
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  GRID,
  GRID_HEIGHT,
  blockStyle,
  layoutLane,
  yFor,
} from '../lib/layout';
import { colorFor } from '../lib/colors';
import { describeSpan, eventsOf, occurrencesOn, splitDay, type DayOccurrence } from '../lib/spans';
import { addDays, formatRange, formatTime, minutesIntoDay, sameDay } from '../lib/time';
import { WEEKDAYS } from '../lib/weekdays';
import type { DayMarker } from '../types/dayMarker';
import { dominantKind } from '../lib/dateKind';

interface Props {
  /** The whole schedule; this picks out the week it needs. */
  events: ScheduleEvent[];
  /** Sunday of the week being shown. */
  weekStart: Date;
  selected: Date;
  today: Date;
  now: Date;
  /** Selects a day and drops back to the day view, the way zooming in works. */
  onZoomDay: (date: Date) => void;
  onRequestEdit: (event: ScheduleEvent) => void;
  markersOn: (date: Date) => DayMarker[];
}

/**
 * Seven days at once.
 *
 * Shares its geometry with the day view rather than reimplementing it: the same
 * `layoutLane` packs overlapping events into columns and the same `blockStyle`
 * positions them, so a Tuesday looks the same shape here as it does on its own.
 * Two grids that computed positions independently would drift the first time
 * either was adjusted.
 *
 * Fixed and flexible share one lane per day. The day view can afford to split
 * them into two columns; a seventh of the width cannot, and an office hour that
 * overlaps a class is still worth seeing side by side.
 *
 * Nothing is created by dragging here. Drawing a block on a column this narrow
 * is a guess rather than a choice, and the day view — one click away through
 * any column header — is where that belongs.
 */
export default function WeekGrid({
  events,
  weekStart,
  selected,
  today,
  now,
  onZoomDay,
  onRequestEdit,
  markersOn,
}: Props) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      // Occurrences, not `sameDay(e.start)`: asking which day an event started
      // on loses every day of a trip except the first.
      const split = splitDay(occurrencesOn(events, date));
      const dayEvents = eventsOf(split.timed);
      return {
        date,
        split,
        // One lane, so an overlap between a class and an office hour still
        // reads as an overlap rather than two blocks in separate columns.
        positioned: layoutLane(dayEvents),
        occurrenceOf: byId(split.timed),
        conflicted: conflictedEventIds(detectConflicts(dayEvents)),
        markers: markersOn(date),
        count: dayEvents.filter(isFixed).length + split.banner.length + split.moments.length,
      };
    });
  }, [events, weekStart, markersOn]);

  /** Whether any day this week has a band, so the row is only there when used. */
  const hasBanner = days.some((d) => d.split.banner.length > 0);

  const hours: number[] = [];
  for (let h = GRID.startHour; h <= GRID.endHour; h++) hours.push(h);

  const minutesNow = minutesIntoDay(now);
  const nowOffset =
    minutesNow >= DAY_START_MINUTES && minutesNow <= DAY_END_MINUTES ? yFor(now) : null;

  return (
    <section className="week-grid" aria-label="This week's schedule">
      {/* Scrolls sideways rather than compressing below legibility: seven
          columns on a phone is about fifty pixels each, which is narrower than
          the shortest course code. */}
      <div className="wg-scroll">
        <div className="wg-inner">
          <div className="wg-head">
            <div className="wg-corner" aria-hidden="true" />
            {days.map(({ date, markers, count }) => {
              const classes = ['wg-day'];
              if (sameDay(date, selected)) classes.push('selected');
              if (sameDay(date, today)) classes.push('today');

              return (
                <button
                  key={+date}
                  className={classes.join(' ')}
                  onClick={() => onZoomDay(date)}
                  aria-label={`Open ${date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}`}
                >
                  <span className="wg-dow">
                    {WEEKDAYS[date.getDay()].short.toUpperCase()}
                  </span>
                  <span className="wg-dom">{date.getDate()}</span>
                  <span className="wg-marks">
                    {count > 0 && <span className="wg-count">{count}</span>}
                    {markers.length > 0 && (
                      <span
                        className={`marker-dot kind-${dominantKind(markers)}`}
                        title={markers.map((m) => m.title).join(', ')}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* One row under the day headers for everything that has no place on
              the grid: whole days of a trip, and moments outside grid hours.
              Only drawn when the week actually has some. */}
          {hasBanner && (
            <div className="wg-allday">
              <div className="wg-gutter wg-allday-label">All day</div>
              {days.map(({ date, split }) => (
                <div key={+date} className="wg-allday-col">
                  {split.banner.map((o) => (
                    <button
                      key={o.event.id}
                      className={`wg-band ${colorFor(o.event)}${o.moment ? ' is-moment' : ''}`}
                      onClick={() => onRequestEdit(o.source)}
                      title={
                        o.moment
                          ? `${o.event.title} · ${formatTime(o.event.start)}`
                          : `${o.source.title} · ${describeSpan(o.source)}`
                      }
                    >
                      {o.moment && <b>{formatTime(o.event.start)}</b>} {o.event.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="wg-body" style={{ height: `${GRID_HEIGHT}px` }}>
            <div className="wg-gutter">
              {hours.map((h) => (
                <div
                  key={h}
                  className="wg-hour"
                  style={{ top: `${(h - GRID.startHour) * GRID.rowHeight}px` }}
                >
                  {formatHour(h)}
                </div>
              ))}
            </div>

            {days.map(({ date, positioned, conflicted, occurrenceOf, split }) => {
              const isToday = sameDay(date, today);
              const classes = ['wg-col'];
              if (sameDay(date, selected)) classes.push('selected');
              if (date.getDay() === 0 || date.getDay() === 6) classes.push('weekend');

              return (
                <div key={+date} className={classes.join(' ')}>
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="gridline"
                      style={{ top: `${(h - GRID.startHour) * GRID.rowHeight}px` }}
                    />
                  ))}

                  {/* Moments first, so a block drawn afterwards sits above the
                      line rather than under it. */}
                  {split.moments.map((o) => (
                    <div
                      key={o.event.id}
                      className={`wg-moment ${colorFor(o.event)}`}
                      style={{ top: `${yFor(o.event.start)}px` }}
                      role="button"
                      tabIndex={0}
                      title={`${o.event.title} · ${formatTime(o.event.start)}`}
                      onClick={() => onRequestEdit(o.source)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRequestEdit(o.source);
                        }
                      }}
                    >
                      <span className="wg-moment-knob" />
                      <span className="wg-moment-label">{o.event.title}</span>
                    </div>
                  ))}

                  {positioned.map((p, i) => {
                    const flexible = !isFixed(p.event);
                    const o = occurrenceOf(p.event.id);
                    const whole = o?.source ?? p.event;
                    const classes = [flexible ? 'ev-flex' : 'ev', 'compact', colorFor(p.event)];
                    if (!flexible && conflicted.has(p.event.id)) classes.push('conflicting');
                    if (o?.continuesBefore) classes.push('from-before');
                    if (o?.continuesAfter) classes.push('into-after');

                    return (
                      <div
                        key={p.event.id}
                        className={classes.join(' ')}
                        style={{ ...blockStyle(p), '--i': i } as CSSProperties}
                        title={
                          o && (o.continuesBefore || o.continuesAfter)
                            ? `${o.source.title} · ${describeSpan(o.source)}`
                            : `${p.event.title} · ${formatRange(p.event.start, p.event.end)}${
                                p.event.location ? ` · ${p.event.location}` : ''
                              }`
                        }
                        role="button"
                        tabIndex={0}
                        onClick={() => onRequestEdit(whole)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRequestEdit(whole);
                          }
                        }}
                      >
                        <div className="t">{p.event.title}</div>
                        {p.height >= 40 && (
                          <div className="m">{formatTime(p.event.start)}</div>
                        )}
                      </div>
                    );
                  })}

                  {/* The now line belongs to one column, not the whole week —
                      drawn across all seven it would claim the time is "now"
                      on Saturday as much as today. */}
                  {isToday && nowOffset !== null && (
                    <div className="now-line week" style={{ top: `${nowOffset}px` }}>
                      <div className="bar" />
                      <div className="knob" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="wg-hint">
        Pick a day to open it and drag in something new.
      </p>
    </section>
  );
}

function formatHour(hour: number): string {
  if (hour === 12) return 'Noon';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Index one day’s occurrences so a positioned block can find its whole event. */
function byId(list: DayOccurrence[]): (id: string) => DayOccurrence | undefined {
  const map = new Map(list.map((o) => [o.event.id, o]));
  return (id) => map.get(id);
}
