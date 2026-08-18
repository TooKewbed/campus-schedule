import { useEffect, useRef, useState } from 'react';
import type { ScheduleEvent } from '../types/event';
import { formatDayHeading, formatRange } from '../lib/time';

interface Props {
  /** The event awaiting confirmation, or null when nothing is pending. */
  event: ScheduleEvent | null;
  onDismiss: () => void;
  onDeleteOccurrence: (event: ScheduleEvent) => void;
  onDeleteSeries: (seriesId: string) => void;
}

/**
 * Deletion is irreversible here — there is no undo and no version control — so
 * this is one of the few places a confirmation genuinely earns its interruption.
 *
 * Uses a native <dialog> for the focus trap, Escape handling and inert
 * background that would otherwise have to be rebuilt by hand.
 */
export default function ConfirmDeleteDialog({
  event,
  onDismiss,
  onDeleteOccurrence,
  onDeleteSeries,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Retained so the dialog still has content to render while it animates out.
  const [shown, setShown] = useState<ScheduleEvent | null>(event);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (event) {
      setShown(event);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [event]);

  const recurring = Boolean(shown?.seriesId);

  return (
    <dialog
      ref={ref}
      className="confirm"
      onClose={onDismiss}
      onClick={(e) => {
        // Clicking the backdrop lands on the dialog element itself.
        if (e.target === ref.current) onDismiss();
      }}
    >
      {shown && (
        <div className="confirm-inner">
          <h2>Delete &ldquo;{shown.title}&rdquo;?</h2>
          <p className="confirm-when">
            {formatDayHeading(shown.start)} · {formatRange(shown.start, shown.end)}
            {shown.location ? ` · ${shown.location}` : ''}
          </p>
          <p className="confirm-body">
            {recurring
              ? 'This commitment repeats. You can remove just this one, or every occurrence of it.'
              : 'This will remove it from your schedule. This cannot be undone.'}
          </p>

          <div className="confirm-actions">
            <button className="btn plain" onClick={onDismiss} autoFocus>
              Cancel
            </button>
            {recurring && (
              <button className="btn" onClick={() => onDeleteOccurrence(shown)}>
                This one only
              </button>
            )}
            <button
              className="btn destructive"
              onClick={() =>
                recurring && shown.seriesId
                  ? onDeleteSeries(shown.seriesId)
                  : onDeleteOccurrence(shown)
              }
            >
              {recurring ? 'Delete all' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
