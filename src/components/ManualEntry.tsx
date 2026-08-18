import { useState } from 'react';
import {
  CATEGORY_KIND,
  CATEGORY_LABEL,
  type EventCategory,
  type ScheduleEvent,
} from '../types/event';
import {
  parseTimeInput,
  toTimeInput,
  validateOnce,
  validateSeries,
  type ManualSeries,
  type ManualSeriesInput,
} from '../lib/manualEvents';
import { formatDuration, formatRange, parseISODate, toISODate } from '../lib/time';
import { describeDays } from '../lib/weekdays';
import ChoiceOption from './ChoiceOption';
import DatePicker from './DatePicker';
import WeekdayPicker from './WeekdayPicker';

const FIXED: EventCategory[] = ['class', 'lab', 'exam', 'work', 'appointment'];
const FLEXIBLE: EventCategory[] = ['office-hours', 'study', 'tutoring'];

interface Props {
  series: ManualSeries[];
  /** One-off commitments, listed alongside the repeating ones. */
  singles: ScheduleEvent[];
  defaultOpen: boolean;
  onAdd: (input: ManualSeriesInput) => void;
  onAddOnce: (input: Omit<ManualSeriesInput, 'weekdays'>, date: Date) => void;
  onDelete: (seriesId: string) => void;
  onDeleteSingle: (id: string) => void;
}

export default function ManualEntry({
  series,
  singles,
  defaultOpen,
  onAdd,
  onAddOnce,
  onDelete,
  onDeleteSingle,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('class');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('09:50');
  const [location, setLocation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * Weekly by default, because a timetable is mostly classes. A final, a
   * one-off lab session or an appointment is the other case, and before this
   * existed the only way to enter one was to draw it on the grid — which meant
   * navigating to a date in December to add the exam that lands there.
   */
  const [repeats, setRepeats] = useState(true);
  const [date, setDate] = useState(() => toISODate(new Date()));

  const submit = () => {
    const base = {
      title,
      category,
      startMinutes: parseTimeInput(start),
      endMinutes: parseTimeInput(end),
      location,
    };

    if (repeats) {
      const input: ManualSeriesInput = { ...base, weekdays };
      const invalid = validateSeries(input);
      if (invalid) {
        setProblem(invalid);
        return;
      }
      onAdd(input);
    } else {
      const invalid = validateOnce(base);
      if (invalid) {
        setProblem(invalid);
        return;
      }
      onAddOnce(base, parseISODate(date));
    }

    setTitle('');
    setLocation('');
    setWeekdays([]);
    setProblem(null);
  };

  const duration = parseTimeInput(end) - parseTimeInput(start);

  return (
    <section className="manual">
      <button className="manual-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="manual-head-text">
          <strong>Add a class or commitment</strong>
          <span className="manual-head-sub">
            {series.length === 0
              ? 'Type it in — no calendar file needed'
              : `${series.length} added by hand`}
          </span>
        </span>
        <Chevron open={open} />
      </button>

      <div className="manual-body" data-open={open}>
        <div className="manual-body-inner">
          <div className="manual-form">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setProblem(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="CHEM 101 General Chemistry"
              />
            </label>

            <label className="field">
              <span className="field-label">Type</span>
              {/* Grouped so the fixed/flexible split is visible at the moment
                  it's chosen, rather than being a surprise on the grid. */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
              >
                <optgroup label="Blocks time">
                  {FIXED.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Optional — never blocks time">
                  {FLEXIBLE.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </optgroup>
              </select>
              <span className="field-hint">
                {CATEGORY_KIND[category] === 'fixed'
                  ? 'Blocks time and can raise a conflict'
                  : 'Shows in the optional lane, never a conflict'}
              </span>
            </label>

            <fieldset className="repeat-choice field-wide">
              <legend className="field-label">Does this repeat?</legend>
              <ChoiceOption
                on={repeats}
                onSelect={() => {
                  setRepeats(true);
                  setProblem(null);
                }}
                name="manual-repeats"
                title="Every week"
                sub="On the days you pick"
              />
              <ChoiceOption
                on={!repeats}
                onSelect={() => {
                  setRepeats(false);
                  setProblem(null);
                }}
                name="manual-repeats"
                title="Just once"
                sub="On one date — a final, an appointment"
              />
            </fieldset>

            {repeats ? (
              <div className="field field-wide">
                <span className="field-label">Repeats on</span>
                <WeekdayPicker
                  value={weekdays}
                  onChange={(next) => {
                    setWeekdays(next);
                    setProblem(null);
                  }}
                />
              </div>
            ) : (
              <div className="field field-wide">
                <span className="field-label">Date</span>
                <DatePicker
                  value={date}
                  onChange={(next) => {
                    setDate(next);
                    setProblem(null);
                  }}
                />
              </div>
            )}

            <label className="field">
              <span className="field-label">Starts</span>
              <input
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setProblem(null);
                }}
              />
            </label>

            <label className="field">
              <span className="field-label">Ends</span>
              <input
                type="time"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setProblem(null);
                }}
              />
              <span className="field-hint">
                {duration > 0 ? formatDuration(duration) : 'Must be after the start'}
              </span>
            </label>

            <label className="field field-wide">
              <span className="field-label">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Lecture Hall B (optional)"
              />
            </label>
          </div>

          {problem && <p className="manual-problem">{problem}</p>}

          <div className="manual-actions">
            <button className="btn primary" onClick={submit}>
              Add to schedule
            </button>
          </div>

          {(series.length > 0 || singles.length > 0) && (
            <ul className="series-list">
              {/* One-off commitments are listed here too. A final added in
                  August sits four months away on the grid, so without this the
                  panel would give no sign it had worked. */}
              {singles.map((event) => (
                <li key={event.id} className="series">
                  <span
                    className={`series-rail ${CATEGORY_KIND[event.category]}`}
                    aria-hidden="true"
                  />
                  <span className="series-main">
                    <span className="series-title">{event.title}</span>
                    <span className="series-meta">
                      <span className="series-once">Once</span>
                      {event.start.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      · {formatRange(event.start, event.end)}
                      {event.location ? ` · ${event.location}` : ''} ·{' '}
                      {CATEGORY_LABEL[event.category]}
                    </span>
                  </span>
                  <button
                    className="icon-btn danger"
                    onClick={() => onDeleteSingle(event.id)}
                    aria-label={`Remove ${event.title}`}
                    title="Remove"
                  >
                    <TrashGlyph />
                  </button>
                </li>
              ))}

              {series.map((s) => (
                <li key={s.seriesId} className="series">
                  <span className={`series-rail ${CATEGORY_KIND[s.category]}`} aria-hidden="true" />
                  <span className="series-main">
                    <span className="series-title">{s.title}</span>
                    <span className="series-meta">
                      {describeDays(s.weekdays)} · {toTimeInput(s.startMinutes)}–
                      {toTimeInput(s.endMinutes)}
                      {s.location ? ` · ${s.location}` : ''} · {CATEGORY_LABEL[s.category]}
                    </span>
                  </span>
                  <button
                    className="icon-btn danger"
                    onClick={() => onDelete(s.seriesId)}
                    aria-label={`Remove ${s.title}`}
                    title="Remove"
                  >
                    <TrashGlyph />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
