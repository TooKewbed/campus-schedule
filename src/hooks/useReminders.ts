import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types/task';
import { pendingReminders, pruneSent } from '../lib/reminders';
import { loadReminders, saveReminders } from '../lib/storage';

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export interface RemindersApi {
  enabled: boolean;
  permission: PermissionState;
  /** Asks the browser, then turns reminders on if allowed. */
  enable: () => Promise<void>;
  disable: () => void;
}

/**
 * Fires deadline reminders while the app is open.
 *
 * Delivery is separated from the decision of what to deliver — the rules live
 * in lib/reminders and are tested there. This part handles the browser: asking
 * permission, remembering what has already been said, and not saying it again.
 *
 * Sent keys are persisted, so refreshing the page does not replay the morning's
 * reminders. That is the failure that makes people turn a feature like this off
 * for good.
 */
export function useReminders(tasks: Task[], now: Date): RemindersApi {
  const [state, setState] = useState(() => loadReminders());
  const [permission, setPermission] = useState<PermissionState>(() => currentPermission());

  // Read inside the effect without making it a dependency; otherwise every
  // keystroke on a task would reschedule the whole thing.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    saveReminders(state);
  }, [state]);

  useEffect(() => {
    if (!state.enabled || permission !== 'granted') return;

    const due = pendingReminders(tasksRef.current, now, state.sent);
    if (due.length === 0) return;

    for (const reminder of due) {
      try {
        new Notification(reminder.title, {
          body: reminder.body,
          // Replaces rather than stacks if the same task fires again later.
          tag: `skedge-${reminder.taskId}`,
          icon: '/favicon-48.png',
        });
      } catch {
        // Some browsers refuse construction outside a service worker; there is
        // nothing useful to tell the user here, and the in-app counts still work.
      }
    }

    setState((prev) => ({
      ...prev,
      sent: pruneSent([...prev.sent, ...due.map((r) => r.key)], now),
    }));
  }, [now, state.enabled, state.sent, permission]);

  const enable = useCallback(async () => {
    if (typeof Notification === 'undefined') return;

    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
    // Only switch on if it can actually work; a toggle that looks on while the
    // browser is blocking it is a lie.
    if (result === 'granted') setState((prev) => ({ ...prev, enabled: true }));
  }, []);

  const disable = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: false }));
  }, []);

  return { enabled: state.enabled && permission === 'granted', permission, enable, disable };
}

function currentPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}
