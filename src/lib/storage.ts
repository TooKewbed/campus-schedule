import type { ScheduleEvent } from '../types/event';
import type { Task } from '../types/task';
import type { ShoppingItem } from '../types/shopping';
import type { QuickNote } from '../types/quickNote';
import type { DayMarker } from '../types/dayMarker';

const KEY = 'campus-schedule:events:v1';

/** Dates don't survive JSON, so they go over the wire as ISO strings. */
type StoredEvent = Omit<ScheduleEvent, 'start' | 'end'> & {
  start: string;
  end: string;
};

export function saveEvents(events: ScheduleEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    // Private browsing or a full quota — not worth interrupting the user over.
  }
}

export function loadEvents(): ScheduleEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed: StoredEvent[] = JSON.parse(raw);
    return parsed
      .map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
      .filter((e) => !Number.isNaN(e.start.getTime()) && !Number.isNaN(e.end.getTime()));
  } catch {
    return [];
  }
}

export function clearEvents(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ tasks -- */

const TASKS_KEY = 'campus-schedule:tasks:v1';

type StoredTask = Omit<Task, 'createdAt' | 'completedAt' | 'dueDate'> & {
  createdAt: string;
  completedAt: string | null;
  dueDate?: string;
};

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // Private browsing or a full quota — not worth interrupting the user over.
  }
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];

    const parsed: StoredTask[] = JSON.parse(raw);
    return parsed.map((t) => ({
      ...t,
      notes: t.notes ?? '',
      createdAt: reviveDate(t.createdAt) ?? new Date(),
      completedAt: reviveDate(t.completedAt),
      dueDate: reviveDate(t.dueDate) ?? undefined,
    }));
  } catch {
    return [];
  }
}

function reviveDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* --------------------------------------------------------------- shopping -- */

/**
 * Note the key prefix. Every key this app has ever written starts with
 * `campus-schedule:`, from before it was called Skedge, and renaming the prefix
 * would orphan the saved data of everyone already using it. New keys join the
 * old scheme rather than starting a tidier one.
 */
const SHOPPING_KEY = 'campus-schedule:shopping:v1';

type StoredShoppingItem = Omit<ShoppingItem, 'createdAt' | 'completedAt'> & {
  createdAt: string;
  completedAt: string | null;
};

export function saveShopping(items: ShoppingItem[]): void {
  try {
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(items));
  } catch {
    // Private browsing or a full quota — not worth interrupting the user over.
  }
}

export function loadShopping(): ShoppingItem[] {
  try {
    const raw = localStorage.getItem(SHOPPING_KEY);
    if (!raw) return [];

    const parsed: StoredShoppingItem[] = JSON.parse(raw);
    return parsed
      .filter((item) => item && typeof item.title === 'string')
      .map((item) => ({
        id: item.id,
        title: item.title,
        done: item.done === true,
        notes: item.notes ?? '',
        createdAt: reviveDate(item.createdAt) ?? new Date(),
        completedAt: reviveDate(item.completedAt),
      }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------ quick notes -- */

const NOTES_KEY = 'campus-schedule:notes:v1';

type StoredQuickNote = Omit<QuickNote, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export function saveQuickNotes(notes: QuickNote[]): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Private browsing or a full quota — not worth interrupting the user over.
  }
}

export function loadQuickNotes(): QuickNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];

    const parsed: StoredQuickNote[] = JSON.parse(raw);
    return parsed
      .filter((n) => n && typeof n.text === 'string')
      .map((n) => {
        const createdAt = reviveDate(n.createdAt) ?? new Date();
        return {
          id: n.id,
          text: n.text,
          createdAt,
          // A note written before this field existed was never edited, so it
          // falls back to its creation time rather than to now — which would
          // label every old note "edited" the first time it was read back.
          updatedAt: reviveDate(n.updatedAt) ?? createdAt,
        };
      });
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------- markers -- */

const MARKERS_KEY = 'campus-schedule:markers:v1';
const HOLIDAYS_KEY = 'campus-schedule:show-holidays:v1';

export function saveMarkers(markers: DayMarker[]): void {
  try {
    localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
  } catch {
    // ignore
  }
}

export function loadMarkers(): DayMarker[] {
  try {
    const raw = localStorage.getItem(MARKERS_KEY);
    if (!raw) return [];
    const parsed: DayMarker[] = JSON.parse(raw);
    return parsed.filter(
      (m) => m && typeof m.title === 'string' && m.month >= 1 && m.month <= 12,
    );
  } catch {
    return [];
  }
}

export function saveShowHolidays(value: boolean): void {
  try {
    localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Holidays are on unless the user has turned them off. */
export function loadShowHolidays(): boolean {
  try {
    const raw = localStorage.getItem(HOLIDAYS_KEY);
    return raw === null ? true : JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

/* -------------------------------------------------------------- reminders -- */

const REMINDERS_KEY = 'campus-schedule:reminders:v1';

export interface StoredReminders {
  enabled: boolean;
  /** Keys already delivered, so a refresh does not replay them. */
  sent: string[];
}

export function saveReminders(value: StoredReminders): void {
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * Off unless switched on. This one is deliberately opt-in — a browser
 * notification is an interruption, and the app has no business asking for
 * permission to interrupt before anyone has asked it to.
 *
 * Deliberately not synced to the account either: whether this device may show
 * notifications is a fact about the device, not about the person.
 */
export function loadReminders(): StoredReminders {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return { enabled: false, sent: [] };

    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled === true,
      sent: Array.isArray(parsed?.sent) ? parsed.sent.filter((k: unknown) => typeof k === 'string') : [],
    };
  } catch {
    return { enabled: false, sent: [] };
  }
}

/* ------------------------------------------------------------------ view -- */

const VIEW_KEY = 'campus-schedule:view:v1';

export function saveScheduleView(view: 'day' | 'week'): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // ignore
  }
}

/**
 * Day unless the last choice was week.
 *
 * Persisted because it is a preference about how someone reads their schedule,
 * not a transient bit of navigation — being dropped back into day view on every
 * reload would make the toggle feel like it had not worked.
 */
export function loadScheduleView(): 'day' | 'week' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'day';
  } catch {
    return 'day';
  }
}
