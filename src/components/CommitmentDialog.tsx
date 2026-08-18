import { useEffect, useRef, useState } from 'react';
import { CATEGORY_KIND, CATEGORY_LABEL, type EventCategory, type ScheduleEvent } from '../types/event';
import {
  countOccurrences,
  minutesOfDate,
  parseTimeInput,
  toTimeInput,
  type CommitmentValues,
} from '../lib/manualEvents';
import { addDays, formatDuration, startOfDay } from '../lib/time';
import { describeDays } from '../lib/weekdays';
import WeekdayPicker from './WeekdayPicker';
import SegmentedControl from './SegmentedControl';
import type { DraftRange } from './DayGrid';

/** Creating from a dragged range, or editing an existing block. */
export type CommitmentTarget =
  | { mode: 'create'; range: DraftRange }
  | {
      mode: 'edit';
      event: ScheduleEvent;
      seriesWeekdays: number[];
      /** Last day the series currently runs, if it is one. */
      seriesUntil: Date | null;
    };

export type EditScope = 'one' | 'all';

interface Props {
  target: CommitmentTarget | null;
  /** The day being viewed — seeds the repeat selection. */
  date: Date;
  onDismiss: () => void;
  onCreate: (
    values: CommitmentValues,
    repeats: boolean,
    weekdays: number[],
    until: Date | null,
  ) => void;
  onEdit: (
    event: ScheduleEvent,
    values: CommitmentValues,
    scope: EditScope,
    weekdays: number[],
    until: Date | null,
  ) => void;
}

/** Roughly one semester — the common case, adjustable from the dialog. */
const DEFAULT_TERM_DAYS = 112;

type EndMode = 'date' | 'never';

const END_MODE_OPTIONS: { value: EndMode; label: string }[] = [
  { value: 'date', label: 'Ends on' },
  { value: 'never', label: 'No end' },
];

const FIXED: EventCategory[] = ['class', 'lab', 'exam', 'work', 'appointment'];
const FLEXIBLE: EventCategory[] = ['office-hours', 'study', 'tutoring'];

/**
 * One dialog for both creating and editing, so a commitment looks and behaves
 * the same whichever direction you came from. The only difference is the
 * question at the bottom: new blocks ask whether they repeat, existing ones ask
 * how far a change should reach.
 */
export default function CommitmentDialog({ target, date, onDismiss, onCreate, onEdit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<CommitmentTarget | null>(target);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('class');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [repeats, setRepeats] = useState(true);
  const [scope, setScope] = useState<EditScope>('all');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState('');
  const [endMode, setEndMode] = useState<EndMode>('date');
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * A stable identity for "which thing is this dialog open on".
   *
   * The `target` prop is rebuilt as a fresh object on every parent render — and
   * the parent re-renders on a 30-second timer for the now-line — so keying the
   * seeding effect on the object itself would re-seed constantly and wipe out
   * whatever had been typed. Keying on a value that only changes when the
   * dialog is genuinely opened on something else fixes that at the source.
   */
  const targetKey = target
    ? target.mode === 'create'
      ? `create:${target.range.kind}:${target.range.startMinutes}:${target.range.endMinutes}`
      : `edit:${target.event.id}`
    : null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (target) {
      setShown(target);
      setProblem(null);

      if (target.mode === 'create') {
        setTitle('');
        setLocation('');
        setStart(toTimeInput(target.range.startMinutes));
        setEnd(toTimeInput(target.range.endMinutes));
        // The lane you drew in decides whether this blocks time.
        setCategory(target.range.kind === 'fixed' ? 'class' : 'office-hours');
        setRepeats(true);
        // Seed with the day you drew on; add others from there.
        setWeekdays([date.getDay()]);
        setUntil(toISODate(addDays(date, DEFAULT_TERM_DAYS)));
        setEndMode('date');
      } else {
        const e = target.event;
        setTitle(e.title);
        setLocation(e.location ?? '');
        setStart(toTimeInput(minutesOfDate(e.start)));
        setEnd(toTimeInput(minutesOfDate(e.end)));
        setCategory(e.category);
        setScope(e.seriesId ? 'all' : 'one');
        setWeekdays(
          target.seriesWeekdays.length > 0 ? target.seriesWeekdays : [e.start.getDay()],
        );
        setUntil(toISODate(target.seriesUntil ?? addDays(e.start, DEFAULT_TERM_DAYS)));
        setEndMode('date');
      }

      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
    // Deliberately keyed on targetKey, not target — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const startMinutes = parseTimeInput(start);
  const endMinutes = parseTimeInput(end);
  const duration = endMinutes - startMinutes;
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });

  const editing = shown?.mode === 'edit';
  const recurring = shown?.mode === 'edit' && Boolean(shown.event.seriesId);

  const endsOnDate = endMode === 'date';
  const untilDate = parseISODate(until, date);
  const occurrences = endsOnDate ? countOccurrences(weekdays, date, untilDate) : 0;

  const summary = !endsOnDate
    ? `${describeDays(weekdays)} · runs as far ahead as the calendar goes`
    : occurrences === 0
      ? 'No sessions in that range'
      : `${describeDays(weekdays)} · ${occurrences} session${occurrences === 1 ? '' : 's'}`;

  const submit = () => {
    if (!title.trim()) {
      setProblem('Give it a name.');
      return;
    }
    if (duration <= 0) {
      setProblem('The end time must be after the start time.');
      return;
    }

    const repeating = editing ? recurring && scope === 'all' : repeats;
    if (repeating && weekdays.length === 0) {
      setProblem('Pick at least one day of the week.');
      return;
    }
    if (repeating && endsOnDate) {
      if (untilDate < startOfDay(date)) {
        setProblem('The repeat end date is before the commitment starts.');
        return;
      }
      if (occurrences === 0) {
        setProblem('Those days never come up before the end date.');
        return;
      }
    }

    // null means "no end date" — the expansion then runs to the window's edge.
    const endsAt = endsOnDate ? untilDate : null;
    const values: CommitmentValues = { title, category, location, startMinutes, endMinutes };
    if (shown?.mode === 'edit') {
      onEdit(shown.event, values, recurring ? scope : 'one', weekdays, endsAt);
    } else {
      onCreate(values, repeats, weekdays, endsAt);
    }
  };

  return (
    <dialog ref={ref} className="confirm sheet" onClose={onDismiss}>
      <div className="confirm-inner">
        <h2>{editing ? 'Edit commitment' : 'New commitment'}</h2>
        <p className="confirm-when">
          {weekday} · {toTimeInput(startMinutes)}–{toTimeInput(endMinutes)}
          {duration > 0 ? ` · ${formatDuration(duration)}` : ''}
        </p>

        <div className="manual-form sheet-form">
          <label className="field field-wide">
            <span className="field-label">Name</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={CATEGORY_KIND[category] === 'fixed' ? 'CHEM 101 Lab' : 'Office hours'}
            />
          </label>

          <label className="field">
            <span className="field-label">Type</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
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
          </label>

          <label className="field">
            <span className="field-label">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Optional"
            />
          </label>

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
          </label>
        </div>

        {!editing && (
          <>
            <fieldset className="repeat-choice">
              <legend className="field-label">Does this repeat?</legend>
              <Choice
                on={repeats}
                onSelect={() => setRepeats(true)}
                name="repeats"
                title="Every week"
                sub="On the days you pick"
              />
              <Choice
                on={!repeats}
                onSelect={() => setRepeats(false)}
                name="repeats"
                title="Just once"
                sub={`Only this ${weekday}`}
              />
            </fieldset>

            {repeats && (
              <div className="field repeat-days">
                <span className="field-label">Repeats on</span>
                <WeekdayPicker
                  value={weekdays}
                  onChange={(next) => {
                    setWeekdays(next);
                    setProblem(null);
                  }}
                />
                <div className="repeat-until">
                  <SegmentedControl
                    label="How long it repeats"
                    options={END_MODE_OPTIONS}
                    value={endMode}
                    onChange={(next) => {
                      setEndMode(next);
                      setProblem(null);
                    }}
                  />
                  {endMode === 'date' && (
                    <input
                      type="date"
                      className="until-input"
                      value={until}
                      // Blocks the obvious mistake in the native picker; the
                      // submit check still covers a typed-in past date.
                      min={toISODate(startOfDay(date))}
                      aria-label="Repeat end date"
                      onChange={(e) => {
                        setUntil(e.target.value);
                        setProblem(null);
                      }}
                    />
                  )}
                  <span className="field-hint">{summary}</span>
                </div>
              </div>
            )}
          </>
        )}

        {recurring && (
          <>
            <fieldset className="repeat-choice">
              <legend className="field-label">Apply changes to</legend>
              <Choice
                on={scope === 'one'}
                onSelect={() => setScope('one')}
                name="scope"
                title="This one only"
                sub="Splits it off from the series"
              />
              <Choice
                on={scope === 'all'}
                onSelect={() => setScope('all')}
                name="scope"
                title="All occurrences"
                sub="Whole series, days included"
              />
            </fieldset>

            {scope === 'all' && (
              <div className="field repeat-days">
                <span className="field-label">Repeats on</span>
                <WeekdayPicker
                  value={weekdays}
                  onChange={(next) => {
                    setWeekdays(next);
                    setProblem(null);
                  }}
                />
                <div className="repeat-until">
                  <SegmentedControl
                    label="How long it repeats"
                    options={END_MODE_OPTIONS}
                    value={endMode}
                    onChange={(next) => {
                      setEndMode(next);
                      setProblem(null);
                    }}
                  />
                  {endMode === 'date' && (
                    <input
                      type="date"
                      className="until-input"
                      value={until}
                      // Blocks the obvious mistake in the native picker; the
                      // submit check still covers a typed-in past date.
                      min={toISODate(startOfDay(date))}
                      aria-label="Repeat end date"
                      onChange={(e) => {
                        setUntil(e.target.value);
                        setProblem(null);
                      }}
                    />
                  )}
                  <span className="field-hint">{summary}</span>
                </div>
              </div>
            )}
          </>
        )}

        {problem && <p className="manual-problem flush">{problem}</p>}

        <div className="confirm-actions">
          <button className="btn plain" onClick={onDismiss}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Choice({
  on,
  onSelect,
  name,
  title,
  sub,
}: {
  on: boolean;
  onSelect: () => void;
  name: string;
  title: string;
  sub: string;
}) {
  return (
    <label className={`repeat-option${on ? ' on' : ''}`}>
      <input type="radio" name={name} checked={on} onChange={onSelect} />
      <span>
        <strong>{title}</strong>
        <span className="repeat-sub">{sub}</span>
      </span>
    </label>
  );
}

/** Parsed from parts — `new Date(string)` reads YYYY-MM-DD as UTC midnight. */
function parseISODate(value: string, fallback: Date): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return startOfDay(fallback);
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
