import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signOut, watchSession } from '../lib/auth';
import {
  fetchAll,
  pushEvents,
  pushMarkers,
  pushPreferences,
  pushQuickNotes,
  pushShopping,
  pushTasks,
  shouldSeedFromLocal,
  type RemoteSnapshot,
} from '../lib/remote';
import type { ScheduleEvent } from '../types/event';
import type { DayMarker } from '../types/dayMarker';
import type { Task } from '../types/task';
import type { ShoppingItem } from '../types/shopping';
import type { QuickNote } from '../types/quickNote';

/**
 * Binds the app's state to the account, in one place.
 *
 * The design rule: local state stays the thing the UI reads and writes. This
 * hook mirrors it upward and, at sign-in, downward. Nothing in the app awaits a
 * network call before a change appears on screen, so a slow connection makes
 * saving late rather than making the app unusable.
 */

export type SyncStatus =
  /** No account, or Supabase not configured. localStorage only. */
  | 'offline'
  /** Signed in, first fetch in flight. */
  | 'loading'
  /** Local and remote agree. */
  | 'synced'
  /** A push is in flight. */
  | 'saving'
  /** Last push or fetch failed. Local data is still intact. */
  | 'error';

interface State {
  events: ScheduleEvent[];
  tasks: Task[];
  shopping: ShoppingItem[];
  notes: QuickNote[];
  markers: DayMarker[];
  showHolidays: boolean;
}

interface Setters {
  setEvents: (events: ScheduleEvent[]) => void;
  setTasks: (tasks: Task[]) => void;
  setShopping: (items: ShoppingItem[]) => void;
  setNotes: (notes: QuickNote[]) => void;
  setMarkers: (markers: DayMarker[]) => void;
  setShowHolidays: (value: boolean) => void;
}

export interface Sync {
  session: Session | null;
  /** False until the stored session has been checked, to avoid a sign-in flash. */
  ready: boolean;
  status: SyncStatus;
  error: string | null;
  /** Set when the user chose to work without an account on this device. */
  offlineChosen: boolean;
  chooseOffline: () => void;
  signOutAndForget: () => Promise<void>;
}

/**
 * How long to wait after the last change before writing.
 *
 * Typing a note is a change per keystroke; without this each one would be a
 * round trip. Short enough that a normal pause saves, long enough that a
 * sentence is one request.
 */
const WRITE_DELAY_MS = 800;

export function useSync(state: State, setters: Setters): Sync {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [error, setError] = useState<string | null>(null);
  const [offlineChosen, setOfflineChosen] = useState(false);

  /**
   * What the database is believed to hold. Diffs are computed against this, so
   * it must be updated after every successful push as well as after a fetch —
   * otherwise the next write would resend everything.
   */
  const remoteRef = useRef<RemoteSnapshot | null>(null);

  /** True while remote data is being written into state, to suppress echo. */
  const hydratingRef = useRef(false);

  // Latest state, readable from the debounce timer without making the timer a
  // dependency of every render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const settersRef = useRef(setters);
  settersRef.current = setters;

  /* ------------------------------------------------------------- session -- */

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    return watchSession(supabase, (next) => {
      setSession(next);
      setReady(true);
    });
  }, []);

  /* ----------------------------------------------------- initial download -- */

  useEffect(() => {
    const client = supabase;
    if (!client || !session) {
      remoteRef.current = null;
      setStatus('offline');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    (async () => {
      try {
        const remote = await fetchAll(client);
        if (cancelled) return;

        const local = stateRef.current;

        if (shouldSeedFromLocal(remote, local)) {
          // First sign-in on a device that already had a schedule. Upload it,
          // treating the empty account as the starting point so every local
          // row counts as new.
          const empty: RemoteSnapshot = {
            events: [],
            tasks: [],
            shopping: [],
            notes: [],
            markers: [],
            showHolidays: true,
          };
          const userId = session.user.id;
          await Promise.all([
            pushEvents(client, userId, empty.events, local.events),
            pushTasks(client, userId, empty.tasks, local.tasks),
            pushShopping(client, userId, empty.shopping, local.shopping),
            pushQuickNotes(client, userId, empty.notes, local.notes),
            pushMarkers(client, userId, empty.markers, local.markers),
            pushPreferences(client, userId, local.showHolidays),
          ]);
          if (cancelled) return;
          remoteRef.current = { ...local };
        } else {
          // The account wins. Anything typed on this device before signing in
          // and not uploaded is replaced by what the account holds, which is
          // the only reading of "my schedule" that stays consistent across
          // devices.
          hydratingRef.current = true;
          const { setEvents, setTasks, setShopping, setNotes, setMarkers, setShowHolidays } =
            settersRef.current;
          setEvents(remote.events);
          setTasks(remote.tasks);
          setShopping(remote.shopping);
          setNotes(remote.notes);
          setMarkers(remote.markers);
          setShowHolidays(remote.showHolidays);
          remoteRef.current = remote;
        }

        setStatus('synced');
      } catch (problem) {
        if (cancelled) return;
        setError(problem instanceof Error ? problem.message : 'Could not load your schedule.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  /* ------------------------------------------------------------- uploads -- */

  useEffect(() => {
    const client = supabase;
    if (!client || !session || !remoteRef.current) return;

    // The render that applied downloaded data must not bounce it back.
    if (hydratingRef.current) {
      hydratingRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      const known = remoteRef.current;
      if (!known) return;

      const current = stateRef.current;
      const userId = session.user.id;

      setStatus('saving');
      try {
        await Promise.all([
          pushEvents(client, userId, known.events, current.events),
          pushTasks(client, userId, known.tasks, current.tasks),
          pushShopping(client, userId, known.shopping, current.shopping),
          pushQuickNotes(client, userId, known.notes, current.notes),
          pushMarkers(client, userId, known.markers, current.markers),
          known.showHolidays === current.showHolidays
            ? Promise.resolve()
            : pushPreferences(client, userId, current.showHolidays),
        ]);
        remoteRef.current = { ...current };
        setStatus('synced');
        setError(null);
      } catch (problem) {
        // Local state is untouched and localStorage already has it, so a failed
        // push costs nothing but freshness. remoteRef is left alone so the next
        // change retries the same rows.
        setError(problem instanceof Error ? problem.message : 'Could not save.');
        setStatus('error');
      }
    }, WRITE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [session, state.events, state.tasks, state.shopping, state.notes, state.markers, state.showHolidays]);

  /* --------------------------------------------------------------- exits -- */

  const chooseOffline = useCallback(() => setOfflineChosen(true), []);

  /**
   * Sign out and clear the schedule from this browser.
   *
   * Leaving the data behind would show the next person to open the app a
   * signed-out copy of someone else's timetable, and would then be uploaded
   * into whichever account signed in next.
   */
  const signOutAndForget = useCallback(async () => {
    const { setEvents, setTasks, setShopping, setNotes, setMarkers, setShowHolidays } = settersRef.current;
    hydratingRef.current = true;
    setEvents([]);
    setTasks([]);
    setShopping([]);
    setNotes([]);
    setMarkers([]);
    setShowHolidays(true);
    remoteRef.current = null;

    if (supabase) await signOut(supabase);
    setOfflineChosen(false);
  }, []);

  return { session, ready, status, error, offlineChosen, chooseOffline, signOutAndForget };
}
