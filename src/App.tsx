import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScheduleEvent } from './types/event';
import { createTask, openCount, type Task } from './types/task';
import { createMarker, markersOn, type DayMarker } from './types/dayMarker';
import { detectConflicts } from './lib/conflicts';
import { usFederalHolidays } from './lib/holidays';
import { findFreeWindows } from './lib/freeTime';
import { GRID } from './lib/layout';
import {
  applyValues,
  createSingleCommitment,
  expandManualSeries,
  seriesEndDate,
  singleCommitments,
  summarizeManualSeries,
  type CommitmentValues,
  type ManualSeriesInput,
} from './lib/manualEvents';
import { addDays, formatDayHeading, sameDay, startOfDay, startOfWeek } from './lib/time';
import { normalizeDays, sameDays } from './lib/weekdays';
import {
  loadEvents,
  loadMarkers,
  loadShowHolidays,
  loadTasks,
  saveEvents,
  saveMarkers,
  saveShowHolidays,
  saveTasks,
} from './lib/storage';
import ConfirmDeleteDialog from './components/ConfirmDeleteDialog';
import DayGrid, { type DraftRange } from './components/DayGrid';
import CommitmentList from './components/CommitmentList';
import DayBrief from './components/DayBrief';
import DayNotes from './components/DayNotes';
import CommitmentDialog, {
  type CommitmentTarget,
  type EditScope,
} from './components/CommitmentDialog';
import ImportantDates from './components/ImportantDates';
import ManualEntry from './components/ManualEntry';
import SegmentedControl from './components/SegmentedControl';
import ShareDialog from './components/ShareDialog';
import SignIn from './components/SignIn';
import StatTiles from './components/StatTiles';
import SyncStatus from './components/SyncStatus';
import TaskList from './components/TaskList';
import WeekStrip from './components/WeekStrip';
import { useSync } from './hooks/useSync';
import { isSupabaseConfigured, supabase } from './lib/supabase';

/** How far around today recurring events get expanded on import. */
const EXPAND_BACK_DAYS = 30;
const EXPAND_FORWARD_DAYS = 210;

type Appearance = 'system' | 'light' | 'dark';

/**
 * One reversible step, stored as the events array from before the change.
 *
 * A snapshot rather than a diff: the array holds shared references, so a step
 * costs one array copy, and every mutation — add, edit, delete — becomes
 * undoable through the same path instead of each needing its own inverse.
 * In memory only; undo doesn't survive a reload.
 */
interface UndoEntry {
  label: string;
  events: ScheduleEvent[];
}

/** Deep history isn't useful here, and unbounded history is a memory leak. */
const UNDO_LIMIT = 20;

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function App() {
  const [events, setEvents] = useState<ScheduleEvent[]>(() => loadEvents());
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [markers, setMarkers] = useState<DayMarker[]>(() => loadMarkers());
  const [showHolidays, setShowHolidays] = useState<boolean>(() => loadShowHolidays());
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [appearance, setAppearance] = useState<Appearance>('system');
  const [scrolled, setScrolled] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ScheduleEvent | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [pendingCreate, setPendingCreate] = useState<DraftRange | null>(null);
  const [pendingEdit, setPendingEdit] = useState<ScheduleEvent | null>(null);
  const [sharing, setSharing] = useState(false);

  // Mirrors the four persisted collections to the account when signed in, and
  // pulls them back down on a new device. Local state stays authoritative for
  // rendering; this only follows it.
  const sync = useSync(
    { events, tasks, markers, showHolidays },
    { setEvents, setTasks, setMarkers, setShowHolidays },
  );

  // Lets handlers record an undo step without taking `events` as a dependency,
  // which would rebuild them on every schedule change.
  const snapshotRef = useRef<(label: string) => void>(() => {});

  // Keep the "now" line and countdowns honest without re-rendering constantly.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Persisting from one effect means every mutation is saved by construction —
  // no handler can forget to call save.
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveEvents(events);
  }, [events]);

  useEffect(() => {
    saveMarkers(markers);
  }, [markers]);

  useEffect(() => {
    saveShowHolidays(showHolidays);
  }, [showHolidays]);

  // "system" leaves the attribute off entirely so prefers-color-scheme decides.
  useEffect(() => {
    const root = document.documentElement;
    if (appearance === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', appearance);
  }, [appearance]);

  // The toolbar hairline is a scroll edge effect — it exists only while
  // content is actually passing underneath the chrome.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const today = useMemo(() => startOfDay(now), [now]);
  const isToday = sameDay(selected, today);

  /** A commitment on one specific date, entered rather than drawn on the grid. */
  const addSingle = useCallback(
    (input: Omit<ManualSeriesInput, 'weekdays'>, date: Date) => {
      snapshotRef.current(`adding ${input.title.trim()}`);
      // Passed whole rather than field by field: listing the fields here means
      // every new one has to be remembered in a second place, and the colour
      // was already being dropped that way.
      setEvents((prev) => [...prev, createSingleCommitment(input, date)]);
    },
    [],
  );

  const deleteEvent = useCallback((id: string) => {
    snapshotRef.current('removing a commitment');
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addSeries = useCallback(
    (input: ManualSeriesInput) => {
      const anchor = startOfWeek(new Date());
      snapshotRef.current(`adding ${input.title.trim()}`);
      setEvents((prev) => [
        ...prev,
        ...expandManualSeries(
          input,
          addDays(anchor, -EXPAND_BACK_DAYS),
          addDays(anchor, EXPAND_FORWARD_DAYS),
        ),
      ]);
    },
    [],
  );

  // A block drawn on the grid becomes either one event on that day, or a weekly
  // series on that weekday — the choice the dialog exists to ask.
  const createFromDraft = useCallback(
    (values: CommitmentValues, repeats: boolean, weekdays: number[], until: Date | null) => {
      snapshotRef.current(`adding ${values.title.trim()}`);

      // The form says null for "automatic"; an event says the field is absent.
      const input = { ...values, color: values.color ?? undefined };

      if (repeats) {
        const anchor = startOfWeek(new Date());
        setEvents((prev) => [
          ...prev,
          ...expandManualSeries(
            { ...input, weekdays, until: until ?? undefined },
            addDays(anchor, -EXPAND_BACK_DAYS),
            addDays(anchor, EXPAND_FORWARD_DAYS),
          ),
        ]);
      } else {
        setEvents((prev) => [...prev, createSingleCommitment(input, selected)]);
      }

      setPendingCreate(null);
    },
    [selected],
  );

  /** Call immediately before mutating events, with what the step is called. */
  const snapshot = useCallback(
    (label: string) => {
      setUndoStack((prev) => [...prev, { label, events }].slice(-UNDO_LIMIT));
    },
    [events],
  );
  snapshotRef.current = snapshot;

  const editEvent = useCallback(
    (
      event: ScheduleEvent,
      values: CommitmentValues,
      scope: EditScope,
      weekdays: number[],
      until: Date | null,
    ) => {
      snapshot(`editing ${event.title}`);
      const seriesId = event.seriesId;

      if (scope === 'all' && seriesId) {
        const current = events.filter((e) => e.seriesId === seriesId).map((e) => e.start.getDay());
        const currentUntil = seriesEndDate(events, seriesId);
        // A null end date means "no end", which only differs from the current
        // series if that series was in fact bounded short of the window.
        const untilChanged = until ? !currentUntil || !sameDay(currentUntil, until) : false;

        // Changing which days it lands on, or how long it runs, can't be a field
        // update — the set of occurrences itself changes — so it is rebuilt.
        if (!sameDays(current, weekdays) || untilChanged) {
          const anchor = startOfWeek(new Date());
          setEvents((prev) => [
            ...prev.filter((e) => e.seriesId !== seriesId),
            ...expandManualSeries(
              {
                ...values,
                // Same null-to-absent conversion as when creating.
                color: values.color ?? undefined,
                weekdays,
                until: until ?? undefined,
              },
              addDays(anchor, -EXPAND_BACK_DAYS),
              addDays(anchor, EXPAND_FORWARD_DAYS),
            ),
          ]);
        } else {
          setEvents((prev) =>
            prev.map((e) => (e.seriesId === seriesId ? applyValues(e, values) : e)),
          );
        }

        setPendingEdit(null);
        return;
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? // Editing a single occurrence detaches it from its series, so a
              // later change to the series can't silently overwrite it again.
              { ...applyValues(e, values), seriesId: undefined, recurring: false }
            : e,
        ),
      );
      setPendingEdit(null);
    },
    [events, snapshot],
  );

  // Because recurring events are stored as expanded occurrences, removing one
  // instance and removing the whole series are the same operation on a
  // different key — no exception-tracking needed.
  const confirmDeleteOccurrence = useCallback(
    (event: ScheduleEvent) => {
      snapshot(`removing ${event.title}`);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setPendingDelete(null);
    },
    [snapshot],
  );

  // Shared by the confirmation dialog and the hand-entered series list, so
  // every removal is undoable regardless of which control triggered it.
  const deleteSeries = useCallback(
    (seriesId: string) => {
      const removed = events.filter((e) => e.seriesId === seriesId);
      snapshot(`removing ${removed[0]?.title ?? "commitment"}`);
      setEvents((prev) => prev.filter((e) => e.seriesId !== seriesId));
      setPendingDelete(null);
    },
    [events, snapshot],
  );

  const undo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    setEvents(last.events);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack]);

  const undoLabel = useMemo(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return null;
    return `Undo ${last.label}`;
  }, [undoStack]);

  // Cmd/Ctrl+Z, but never while typing — the browser's own text undo wins there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (undoStack.length === 0) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, undoStack.length]);

  const addTask = useCallback((title: string) => {
    setTasks((prev) => [...prev, createTask(title)]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedAt: t.done ? null : new Date() } : t,
      ),
    );
  }, []);

  const setTaskNotes = useCallback((id: string, notes: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, notes } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dayEvents = useMemo(
    () => events.filter((e) => sameDay(e.start, selected)),
    [events, selected],
  );

  const conflicts = useMemo(() => detectConflicts(dayEvents), [dayEvents]);

  const manualSeries = useMemo(() => summarizeManualSeries(events), [events]);
  const manualSingles = useMemo(() => singleCommitments(events), [events]);

  // Editing wins if both are somehow pending — you can't drag a new block and
  // click an existing one at the same time.
  const dialogTarget: CommitmentTarget | null = useMemo(() => {
    if (pendingEdit) {
      return {
        mode: 'edit',
        event: pendingEdit,
        seriesUntil: pendingEdit.seriesId ? seriesEndDate(events, pendingEdit.seriesId) : null,
        seriesWeekdays: pendingEdit.seriesId
          ? normalizeDays(
              events
                .filter((e) => e.seriesId === pendingEdit.seriesId)
                .map((e) => e.start.getDay()),
            )
          : [pendingEdit.start.getDay()],
      };
    }
    if (pendingCreate) return { mode: 'create', range: pendingCreate };
    return null;
  }, [pendingEdit, pendingCreate, events]);

  const addMarker = useCallback(
    (title: string, month: number, day: number, year: number | null) => {
      setMarkers((prev) => [...prev, createMarker(title, month, day, year)]);
    },
    [],
  );

  const deleteMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Holidays are derived per displayed year, never stored, so they stay correct
  // for any year the user scrolls into.
  const holidays = useMemo(
    () => (showHolidays ? usFederalHolidays(selected.getFullYear()) : []),
    [showHolidays, selected],
  );

  const allMarkers = useMemo(() => [...holidays, ...markers], [holidays, markers]);

  const dayMarkers = useMemo(
    () => markersOn(allMarkers, selected),
    [allMarkers, selected],
  );

  const markersForDate = useCallback(
    (date: Date) => markersOn(allMarkers, date),
    [allMarkers],
  );

  const freeWindows = useMemo(() => {
    const dayStart = new Date(selected);
    dayStart.setHours(GRID.startHour, 0, 0, 0);
    const dayEnd = new Date(selected);
    dayEnd.setHours(GRID.endHour, 0, 0, 0);
    return findFreeWindows(dayEvents, dayStart, dayEnd);
  }, [dayEvents, selected]);

  // Every hook above runs unconditionally; the gate below is the last thing
  // before render so signing in never changes the hook order.
  //
  // Held back until `ready` so a returning user goes straight to their
  // schedule instead of seeing the sign-in form flash past while the stored
  // session is read.
  if (isSupabaseConfigured && supabase && sync.ready && !sync.session && !sync.offlineChosen) {
    return <SignIn supabase={supabase} onContinueOffline={sync.chooseOffline} />;
  }

  return (
    <div className="app">
      <header className={`toolbar${scrolled ? ' scrolled' : ''}`}>
        <div>
          <h1>{formatDayHeading(selected)}</h1>
          <p className="sub">
            {isToday ? 'Today' : relativeLabel(selected, today)}
            {events.length > 0 && ` · ${dayEvents.length} scheduled`}
          </p>
        </div>
        <div className="toolbar-actions">
          <SyncStatus
            status={sync.status}
            error={sync.error}
            email={sync.session?.user.email}
            onSignOut={sync.signOutAndForget}
          />
          {!isToday && (
            <button className="btn plain" onClick={() => setSelected(today)}>
              Today
            </button>
          )}
          <button className="btn" onClick={() => setSharing(true)}>
            Share
          </button>
          <SegmentedControl
            label="Appearance"
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={setAppearance}
          />
        </div>
      </header>

      <div className="layout">
        <main className="layout-main">
          {/* Leads the column: the day gets summarised before it is laid out
              hour by hour. */}
          <DayBrief
            events={dayEvents}
            conflicts={conflicts}
            freeWindows={freeWindows}
            markerCount={dayMarkers.length}
            openTasks={openCount(tasks)}
            now={now}
            selected={selected}
            isToday={isToday}
          />

          <DayNotes markers={dayMarkers} isToday={isToday} />

          {/* The grid always renders. An empty schedule is a real, usable state —
              it is the surface you drag on to build one, not an error to explain. */}
          <StatTiles
            events={dayEvents}
            conflicts={conflicts}
            freeWindows={freeWindows}
            now={now}
            isToday={isToday}
          />

          <WeekStrip
            events={events}
            selected={selected}
            today={today}
            onSelect={setSelected}
            onShiftWeek={(delta) => setSelected((d) => addDays(d, delta * 7))}
            markersOn={markersForDate}
          />

          <DayGrid
            key={+selected}
            events={dayEvents}
            conflicts={conflicts}
            freeWindows={freeWindows}
            now={isToday ? now : null}
            onRequestDelete={setPendingDelete}
            undoLabel={undoLabel}
            onUndo={undo}
            onRequestCreate={setPendingCreate}
            onRequestEdit={setPendingEdit}
          />

          <CommitmentList
            series={manualSeries}
            singles={manualSingles}
            onDelete={deleteSeries}
            onDeleteSingle={deleteEvent}
          />

          {/* Setup lives below the day it configures. These are opened when a
              term starts and rarely after; the schedule is what the app is
              opened for, so it should not sit behind two forms. */}
          <ManualEntry
            count={manualSeries.length + manualSingles.length}
            defaultOpen={events.length === 0}
            onAdd={addSeries}
            onAddOnce={addSingle}
          />

          <ImportantDates
            markers={markers}
            holidayCount={usFederalHolidays(selected.getFullYear()).length}
            showHolidays={showHolidays}
            onToggleHolidays={setShowHolidays}
            onAdd={addMarker}
            onDelete={deleteMarker}
          />
        </main>

        {/* Standalone by design: tasks that aren't tied to a time slot shouldn't
            require a schedule to exist first. In the margin it stays visible
            while you scroll the day, which is the point of moving it here —
            a to-do list you have to scroll to is a to-do list you forget. */}
        <aside className="layout-side">
          <TaskList
            tasks={tasks}
            onAdd={addTask}
            onToggle={toggleTask}
            onNotesChange={setTaskNotes}
            onDelete={deleteTask}
          />
        </aside>
      </div>

      <CommitmentDialog
        target={dialogTarget}
        date={selected}
        onDismiss={() => {
          setPendingCreate(null);
          setPendingEdit(null);
        }}
        onCreate={createFromDraft}
        onEdit={editEvent}
      />

      {/* Given the same markers the day view shows, holidays included or not,
          so a shared week matches the week it was shared from. */}
      <ShareDialog
        open={sharing}
        onDismiss={() => setSharing(false)}
        events={events}
        markers={allMarkers}
        anchor={selected}
      />

      <ConfirmDeleteDialog
        event={pendingDelete}
        onDismiss={() => setPendingDelete(null)}
        onDeleteOccurrence={confirmDeleteOccurrence}
        onDeleteSeries={deleteSeries}
      />

      <footer>{storageSummary(events.length, tasks.length)}</footer>
    </div>
  );
}

function relativeLabel(selected: Date, today: Date): string {
  const days = Math.round((+selected - +today) / 86_400_000);
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 0) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

function storageSummary(eventCount: number, taskCount: number): string {
  const parts: string[] = [];
  if (eventCount) parts.push(`${eventCount} occurrences`);
  if (taskCount) parts.push(`${taskCount} task${taskCount === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'Nothing saved yet';
  return `${parts.join(' · ')} · stored locally in this browser`;
}
