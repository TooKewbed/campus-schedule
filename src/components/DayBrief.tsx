import { useMemo } from 'react';
import type { ScheduleEvent } from '../types/event';
import type { Conflict } from '../lib/conflicts';
import type { FreeWindow } from '../lib/freeTime';
import { buildBrief } from '../lib/dayBrief';
import { formatDayHeading } from '../lib/time';

interface Props {
  events: ScheduleEvent[];
  conflicts: Conflict[];
  freeWindows: FreeWindow[];
  markerCount: number;
  openTasks: number;
  now: Date;
  selected: Date;
  isToday: boolean;
}

/**
 * The day in one line, before any of it is read in detail.
 *
 * The grid answers "what is at two o'clock". This answers the question people
 * actually open the app with — "what am I walking into" — so it leads, and the
 * schedule becomes the thing you consult once oriented rather than the thing
 * you arrive at cold.
 *
 * All the wording lives in lib/dayBrief so it can be tested; this only arranges
 * it. Phrasing that is only ever checked by looking at it goes wrong at the
 * edges — an event that ended a minute ago, an empty day, a day that is not
 * today and so has no "now" to speak from.
 */
export default function DayBrief({
  events,
  conflicts,
  freeWindows,
  markerCount,
  openTasks,
  now,
  selected,
  isToday,
}: Props) {
  const brief = useMemo(
    () =>
      buildBrief({ events, conflicts, freeWindows, markerCount, openTasks, now, isToday }),
    [events, conflicts, freeWindows, markerCount, openTasks, now, isToday],
  );

  return (
    <section className={`brief tone-${brief.tone}`} aria-label="Day summary">
      <p className="brief-eyebrow">
        {isToday ? 'Today' : formatDayHeading(selected)}
      </p>

      {/* Announced as a whole so a screen reader gets the summary rather than
          three unrelated fragments. */}
      <p className="brief-headline" aria-live="polite">
        {brief.headline}
      </p>

      {brief.detail && <p className="brief-detail">{brief.detail}</p>}

      {brief.facts.length > 0 && (
        <ul className="brief-facts">
          {brief.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
