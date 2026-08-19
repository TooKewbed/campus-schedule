import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScheduleEvent } from '../types/event';
import type { DayMarker } from '../types/dayMarker';
import { buildPoster } from '../lib/poster';
import {
  buildSnapshot,
  describeRange,
  encodeSnapshot,
  LINK_WARN_LENGTH,
  rangeFor,
  shareUrl,
  type RangeKind,
} from '../lib/shareSnapshot';
import {
  canCopyImages,
  canShareFiles,
  copyImage,
  downloadBlob,
  posterFilename,
  posterTitle,
  sceneToPngBlob,
  shareFile,
} from '../lib/posterImage';
import PosterView from './PosterView';
import SegmentedControl from './SegmentedControl';

interface Props {
  open: boolean;
  onDismiss: () => void;
  events: ScheduleEvent[];
  /** Holidays folded in already, so the poster matches what is on screen. */
  markers: DayMarker[];
  /** The day the schedule is currently showing; the range is built around it. */
  anchor: Date;
}

const RANGES: { value: RangeKind; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

/** How long a "Copied" confirmation stays up. */
const FLASH_MS = 2000;

/**
 * Sharing a read-only copy of part of the schedule.
 *
 * Two ways out, because they are for different situations. A link is for
 * someone who will look at it properly — it opens a page, it scales, it can be
 * read on a phone. An image is for dropping into a group chat, where a link is
 * one more thing nobody taps.
 *
 * Both are the same snapshot and the same drawing, so what gets previewed here
 * is exactly what the other person sees either way.
 */
export default function ShareDialog({ open, onDismiss, events, markers, anchor }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<RangeKind>('week');
  const [title, setTitle] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const snapshot = useMemo(
    () => buildSnapshot({ kind, anchor, events, markers, title }),
    [kind, anchor, events, markers, title],
  );

  const scene = useMemo(() => buildPoster(snapshot), [snapshot]);
  const rangeLabel = useMemo(() => describeRange(kind, rangeFor(kind, anchor)), [kind, anchor]);

  // Encoding is async, so the link is built as the choices change rather than
  // when the button is pressed — pressing Copy has to put something on the
  // clipboard in the same gesture, or Safari discards the write.
  useEffect(() => {
    let live = true;
    setLink(null);
    encodeSnapshot(snapshot)
      .then((payload) => {
        if (live) setLink(shareUrl(payload));
      })
      .catch(() => {
        if (live) setError('Could not build a link for this range.');
      });
    return () => {
      live = false;
    };
  }, [snapshot]);

  const announce = useCallback((message: string) => {
    setFlash(message);
    setError(null);
    setTimeout(() => setFlash((current) => (current === message ? null : current)), FLASH_MS);
  }, []);

  const copyLink = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      announce('Link copied');
    } catch {
      setError('Could not copy. Select the link below and copy it by hand.');
    }
  }, [link, announce]);

  /** Rasterizing takes a moment on a year, so every path through it reports. */
  const withImage = useCallback(
    async (label: string, action: (blob: Blob) => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await action(await sceneToPngBlob(scene));
      } catch (cause) {
        // An aborted share sheet is a decision, not a failure.
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not create the image.');
      } finally {
        setBusy(null);
      }
    },
    [scene],
  );

  const saveImage = useCallback(
    () =>
      withImage('save', async (blob) => {
        downloadBlob(blob, posterFilename(snapshot));
        announce('Image saved');
      }),
    [withImage, snapshot, announce],
  );

  const copyToClipboard = useCallback(
    () =>
      withImage('copy', async (blob) => {
        await copyImage(blob);
        announce('Image copied');
      }),
    [withImage, announce],
  );

  const sendToShareSheet = useCallback(
    () =>
      withImage('share', async (blob) => {
        const filename = posterFilename(snapshot);
        if (!canShareFiles(blob, filename)) {
          downloadBlob(blob, filename);
          announce('Image saved');
          return;
        }
        await shareFile(blob, filename, posterTitle(snapshot));
      }),
    [withImage, snapshot, announce],
  );

  const count = snapshot.r === 'year' ? null : snapshot.ev.length;
  const long = link !== null && link.length > LINK_WARN_LENGTH;

  return (
    <dialog
      ref={ref}
      className="confirm share"
      onClose={onDismiss}
      onClick={(e) => {
        if (e.target === ref.current) onDismiss();
      }}
    >
      <div className="share-inner">
        <div className="share-head">
          <div>
            <h2>Share your schedule</h2>
            <p className="share-sub">
              {/* Not lowercased: the range carries a month name, and "aug 16"
                  reads as a typo. */}
              A read-only copy of {rangeLabel}
              {count !== null && ` · ${count} commitment${count === 1 ? '' : 's'}`}
            </p>
          </div>
          <button className="btn plain" onClick={onDismiss} aria-label="Close">
            Done
          </button>
        </div>

        <div className="share-controls">
          <SegmentedControl
            label="How much to share"
            options={RANGES}
            value={kind}
            onChange={setKind}
          />
          <input
            className="share-title"
            type="text"
            value={title}
            maxLength={60}
            placeholder="Add a name (optional)"
            aria-label="Name for this schedule"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="share-preview">
          <PosterView
            scene={scene}
            className="poster"
            label={`Preview of ${posterTitle(snapshot)}`}
          />
        </div>

        <div className="share-actions">
          <button className="btn primary" onClick={copyLink} disabled={!link}>
            Copy link
          </button>
          <button className="btn" onClick={saveImage} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save image'}
          </button>
          {canCopyImages() && (
            <button className="btn" onClick={copyToClipboard} disabled={busy !== null}>
              {busy === 'copy' ? 'Copying…' : 'Copy image'}
            </button>
          )}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button className="btn" onClick={sendToShareSheet} disabled={busy !== null}>
              {busy === 'share' ? 'Opening…' : 'Share…'}
            </button>
          )}
        </div>

        <p className="share-note" role="status" aria-live="polite">
          {error ? (
            <span className="share-warn">{error}</span>
          ) : flash ? (
            <span className="share-ok">{flash}</span>
          ) : long ? (
            <span className="share-warn">
              This link is long and some apps will cut it in half. A shorter range, or the
              image, will travel better.
            </span>
          ) : (
            // The one thing about this that can surprise someone: it is a copy,
            // taken now, and editing the schedule afterwards will not change it.
            'The whole schedule travels inside the link, so it works without an account — ' +
            'and it stays exactly as it looks now. Later changes will not reach anyone holding it.'
          )}
        </p>
      </div>
    </dialog>
  );
}
