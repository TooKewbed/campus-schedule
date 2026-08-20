/**
 * Registering the service worker, and showing notifications through it.
 *
 * The worker is what makes Skedge installable and usable offline. It is also
 * the only way to raise a notification on Android Chrome, where the
 * `Notification` constructor throws rather than working — so this prefers the
 * registration and keeps the constructor as the fallback for older desktop
 * browsers that have one but no worker.
 */

let ready: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Registering after load keeps the worker off the critical path for the
  // first render, which is the one people judge the app by.
  window.addEventListener('load', () => {
    ready = navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration)
      .catch(() => null);
  });
}

/** The registration once it exists, or null where workers are unavailable. */
export async function serviceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (ready) return ready;

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export interface NotificationRequest {
  title: string;
  body: string;
  /** Replaces an earlier notification about the same thing rather than stacking. */
  tag: string;
}

/**
 * Shows one notification, by whichever route this browser supports.
 *
 * Returns whether anything was actually shown, so a caller can avoid recording
 * a reminder as delivered when it was not.
 */
export async function showNotification(request: NotificationRequest): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  const registration = await serviceWorkerReady();
  if (registration) {
    try {
      await registration.showNotification(request.title, {
        body: request.body,
        tag: request.tag,
        icon: '/icon-192.png',
        badge: '/favicon-48.png',
      });
      return true;
    } catch {
      // Fall through to the constructor below.
    }
  }

  try {
    // Throws on Android Chrome, which is exactly why the worker is preferred.
    new Notification(request.title, { body: request.body, tag: request.tag });
    return true;
  } catch {
    return false;
  }
}

/** Whether the app is running as an installed app rather than in a tab. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates display-mode and reports this instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
