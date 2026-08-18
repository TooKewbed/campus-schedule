import type { SyncStatus as Status } from '../hooks/useSync';

interface Props {
  status: Status;
  error: string | null;
  email: string | undefined;
  onSignOut: () => void;
}

/**
 * Whether the schedule is safe, in one glance.
 *
 * Sync is the sort of thing people only think about when it has gone wrong, so
 * the states that matter are "saved" and "not saved" — anything transient stays
 * quiet. The failure case says the data is still here, because the instinct on
 * seeing a sync error is to assume the work is gone, and it isn't.
 */
export default function SyncStatus({ status, error, email, onSignOut }: Props) {
  if (status === 'offline') return null;

  const label =
    status === 'loading'
      ? 'Loading…'
      : status === 'saving'
        ? 'Saving…'
        : status === 'error'
          ? 'Not saved'
          : 'Synced';

  return (
    <div className="sync">
      <span
        className={`sync-dot sync-${status}`}
        role="status"
        aria-live="polite"
        /* The visible label repeats this, so the dot itself carries no text. */
        title={error ?? (email ? `Signed in as ${email}` : undefined)}
      />
      <span className="sync-label">{label}</span>
      <button className="linkish" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
