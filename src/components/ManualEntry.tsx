import { useState } from 'react';
import {
  CATEGORY_KIND,
  CATEGORY_LABEL,
  type ColorName,
  type EventCategory,
  type ScheduleEvent,
} from '../types/event';
import { automaticColorFor } from '../lib/colors';
import { extractCourseCode } from '../lib/categorize';
import {
  parseTimeInput,
  validateOnce,
  validateSeries,
  type ManualSeriesInput,
} from '../lib/manualEvents';
import { formatDuration, parseISODate, toISODate } from '../lib/time';
import ChoiceOption from './ChoiceOption';
import ColorPicker from './ColorPicker';
import DatePicker from './DatePicker';
import WeekdayPicker from './WeekdayPicker';

const FIXED: EventCategory[] = ['class', 'lab', 'exam', 'work', 'appointment'];
const FLEXIBLE: EventCategory[] = ['office-hours', 'study', 'tutoring'];

interface Props {
  /** How many commitments exist, for the summary line only. */
  count: number;
  defaultOpen: boolean;
  onAdd: (input: ManualSeriesInput) => void;
  onAddOnce: (input: Omit<ManualSeriesInput, 'weekdays'>, date: Date) => void;
}

export default function ManualEntry({ count, defaultOpen, onAdd, onAddOnce }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('class');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('09:50');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState<ColorName | null>(null);
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
      color: color ?? undefined,
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
    setColor(null);
    setProblem(null);
  };

  const duration = parseTimeInput(end) - parseTimeInput(start);

  // What the automatic slot would resolve to for what is being typed.
  const autoColor = automaticColorFor({
    title,
    category,
    courseCode: extractCourseCode(title),
  } as ScheduleEvent);

  return (
    <section className="manual">
      <button className="manual-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="manual-head-text">
          <strong>Add a class or commitment</strong>
          <span className="manual-head-sub">
            {count === 0
              ? 'Type it in — repeating or one-off'
              : `${count} on the schedule`}
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

            <div className="field field-wide">
              <span className="field-label">Colour</span>
              <ColorPicker value={color} onChange={setColor} automatic={autoColor} />
            </div>

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
