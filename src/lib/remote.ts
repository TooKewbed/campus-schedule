import type { SupabaseClient } from '@supabase/supabase-js';
import { toCategory, type ColorName, type ScheduleEvent } from '../types/event';
import type { DayMarker } from '../types/dayMarker';
import type { Task } from '../types/task';
import type { ShoppingItem } from '../types/shopping';
import type { QuickNote } from '../types/quickNote';
import { isRepeat } from './repeat';

/**
 * Translation between the app's in-memory model and the database.
 *
 * Two shapes are deliberately kept apart. In memory, dates are Date objects and
 * absent values are `undefined`, because that is what the rest of the app is
 * written against. In Postgres, dates are ISO strings and absent values are
 * null, because that is what a column holds. Everything that converts between
 * the two lives in this file, so no component ever has to know a row shape and
 * no query ever has to know a Date.
 *
 * Writes are per-row, not whole-table. Editing one commitment on your phone
 * sends one row; it does not overwrite what the laptop wrote a minute ago. That
 * is the entire reason for the diffing below — without it, "sync" would just be
 * a race between devices to save last.
 */

/* -------------------------------------------------------------- row shapes -- */

interface EventRow {
  user_id: string;
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  category: string;
  category_label: string | null;
  location: string | null;
  course_code: string | null;
  description: string | null;
  source: string;
  series_id: string | null;
  recurring: boolean;
  color: string | null;
}

interface TaskRow {
  user_id: string;
  id: string;
  title: string;
  done: boolean;
  notes: string;
  created_at: string;
  completed_at: string | null;
  course_code: string | null;
  due_date: string | null;
  repeat: string | null;
}

interface ShoppingRow {
  user_id: string;
  id: string;
  title: string;
  done: boolean;
  notes: string;
  created_at: string;
  completed_at: string | null;
}

interface QuickNoteRow {
  user_id: string;
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

interface MarkerRow {
  user_id: string;
  id: string;
  title: string;
  month: number;
  day: number;
  year: number | null;
  source: string;
  course_code: string | null;
}

/* --------------------------------------------------------------- mapping -- */

function eventToRow(userId: string, e: ScheduleEvent): EventRow {
  return {
    user_id: userId,
    id: e.id,
    title: e.title,
    start_at: e.start.toISOString(),
    end_at: e.end.toISOString(),
    category: e.category,
    category_label: e.categoryLabel ?? null,
    location: e.location ?? null,
    course_code: e.courseCode ?? null,
    description: e.description ?? null,
    source: e.source,
    series_id: e.seriesId ?? null,
    recurring: e.recurring,
    color: e.color ?? null,
  };
}

function rowToEvent(r: EventRow): ScheduleEvent {
  return {
    id: r.id,
    title: r.title,
    start: new Date(r.start_at),
    end: new Date(r.end_at),
    // An unrecognised category would be neither fixed nor flexible, which puts
    // the event in no lane at all; 'other' keeps it visible instead.
    category: toCategory(r.category),
    categoryLabel: r.category_label ?? undefined,
    location: r.location ?? undefined,
    courseCode: r.course_code ?? undefined,
    description: r.description ?? undefined,
    source: r.source === 'ics' ? 'ics' : 'manual',
    seriesId: r.series_id ?? undefined,
    recurring: r.recurring,
    // An unrecognised slot — a colour added by a newer build — falls back to
    // the automatic colour rather than rendering as an unstyled block.
    color: (r.color as ColorName | null) ?? undefined,
  };
}

function taskToRow(userId: string, t: Task): TaskRow {
  return {
    user_id: userId,
    id: t.id,
    title: t.title,
    done: t.done,
    notes: t.notes,
    created_at: t.createdAt.toISOString(),
    completed_at: t.completedAt ? t.completedAt.toISOString() : null,
    course_code: t.courseCode ?? null,
    due_date: t.dueDate ? t.dueDate.toISOString() : null,
    repeat: t.repeat ?? null,
  };
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    done: r.done,
    notes: r.notes ?? '',
    createdAt: new Date(r.created_at),
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
    courseCode: r.course_code ?? undefined,
    dueDate: r.due_date ? new Date(r.due_date) : undefined,
    // An unrecognised value — a repeat added by a newer build — is treated as
    // no repeat rather than being carried through as something nothing handles.
    repeat: isRepeat(r.repeat) ? r.repeat : undefined,
  };
}

function shoppingToRow(userId: string, item: ShoppingItem): ShoppingRow {
  return {
    user_id: userId,
    id: item.id,
    title: item.title,
    done: item.done,
    notes: item.notes,
    created_at: item.createdAt.toISOString(),
    completed_at: item.completedAt ? item.completedAt.toISOString() : null,
  };
}

function rowToShopping(r: ShoppingRow): ShoppingItem {
  return {
    id: r.id,
    title: r.title,
    done: r.done,
    notes: r.notes ?? '',
    createdAt: new Date(r.created_at),
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
  };
}

function quickNoteToRow(userId: string, n: QuickNote): QuickNoteRow {
  return {
    user_id: userId,
    id: n.id,
    text: n.text,
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  };
}

function rowToQuickNote(r: QuickNoteRow): QuickNote {
  const createdAt = new Date(r.created_at);
  return {
    id: r.id,
    text: r.text ?? '',
    createdAt,
    // Falls back to creation rather than to now, so a row written before
    // this column existed does not read as freshly edited.
    updatedAt: r.updated_at ? new Date(r.updated_at) : createdAt,
  };
}

function markerToRow(userId: string, m: DayMarker): MarkerRow {
  return {
    user_id: userId,
    id: m.id,
    title: m.title,
    month: m.month,
    day: m.day,
    year: m.year,
    source: m.source,
    course_code: m.courseCode ?? null,
  };
}

function rowToMarker(r: MarkerRow): DayMarker {
  return {
    id: r.id,
    title: r.title,
    month: r.month,
    day: r.day,
    year: r.year,
    // Anything unrecognised falls back to 'manual' so a row written by a newer
    // build still renders here rather than vanishing.
    source: r.source === 'holiday' || r.source === 'syllabus' ? r.source : 'manual',
    courseCode: r.course_code ?? undefined,
  };
}

/* ------------------------------------------------------------------ diff -- */

interface Change<Row> {
  upsert: Row[];
  remove: string[];
}

/**
 * What changed between two versions of a collection, by id.
 *
 * Comparison is on the mapped row rather than the in-memory object, because
 * that is what the database stores: a Date and an equivalent ISO string are the
 * same row, and re-sending a row that did not change is wasted traffic.
 */
function diffRows<T extends { id: string }, Row>(
  prev: T[],
  next: T[],
  toRow: (item: T) => Row,
): Change<Row> {
  const before = new Map(prev.map((item) => [item.id, JSON.stringify(toRow(item))]));
  const upsert: Row[] = [];

  for (const item of next) {
    const row = toRow(item);
    if (before.get(item.id) !== JSON.stringify(row)) upsert.push(row);
  }

  const liveIds = new Set(next.map((item) => item.id));
  const remove = prev.map((item) => item.id).filter((id) => !liveIds.has(id));

  return { upsert, remove };
}

/* ------------------------------------------------------------------ read -- */

export interface RemoteSnapshot {
  events: ScheduleEvent[];
  tasks: Task[];
  shopping: ShoppingItem[];
  notes: QuickNote[];
  markers: DayMarker[];
  showHolidays: boolean;
}

/**
 * Everything belonging to this user, in one round of parallel queries.
 *
 * No user_id filter is written here on purpose: Row Level Security already
 * restricts each table to the signed-in user, and adding a redundant filter in
 * the client would imply the security lives here rather than in the database.
 */
/**
 * Is this the error a table that does not exist produces?
 *
 * Postgres says 42P01. PostgREST usually answers from its own schema cache
 * first and says PGRST205 instead, so both count; the message is checked only
 * as a last resort, for versions that report neither.
 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /could not find the table/i.test(error.message ?? '');
}

export async function fetchAll(supabase: SupabaseClient): Promise<RemoteSnapshot> {
  const [events, tasks, shopping, notes, markers, prefs] = await Promise.all([
    supabase.from('events').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('shopping_items').select('*'),
    supabase.from('quick_notes').select('*'),
    supabase.from('day_markers').select('*'),
    supabase.from('preferences').select('show_holidays').maybeSingle(),
  ]);

  const failure = events.error ?? tasks.error ?? markers.error ?? prefs.error;
  if (failure) throw new Error(failure.message);

  // These two tables are newer than the rest of the schema, so either can be
  // genuinely absent on an account whose migrations have not been run yet.
  // That must not take down the schedule with it: a missing table means an
  // empty list, and everything else still syncs. Any other error still counts,
  // because "the query failed" is not the same as "the feature is not
  // installed" — and a failed write will still say so out loud.
  for (const late of [shopping, notes]) {
    if (late.error && !isMissingTable(late.error)) throw new Error(late.error.message);
  }

  return {
    events: (events.data as EventRow[]).map(rowToEvent),
    tasks: (tasks.data as TaskRow[]).map(rowToTask),
    shopping: ((shopping.data ?? []) as ShoppingRow[]).map(rowToShopping),
    notes: ((notes.data ?? []) as QuickNoteRow[]).map(rowToQuickNote),
    markers: (markers.data as MarkerRow[]).map(rowToMarker),
    // No preferences row yet means a first sign-in, and holidays default on.
    showHolidays: prefs.data?.show_holidays ?? true,
  };
}

/* ----------------------------------------------------------------- write -- */

/**
 * Push one collection's changes.
 *
 * Deletes run before upserts so that an id which was removed and then reused in
 * the same batch — unlikely, but possible when undo restores an event — ends up
 * present rather than deleted.
 */
async function push<T extends { id: string }, Row>(
  supabase: SupabaseClient,
  table: string,
  prev: T[],
  next: T[],
  toRow: (item: T) => Row,
): Promise<void> {
  const { upsert, remove } = diffRows(prev, next, toRow);

  if (remove.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', remove);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  if (upsert.length > 0) {
    const { error } = await supabase
      .from(table)
      .upsert(upsert as never, { onConflict: 'user_id,id' });

    // A column this build writes but the database has not got yet means the
    // app is deployed ahead of its migration. Retrying without that column
    // keeps everything else syncing, at the cost of the one new field, rather
    // than failing the whole push and stranding every other edit — including
    // ones that have nothing to do with the new feature.
    if (error && isMissingColumn(error)) {
      const column = missingColumnName(error);
      if (column) {
        const trimmed = upsert.map((row) => {
          const copy = { ...(row as Record<string, unknown>) };
          delete copy[column];
          return copy;
        });
        const retry = await supabase
          .from(table)
          .upsert(trimmed as never, { onConflict: 'user_id,id' });
        if (retry.error) throw new Error(`${table}: ${retry.error.message}`);
        return;
      }
    }

    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/**
 * Is this the error an undeclared column produces?
 *
 * PostgREST rejects it from its schema cache as PGRST204 before Postgres ever
 * sees the statement; 42703 is the database's own answer, for the case where
 * the cache is stale in the other direction.
 */
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return /could not find the .* column/i.test(error.message ?? '');
}

/** The column PostgREST named, e.g. "Could not find the 'category_label' column". */
function missingColumnName(error: { message?: string }): string | null {
  return /'([^']+)' column/.exec(error.message ?? '')?.[1] ?? null;
}

export function pushEvents(
  supabase: SupabaseClient,
  userId: string,
  prev: ScheduleEvent[],
  next: ScheduleEvent[],
): Promise<void> {
  return push(supabase, 'events', prev, next, (e) => eventToRow(userId, e));
}

export function pushTasks(
  supabase: SupabaseClient,
  userId: string,
  prev: Task[],
  next: Task[],
): Promise<void> {
  return push(supabase, 'tasks', prev, next, (t) => taskToRow(userId, t));
}

export function pushShopping(
  supabase: SupabaseClient,
  userId: string,
  prev: ShoppingItem[],
  next: ShoppingItem[],
): Promise<void> {
  return push(supabase, 'shopping_items', prev, next, (item) => shoppingToRow(userId, item));
}

export function pushQuickNotes(
  supabase: SupabaseClient,
  userId: string,
  prev: QuickNote[],
  next: QuickNote[],
): Promise<void> {
  return push(supabase, 'quick_notes', prev, next, (n) => quickNoteToRow(userId, n));
}

/**
 * Only hand this the user's own markers. Federal holidays are computed per
 * displayed year and must never be written — storing them would freeze a
 * generated list into rows that go stale the moment the year rolls over.
 *
 * Everything that is not a generated holiday syncs, so this excludes by what it
 * knows to be derived rather than listing what is allowed. Written the other
 * way round, adding a marker source later would silently stop it syncing.
 */
export function pushMarkers(
  supabase: SupabaseClient,
  userId: string,
  prev: DayMarker[],
  next: DayMarker[],
): Promise<void> {
  const mine = (list: DayMarker[]) => list.filter((m) => m.source !== 'holiday');
  return push(supabase, 'day_markers', mine(prev), mine(next), (m) => markerToRow(userId, m));
}

export async function pushPreferences(
  supabase: SupabaseClient,
  userId: string,
  showHolidays: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('preferences')
    .upsert(
      { user_id: userId, show_holidays: showHolidays, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`preferences: ${error.message}`);
}

/**
 * First sign-in on a device that already has a schedule in localStorage.
 *
 * The local copy is uploaded only when the account is genuinely empty. Merging
 * the two instead would be worse than it sounds: a schedule already synced from
 * another device would gain a duplicate of every commitment that happens to
 * have been created locally, and there is no reliable way to tell those apart
 * after the fact.
 */
export function shouldSeedFromLocal(remote: RemoteSnapshot, local: RemoteSnapshot): boolean {
  const remoteEmpty =
    remote.events.length === 0 &&
    remote.tasks.length === 0 &&
    remote.shopping.length === 0 &&
    remote.notes.length === 0 &&
    remote.markers.length === 0;
  const localHasData =
    local.events.length > 0 ||
    local.tasks.length > 0 ||
    local.shopping.length > 0 ||
    local.notes.length > 0 ||
    local.markers.length > 0;
  return remoteEmpty && localHasData;
}
