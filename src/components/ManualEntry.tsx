import { useState } from 'react';
import {
  CATEGORY_KIND,
  CATEGORY_LABEL,
  MAX_CATEGORY_LABEL,
  isOtherCategory,
  type ColorName,
  type EventCategory,
  type ScheduleEvent,
} from '../types/event';
import { automaticColorFor } from '../lib/colors';
import { extractCourseCode } from '../lib/categorize';
import {
  parseTimeInput,
  validateMoment,
  validateOnce,
  validateSeries,
  validateSpan,
  type ManualSeriesInput,
} from '../lib/manualEvents';
import { formatDuration, parseISODate, toISODate } from '../lib/time';
import ChoiceOption from './ChoiceOption';
import ColorPicker from './ColorPicker';
import DatePicker from './DatePicker';
import WeekdayPicker from './WeekdayPicker';
import Chevron from './Chevron';

// 'Other' sits last in each group: it is the escape hatch, and putting it
// anywhere else implies the named ones below it are somehow more obscure.
const FIXED: EventCategory[] = ['class', 'lab', 'exam', 'work', 'appointment', 'other'];
const FLEXIBLE: EventCategory[] = ['office-hours', 'study', 'tutoring', 'other-flexible'];

interface Props {
  /** How many commitments exist, for the summary line only. */
  count: number;
  defaultOpen: boolean;
  onAdd: (input: ManualSeriesInput) => void;
  onAddOnce: (input: Omit<ManualSeriesInput, 'weekdays'>, date: Date) => void;
  onAddMoment: (input: Omit<ManualSeriesInput, 'weekdays' | 'endMinutes'>, date: Date) => void;
  onAddSpan: (
    input: Omit<ManualSeriesInput, 'weekdays'>,
    from: Date,
    to: Date,
    allDay: boolean,
  ) => void;
}

/**
 * The four shapes a commitment can have.
 *
 * One radio group rather than a checkbox each, because they are genuinely
 * exclusive: a thing is a weekly class, or a single appointment, or several
 * days, or a moment. Combining them would mean answering what a repeating
 * moment across four days is supposed to be.
 */
type Mode = 'weekly' | 'once' | 'span' | 'moment';

export default function ManualEntry({
  count,
  defaultOpen,
  onAdd,
  onAddOnce,
  onAddMoment,
  onAddSpan,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('class');
  /** Kept while switching between the two 'other' entries, so the fixed/flexible
      choice can be changed without retyping the name. */
  const [categoryLabel, setCategoryLabel] = useState('');
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
  const [mode, setMode] = useState<Mode>('weekly');
  const [date, setDate] = useState(() => toISODate(new Date()));
  /** The last day of a span. Only read in span mode. */
  const [lastDate, setLastDate] = useState(() => toISODate(new Date()));
  /** Whole days rather than times — what a trip or a break usually is. */
  const [allDay, setAllDay] = useState(true);

  const chooseMode = (next: Mode) => {
    setMode(next);
    setProblem(null);
    // A span defaults to ending the day after it starts, so the form is never
    // showing an invalid single-day range the moment it opens.
    if (next === 'span' && parseISODate(lastDate) <= parseISODate(date)) {
      const nextDay = parseISODate(date);
      nextDay.setDate(nextDay.getDate() + 1);
      setLastDate(toISODate(nextDay));
    }
  };

  const submit = () => {
    const base = {
      title,
      category,
      categoryLabel,
      startMinutes: parseTimeInput(start),
      endMinutes: parseTimeInput(end),
      location,
      color: color ?? undefined,
    };

    const fail = (message: string | null) => {
      if (message) setProblem(message);
      return Boolean(message);
    };

    if (mode === 'weekly') {
      const input: ManualSeriesInput = { ...base, weekdays };
      if (fail(validateSeries(input))) return;
      onAdd(input);
    } else if (mode === 'once') {
      if (fail(validateOnce(base))) return;
      onAddOnce(base, parseISODate(date));
    } else if (mode === 'moment') {
      if (fail(validateMoment(base))) return;
      onAddMoment(base, parseISODate(date));
    } else {
      const from = parseISODate(date);
      const to = parseISODate(lastDate);
      if (fail(validateSpan(base, from, to, allDay))) return;
      onAddSpan(base, from, to, allDay);
    }

    setTitle('');
    setLocation('');
    setWeekdays([]);
    setColor(null);
    setProblem(null);
  };

  const duration = parseTimeInput(end) - parseTimeInput(start);

  /** A span with times crosses days, so its start and end are on different ones. */
  const showsEndTime = mode === 'weekly' || mode === 'once' || (mode === 'span' && !allDay);
  const showsStartTime = mode !== 'span' || !allDay;

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

      <div className="manual-body" data-open={open} inert={!open}>
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

            {/* Appears only once "Other" is chosen. A permanently visible box
                that is ignored eight times out of nine is worse than one that
                arrives when it has a job to do. */}
            {isOtherCategory(category) && (
              <label className="field field-wide">
                <span className="field-label">Call it</span>
                <input
                  value={categoryLabel}
                  onChange={(e) => {
                    setCategoryLabel(e.target.value);
                    setProblem(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Band practice, physio, shift…"
                  maxLength={MAX_CATEGORY_LABEL}
                  autoFocus
                />
                <span className="field-hint">
                  Your own name for this kind of commitment. Pick “Other” under the other
                  heading to change whether it blocks time.
                </span>
              </label>
            )}

            <fieldset className="repeat-choice field-wide four">
              <legend className="field-label">When is it?</legend>
              <ChoiceOption
                on={mode === 'weekly'}
                onSelect={() => chooseMode('weekly')}
                name="manual-mode"
                title="Every week"
                sub="On the days you pick"
              />
              <ChoiceOption
                on={mode === 'once'}
                onSelect={() => chooseMode('once')}
                name="manual-mode"
                title="Just once"
                sub="One date — a final, an appointment"
              />
              <ChoiceOption
                on={mode === 'span'}
                onSelect={() => chooseMode('span')}
                name="manual-mode"
                title="Across days"
                sub="A trip, a break, a conference"
              />
              <ChoiceOption
                on={mode === 'moment'}
                onSelect={() => chooseMode('moment')}
                name="manual-mode"
                title="Just a time"
                sub="No end — a flight, a train"
              />
            </fieldset>

            {mode === 'weekly' && (
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
            )}

            {(mode === 'once' || mode === 'moment') && (
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

            {mode === 'span' && (
              <>
                <div className="field">
                  <span className="field-label">First day</span>
                  <DatePicker
                    value={date}
                    onChange={(next) => {
                      setDate(next);
                      setProblem(null);
                    }}
                  />
                </div>

                <div className="field">
                  <span className="field-label">Last day</span>
                  <DatePicker
                    value={lastDate}
                    onChange={(next) => {
                      setLastDate(next);
                      setProblem(null);
                    }}
                  />
                  <span className="field-hint">{spanHint(date, lastDate)}</span>
                </div>

                <label className="field field-wide switch-row">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => {
                      setAllDay(e.target.checked);
                      setProblem(null);
                    }}
                  />
                  <span>
                    All day
                    <span className="field-hint">
                      {/* Whole days is the common case and the one that needs no
                          times at all; leaving must-fill time inputs on screen
                          for a week-long break is asking a question with no
                          answer. */}
                      {allDay
                        ? 'Covers every day end to end'
                        : 'Starts on the first day, ends on the last'}
                    </span>
                  </span>
                </label>
              </>
            )}

            {showsStartTime && (
              <label className="field">
                <span className="field-label">
                  {mode === 'moment' ? 'At' : mode === 'span' ? 'Starts (first day)' : 'Starts'}
                </span>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setProblem(null);
                  }}
                />
                {mode === 'moment' && (
                  <span className="field-hint">Marks the time. Never blocks any.</span>
                )}
              </label>
            )}

            {showsEndTime && (
              <label className="field">
                <span className="field-label">{mode === 'span' ? 'Ends (last day)' : 'Ends'}</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setProblem(null);
                  }}
                />
                <span className="field-hint">
                  {/* Across days an earlier end time is not a mistake: out
                      Friday evening, back Sunday morning. */}
                  {mode === 'span'
                    ? 'May be earlier in the day than the start'
                    : duration > 0
                      ? formatDuration(duration)
                      : 'Must be after the start'}
                </span>
              </label>
            )}

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

/** "3 days" while a span is being picked, or what is wrong with the dates. */
function spanHint(first: string, last: string): string {
  const from = parseISODate(first);
  const to = parseISODate(last);
  const days = Math.round((+to - +from) / 86400000) + 1;
  if (days < 1) return 'Before the first day';
  if (days === 1) return 'Same day — pick a later one';
  return `${days} days`;
}
