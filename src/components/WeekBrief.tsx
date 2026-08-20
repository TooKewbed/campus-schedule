import { useMemo } from 'react';
import type { ScheduleEvent } from '../types/event';
import type { DayMarker } from '../types/dayMarker';
import { buildWeekBrief } from '../lib/weekBrief';
import { addDays } from '../lib/time';

interface Props {
  events: ScheduleEvent[];
  /** Sunday of the week being shown. */
  weekStart: Date;
  markers: DayMarker[];
  today: Date;
}

/**
 * The week's opening line, in place of the day's.
 *
 * Shares the day brief's markup and styles deliberately — it occupies the same
 * slot and answers the same shape of question at a different scale, so it
 * should look like the same thing rather than a second kind of banner.
 */
export default function WeekBrief({ events, weekStart, markers, today }: Props) {
  const brief = useMemo(
    () => buildWeekBrief({ events, weekStart, markers, today }),
    [events, weekStart, markers, today],
  );

  const range = `${weekStart.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric' })}`;

  return (
    <section className={`brief tone-${brief.tone}`} aria-label="Week summary">
      <p className="brief-eyebrow">This week · {range}</p>

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
