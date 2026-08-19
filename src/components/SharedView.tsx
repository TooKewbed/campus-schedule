import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPoster } from '../lib/poster';
import { decodeSnapshot, type Snapshot } from '../lib/shareSnapshot';
import {
  canCopyImages,
  copyImage,
  downloadBlob,
  posterFilename,
  posterTitle,
  sceneToPngBlob,
} from '../lib/posterImage';
import PosterView from './PosterView';

interface Props {
  payload: string;
  /** Leaves the shared view for the app proper. */
  onLeave: () => void;
}

/**
 * Someone else's schedule, opened from a link.
 *
 * Deliberately its own page rather than a mode inside the app. A visitor here
 * may have no account and no schedule of their own, and running them through
 * sign-in, sync and local storage to look at a picture would be both slower and
 * a worse first impression. Nothing on this page can edit anything, because
 * there is nothing here to edit — the snapshot is the whole of it.
 */
export default function SharedView({ payload, onLeave }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSnapshot(null);
    setError(null);

    decodeSnapshot(payload)
      .then((decoded) => {
        if (live) setSnapshot(decoded);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : 'This link could not be opened.',
        );
      });

    return () => {
      live = false;
    };
  }, [payload]);

  const scene = useMemo(() => (snapshot ? buildPoster(snapshot) : null), [snapshot]);

  useEffect(() => {
    document.title = snapshot ? `${posterTitle(snapshot)} · Skedge` : 'Shared schedule · Skedge';
  }, [snapshot]);

  const announce = useCallback((message: string) => {
    setFlash(message);
    setTimeout(() => setFlash((current) => (current === message ? null : current)), 2000);
  }, []);

  const withImage = useCallback(
    async (action: (blob: Blob) => Promise<void> | void) => {
      if (!scene) return;
      setBusy(true);
      try {
        await action(await sceneToPngBlob(scene));
      } catch {
        setError('Could not create the image.');
      } finally {
        setBusy(false);
      }
    },
    [scene],
  );

  if (error) {
    return (
      <div className="shared">
        <div className="shared-empty">
          <h1>This link did not open</h1>
          <p>{error}</p>
          <p className="shared-hint">
            Links can get cut short when they are pasted, especially by chat apps. Ask for it
            again, or for a picture instead.
          </p>
          <button className="btn primary" onClick={onLeave}>
            Open Skedge
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot || !scene) {
    return (
      <div className="shared">
        <div className="shared-empty">
          <p className="shared-hint">Opening…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shared">
      <header className="shared-bar">
        <div className="shared-id">
          <span className="shared-mark">Skedge</span>
          <span className="shared-tag">Read-only</span>
        </div>

        <div className="shared-bar-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              withImage((blob) => {
                downloadBlob(blob, posterFilename(snapshot));
                announce('Saved');
              })
            }
          >
            {busy ? 'Working…' : 'Save image'}
          </button>
          {canCopyImages() && (
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                withImage(async (blob) => {
                  await copyImage(blob);
                  announce('Copied');
                })
              }
            >
              Copy image
            </button>
          )}
          <button className="btn primary" onClick={onLeave}>
            Make your own
          </button>
        </div>
      </header>

      {/* Scrolls sideways rather than shrinking below legibility: a week
          squeezed onto a phone screen puts the class names at three pixels
          tall, which is not a smaller version of the poster so much as a
          picture of one. */}
      <div className="shared-poster">
        <PosterView scene={scene} label={posterTitle(snapshot)} />
      </div>

      <p className="shared-foot" role="status" aria-live="polite">
        {flash ?? 'A snapshot of someone’s schedule. It will not change if theirs does.'}
      </p>
    </div>
  );
}
