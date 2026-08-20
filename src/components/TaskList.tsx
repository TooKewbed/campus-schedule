import { useMemo, useState } from 'react';
import { openCount, type Task } from '../types/task';
import type { Repeat } from '../lib/repeat';
import {
  defaultDeadline,
  describeDeadline,
  endOfDay,
  fromDueParts,
  groupTasks,
  overdueCount,
  toDueParts,
} from '../lib/deadlines';
import { coursesWithTasks, tasksForCourse, splitCourseFromTitle, type Course } from '../lib/courses';
import type { RemindersApi } from '../hooks/useReminders';
import { isRepeat, REPEAT_LABEL, REPEAT_OPTIONS, describeRepeat } from '../lib/repeat';
import DatePicker from './DatePicker';

interface Props {
  tasks: Task[];
  now: Date;
  /** Every course the app knows about, for tagging and filtering. */
  courses: Course[];
  reminders: RemindersApi;
  onAdd: (title: string, courseCode?: string) => void;
  onToggle: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDueChange: (id: string, due: Date | null) => void;
  onCourseChange: (id: string, code: string | null) => void;
  onRepeatChange: (id: string, repeat: Repeat | null) => void;
  onDelete: (id: string) => void;
}

/** Which disclosure a row has open. Only ever one, so the row stays legible. */
type Panel = 'details' | 'due';

export default function TaskList({
  tasks,
  now,
  courses,
  reminders,
  onAdd,
  onToggle,
  onNotesChange,
  onDueChange,
  onCourseChange,
  onRepeatChange,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState('');
  const [panels, setPanels] = useState<Record<string, Panel | undefined>>({});
  const [filter, setFilter] = useState<string | null>(null);

  const colorOf = useMemo(() => {
    const map = new Map(courses.map((c) => [c.code, c.color]));
    return (code: string) => map.get(code) ?? 'blue';
  }, [courses]);

  // Only courses that actually have tasks: a filter listing classes with
  // nothing against them is a menu of dead ends.
  const filterable = useMemo(() => coursesWithTasks(courses, tasks), [courses, tasks]);
  const visible = useMemo(() => tasksForCourse(tasks, filter), [tasks, filter]);
  const groups = useMemo(() => groupTasks(visible), [visible]);

  const remaining = openCount(tasks);
  const late = overdueCount(tasks, now);

  const submit = () => {
    if (!draft.trim()) return;
    // "CHEM 101 lab report" files itself under the course and keeps "lab
    // report" as the title. Typing is faster than reaching for a menu, and the
    // menu is still there for anything it misses.
    const { courseCode, title } = splitCourseFromTitle(
      draft,
      courses.map((c) => c.code),
    );
    onAdd(title, courseCode);
    setDraft('');
  };

  const togglePanel = (id: string, panel: Panel) => {
    setPanels((prev) => ({ ...prev, [id]: prev[id] === panel ? undefined : panel }));
  };

  /**
   * The clock button.
   *
   * On a task with no deadline this assigns one — today, end of day — as well
   * as opening the editor. One press therefore does the thing it is named for:
   * the item becomes time-sensitive and visibly moves into that section, which
   * is the feedback the feature needs. Leaving it uncommitted until a date was
   * picked would mean a press that appeared to do nothing, and the editor
   * carries a Remove for anyone who pressed it by mistake.
   */
  const clock = (task: Task) => {
    if (!task.dueDate) onDueChange(task.id, defaultDeadline(now));
    setPanels((prev) => ({ ...prev, [task.id]: prev[task.id] === 'due' ? undefined : 'due' }));
  };

  const countLabel =
    tasks.length === 0
      ? 'Nothing yet'
      : remaining === 0
        ? 'All done'
        : late > 0
          ? `${late} overdue`
          : `${remaining} remaining`;

  const row = (task: Task) => {
    const panel = panels[task.id];
    const deadline = task.dueDate ? describeDeadline(task.dueDate, now) : null;

    return (
      <li key={task.id} className={`task${task.done ? ' done' : ''}`}>
        <div className="task-row">
          <button
            className="check"
            role="checkbox"
            aria-checked={task.done}
            aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
            onClick={() => onToggle(task.id)}
          >
            <CheckGlyph />
          </button>

          {/* Title and chips stack rather than sit side by side. The row lives
              in a 300px column and already carries three buttons; chips
              competing for the same line left the title about sixty pixels,
              which `overflow-wrap: anywhere` then broke mid-word. */}
          <div className="task-main">
            <button
              className="task-title"
              onClick={() => togglePanel(task.id, 'details')}
              aria-expanded={panel === 'details'}
            >
              <span className="task-text">{task.title}</span>
              {/* Collapsed rows still surface that a note exists, and what it
                  says — a hidden note is a forgotten note. */}
              {task.notes.trim() && panel !== 'details' && (
                <span className="task-note-preview">{task.notes.trim()}</span>
              )}
            </button>

            {(task.courseCode || deadline || task.repeat) && (
              <span className="task-flags">
                {task.courseCode && (
                  <span className={`course-chip color-${colorOf(task.courseCode)}`}>
                    {task.courseCode}
                  </span>
                )}
                {deadline && (
                  <span className={`due-chip urgency-${deadline.urgency}`} title={deadline.full}>
                    {deadline.label}
                  </span>
                )}
                {/* A repeating task looks like any other until it comes back,
                    which is a surprise the row can cheaply avoid. */}
                {task.repeat && (
                  <span className="repeat-chip" title={describeRepeat(task) ?? undefined}>
                    <RepeatGlyph />
                    {REPEAT_LABEL[task.repeat]}
                  </span>
                )}
              </span>
            )}
          </div>

          <button
            className={`icon-btn${panel === 'due' ? ' active' : ''}${
              deadline && !task.done ? ` due-${deadline.urgency}` : ''
            }`}
            onClick={() => clock(task)}
            aria-expanded={panel === 'due'}
            aria-label={
              task.dueDate
                ? `Change deadline for "${task.title}" — ${deadline?.full}`
                : `Give "${task.title}" a deadline`
            }
            title={task.dueDate ? deadline?.full : 'Add a deadline'}
          >
            <ClockGlyph set={Boolean(task.dueDate)} />
          </button>

          <button
            className={`icon-btn${panel === 'details' ? ' active' : ''}`}
            onClick={() => togglePanel(task.id, 'details')}
            aria-label={`Course and notes for "${task.title}"`}
            title="Details"
          >
            <NoteGlyph filled={Boolean(task.notes.trim() || task.courseCode)} />
          </button>

          <button
            className="icon-btn danger"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete "${task.title}"`}
            title="Delete"
          >
            <TrashGlyph />
          </button>
        </div>

        {/* inert while closed: the panel is only visually collapsed, so its
            select and textarea would otherwise still be reachable by Tab —
            a keyboard user landing in fields they cannot see. */}
        <div className="task-notes" data-open={panel === 'details'} inert={panel !== 'details'}>
          <div className="task-notes-inner">
            <div className="task-notes-pad">
              {courses.length > 0 && (
                <label className="field task-course">
                  <span className="field-label">Course</span>
                  <select
                    value={task.courseCode ?? ''}
                    onChange={(e) => onCourseChange(task.id, e.target.value || null)}
                  >
                    <option value="">No course</option>
                    {courses.map((course) => (
                      <option key={course.code} value={course.code}>
                        {course.code}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <textarea
                value={task.notes}
                onChange={(e) => onNotesChange(task.id, e.target.value)}
                placeholder="Add a note"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="task-notes" data-open={panel === 'due'} inert={panel !== 'due'}>
          <div className="task-notes-inner">
            <DeadlineEditor
              task={task}
              now={now}
              onChange={(due) => onDueChange(task.id, due)}
              onRepeatChange={(repeat) => onRepeatChange(task.id, repeat)}
              onClose={() => setPanels((prev) => ({ ...prev, [task.id]: undefined }))}
            />
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="tasks">
      <div className="tasks-head">
        <h2>To-do</h2>
        <div className="tasks-head-right">
          <span className={`count${late > 0 ? ' overdue' : ''}`}>{countLabel}</span>
          <ReminderToggle reminders={reminders} />
        </div>
      </div>

      <div className="task-card">
        <div className="task-add">
          <span className="task-add-glyph" aria-hidden="true">+</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setDraft('');
            }}
            placeholder="Add a task"
            aria-label="Add a task"
          />
          {draft.trim() && (
            <button className="btn primary tiny" onClick={submit}>
              Add
            </button>
          )}
        </div>

        {/* Worth showing only once there is more than one thing to choose
            between; with a single course it filters nothing. */}
        {filterable.length > 1 && (
          <div className="task-filter">
            <select
              value={filter ?? ''}
              aria-label="Filter by course"
              onChange={(e) => setFilter(e.target.value || null)}
            >
              <option value="">All courses</option>
              {filterable.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code}
                </option>
              ))}
            </select>
            {filter && (
              <button className="linkish" onClick={() => setFilter(null)}>
                Clear
              </button>
            )}
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="task-empty">
            Anything that isn&rsquo;t tied to a time slot — errands, emails, readings.
            Start one with a course code and it files itself.
          </p>
        ) : visible.length === 0 ? (
          <p className="task-empty">Nothing for {filter} yet.</p>
        ) : (
          <>
            {/* Headings appear only over a section that has something in it.
                An empty "Time sensitive" heading is a promise the list is not
                keeping. */}
            {groups.timed.length > 0 && (
              <>
                <h3 className="task-section urgent">
                  Time sensitive
                  <span>{groups.timed.length}</span>
                </h3>
                <ul className="task-list">{groups.timed.map(row)}</ul>
              </>
            )}

            {groups.anytime.length > 0 && (
              <>
                {groups.timed.length > 0 && (
                  <h3 className="task-section">
                    Anytime
                    <span>{groups.anytime.length}</span>
                  </h3>
                )}
                <ul className="task-list">{groups.anytime.map(row)}</ul>
              </>
            )}

            {groups.done.length > 0 && (
              <>
                <h3 className="task-section">
                  Done
                  <span>{groups.done.length}</span>
                </h3>
                <ul className="task-list">{groups.done.map(row)}</ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ reminders -- */

function ReminderToggle({ reminders }: { reminders: RemindersApi }) {
  if (reminders.permission === 'unsupported') return null;

  const blocked = reminders.permission === 'denied';
  const label = blocked
    ? 'Notifications are blocked for this site in your browser settings'
    : reminders.enabled
      ? 'Deadline reminders are on. They arrive while Skedge is open — install it to keep it running.'
      : 'Remind me about deadlines while Skedge is open';

  return (
    <button
      className={`icon-btn${reminders.enabled ? ' active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={reminders.enabled}
      disabled={blocked}
      onClick={() => (reminders.enabled ? reminders.disable() : void reminders.enable())}
    >
      <BellGlyph on={reminders.enabled} muted={blocked} />
    </button>
  );
}

/* --------------------------------------------------------------- editor -- */

interface EditorProps {
  task: Task;
  now: Date;
  onChange: (due: Date | null) => void;
  onRepeatChange: (repeat: Repeat | null) => void;
  onClose: () => void;
}

function DeadlineEditor({ task, now, onChange, onRepeatChange, onClose }: EditorProps) {
  const due = task.dueDate ?? defaultDeadline(now);
  const parts = toDueParts(due);

  const shift = (days: number) => {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    // Keeps whatever time is already set; only the day moves.
    target.setHours(due.getHours(), due.getMinutes(), 0, 0);
    onChange(target);
  };

  return (
    <div className="due-editor">
      <div className="due-quick">
        <button className="btn tiny" onClick={() => shift(0)}>
          Today
        </button>
        <button className="btn tiny" onClick={() => shift(1)}>
          Tomorrow
        </button>
        <button className="btn tiny" onClick={() => shift(7)}>
          Next week
        </button>
      </div>

      <div className="due-fields">
        <label className="field">
          <span className="field-label">Due</span>
          <DatePicker
            value={parts.date}
            onChange={(iso) => {
              const next = fromDueParts(iso, parts.time);
              if (next) onChange(next);
            }}
          />
        </label>

        <label className="field">
          <span className="field-label">Time</span>
          <input
            type="time"
            value={parts.time}
            onChange={(e) => {
              const next = fromDueParts(parts.date, e.target.value);
              if (next) onChange(next);
            }}
          />
          <span className="field-hint">
            {/* Says what the default actually means, so 11:59 PM does not look
                like a value someone has to think about. */}
            11:59 PM means end of day
          </span>
        </label>
      </div>

      <label className="field due-repeat">
        <span className="field-label">Repeat</span>
        <select
          value={task.repeat ?? ''}
          onChange={(e) => onRepeatChange(isRepeat(e.target.value) ? e.target.value : null)}
        >
          {REPEAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {task.repeat && (
          <span className="field-hint">
            {/* Says when the next one appears, because "every week" alone does
                not explain why nothing showed up yet. */}
            Ticking it off creates the next one.
          </span>
        )}
      </label>

      <div className="due-actions">
        <button className="linkish" onClick={() => onChange(endOfDay(due))}>
          Clear the time
        </button>
        <button
          className="linkish danger"
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          Remove deadline
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- glyphs -- */

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockGlyph({ set }: { set: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.9V8.2l2.2 1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={set ? 1 : 0.55}
      />
    </svg>
  );
}

function BellGlyph({ on, muted }: { on: boolean; muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 11V7.2a4 4 0 1 1 8 0V11l1 1.4H3L4 11Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity={on ? 1 : 0.75}
      />
      <path d="M6.6 13.4a1.6 1.6 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {muted && <path d="M2.6 2.6l10.8 10.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

function NoteGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 6.5h5M5.5 9.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={filled ? 1 : 0.55}
      />
    </svg>
  );
}

function RepeatGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 7a5 5 0 0 1 8.5-3.5M13 9a5 5 0 0 1-8.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M11.5 1.8v2.2H9.3M4.5 14.2V12h2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
