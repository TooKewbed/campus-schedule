import { useMemo, useState } from 'react';
import { CATEGORY_KIND, CATEGORY_LABEL, type ScheduleEvent } from '../types/event';
import { groupByWeekday, toTimeInput, type ManualSeries } from '../lib/manualEvents';
import { formatDuration } from '../lib/time';
import { WEEKDAYS } from '../lib/weekdays';

interface Props {
  series: ManualSeries[];
  singles: ScheduleEvent[];
  onDelete: (seriesId: string) => void;
  onDeleteSingle: (id: string) => void;
}

/**
 * Everything on the schedule, by day of the week.
 *
 * Split out from the entry panel, which was doing two jobs at once: a form for
 * adding something and a register of everything already added. They are used at
 * different moments — one when setting a term up, the other when checking what
 * a Wednesday looks like — and stacking them made both harder to read.
 *
 * Grouped by weekday rather than listed as series, because the question this
 * answers is "what do I have on Tuesday", not "what series exist". A class
 * meeting Monday, Wednesday and Friday therefore appears three times, which is
 * the honest answer to that question.
 */
export default function CommitmentList({ series, singles, onDelete, onDeleteSingle }: Props) {
  const [open, setOpen] = useState(false);

  const days = useMemo(() => groupByWeekday(series, singles), [series, singles]);
  const total = series.length + singles.length;
  const busiest = days.reduce((n, day) => Math.max(n, day.length), 0);

  if (total === 0) return null;

  return (
    <section className="commitments">
      <button
        className="manual-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="manual-head-text">
          <strong>Your commitments</strong>
          <span className="manual-head-sub">
            {series.length} repeating
            {singles.length > 0 && `, ${singles.length} one-off`}
            {busiest > 0 && ` · up to ${busiest} in a day`}
          </span>
        </span>
        <Chevron open={open} />
      </button>

      <div className="manual-body" data-open={open}>
        <div className="manual-body-inner">
          <div className="commitment-days">
            {WEEKDAYS.map((weekday) => {
              const items = days[weekday.value];
              return (
                <div key={weekday.value} className="commitment-day">
                  <div className="commitment-day-head">
                    <h3>{weekday.full}</h3>
                    <span className="commitment-day-count">
                      {items.length === 0 ? 'Free' : `${items.length}`}
                    </span>
                  </div>

                  {/* An empty day is worth stating rather than leaving as a gap
                      the reader has to interpret. */}
                  {items.length === 0 ? (
                    <p className="commitment-empty">Nothing scheduled</p>
                  ) : (
                    <ul className="commitment-rows">
                      {items.map((item) => (
                        <li key={item.key} className="commitment-row">
                          <span
                            className={`series-rail ${CATEGORY_KIND[item.category]}`}
                            aria-hidden="true"
                          />
                          <span className="commitment-main">
                            <span className="commitment-title">
                              {item.title}
                              {item.date && <span className="series-once">Once</span>}
                            </span>
                            <span className="commitment-meta">
                              {toTimeInput(item.startMinutes)}–{toTimeInput(item.endMinutes)}
                              {' · '}
                              {formatDuration(item.endMinutes - item.startMinutes)}
                              {item.date &&
                                ` · ${item.date.toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}`}
                              {item.location ? ` · ${item.location}` : ''}
                              {' · '}
                              {CATEGORY_LABEL[item.category]}
                            </span>
                          </span>
                          <button
                            className="icon-btn danger"
                            onClick={() =>
                              item.eventId ? onDeleteSingle(item.eventId) : onDelete(item.seriesId!)
                            }
                            aria-label={
                              item.eventId
                                ? `Remove ${item.title}`
                                : `Remove ${item.title} from every day it repeats`
                            }
                            title={item.eventId ? 'Remove' : 'Remove the whole series'}
                          >
                            <TrashGlyph />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          <p className="commitment-note">
            Removing a repeating commitment removes it from every day it meets, not
            just this one.
          </p>
        </div>
      </div>
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`chevron${open ? ' open' : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 6.5L8 9.5l3-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3.2h3v1.3M4.6 4.5l.6 8.3h5.6l.6-8.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
