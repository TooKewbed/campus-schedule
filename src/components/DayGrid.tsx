import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { isFixed, isFlexible, type EventKind, type ScheduleEvent } from '../types/event';
import type { Conflict } from '../lib/conflicts';
import { conflictedEventIds } from '../lib/conflicts';
import type { FreeWindow } from '../lib/freeTime';
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  GRID,
  GRID_HEIGHT,
  blockStyle,
  layoutLane,
  minutesFromY,
  yFor,
  yForMinutes,
} from '../lib/layout';
import { colorFor } from '../lib/colors';
import { formatDuration, formatRange, formatTime, minutesIntoDay } from '../lib/time';

/** A range drawn on the grid, before it has been named or committed. */
export interface DraftRange {
  startMinutes: number;
  endMinutes: number;
  kind: EventKind;
}

interface Props {
  events: ScheduleEvent[];
  conflicts: Conflict[];
  freeWindows: FreeWindow[];
  /** Only drawn when the viewed day is actually today. */
  now: Date | null;
  onRequestDelete: (event: ScheduleEvent) => void;
  /** Describes what undo would restore, or null when there is nothing to undo. */
  undoLabel: string | null;
  onUndo: () => void;
  /** Raised when a drag on empty grid finishes. */
  onRequestCreate: (draft: DraftRange) => void;
  /** Raised when an existing block is clicked. */
  onRequestEdit: (event: ScheduleEvent) => void;
}

/** Snap to quarter hours — the granularity a class schedule actually uses. */
const SNAP_MINUTES = 15;
/** A click without a drag means "an hour here", the way a calendar should. */
const CLICK_DURATION = 60;

export default function DayGrid({
  events,
  conflicts,
  freeWindows,
  now,
  onRequestDelete,
  undoLabel,
  onUndo,
  onRequestCreate,
  onRequestEdit,
}: Props) {
  const conflicted = useMemo(() => conflictedEventIds(conflicts), [conflicts]);
  const fixed = useMemo(() => layoutLane(events.filter(isFixed)), [events]);
  const flexible = useMemo(() => layoutLane(events.filter(isFlexible)), [events]);

  const [draft, setDraft] = useState<DraftRange | null>(null);
  const dragRef = useRef<{ anchor: number; kind: EventKind; el: HTMLElement; moved: boolean } | null>(
    null,
  );

  const hours = [];
  for (let h = GRID.startHour; h <= GRID.endHour; h++) hours.push(h);

  const nowOffset =
    now &&
    minutesIntoDay(now) >= DAY_START_MINUTES &&
    minutesIntoDay(now) <= DAY_END_MINUTES
      ? yFor(now)
      : null;

  const cancelDrag = () => {
    dragRef.current = null;
    setDraft(null);
  };

  // Escape abandons a drag in progress, matching every other dismissable
  // interaction in the app.
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft]);

  /** Pointer Y to a snapped minute, measured fresh so page scroll can't drift. */
  const minuteAt = (clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const raw = minutesFromY(clientY - rect.top);
    return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, kind: EventKind) => {
    // Never start a drag on top of an existing block — that region belongs to
    // the block's own controls.
    if ((e.target as HTMLElement).closest('.ev, .ev-flex')) return;
    if (e.button !== 0) return;

    const el = e.currentTarget;
    const anchor = minuteAt(e.clientY, el);
    el.setPointerCapture(e.pointerId);
    dragRef.current = { anchor, kind, el, moved: false };
    setDraft({ startMinutes: anchor, endMinutes: anchor + SNAP_MINUTES, kind });
  };

  const extendDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    // Feedback tracks the pointer continuously, not just on release.
    const current = minuteAt(e.clientY, drag.el);
    if (current !== drag.anchor) drag.moved = true;

    const start = Math.min(drag.anchor, current);
    const end = Math.max(drag.anchor, current);
    setDraft({
      startMinutes: start,
      endMinutes: Math.max(end, start + SNAP_MINUTES),
      kind: drag.kind,
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !draft) return;
    drag.el.releasePointerCapture?.(e.pointerId);

    const endMinutes = drag.moved
      ? draft.endMinutes
      : Math.min(draft.startMinutes + CLICK_DURATION, DAY_END_MINUTES);

    dragRef.current = null;
    setDraft(null);
    onRequestCreate({ ...draft, endMinutes });
  };

  const laneHandlers = (kind: EventKind) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => startDrag(e, kind),
    onPointerMove: extendDrag,
    onPointerUp: endDrag,
    onPointerCancel: cancelDrag,
  });

  const renderDraft = (kind: EventKind) =>
    draft && draft.kind === kind ? (
      <div
        className={`ev-draft ${kind}`}
        style={{
          top: `${yForMinutes(draft.startMinutes)}px`,
          height: `${yForMinutes(draft.endMinutes) - yForMinutes(draft.startMinutes)}px`,
        }}
      >
        <div className="t">New {kind === 'fixed' ? 'commitment' : 'optional block'}</div>
        <div className="m">
          {clockLabel(draft.startMinutes)} – {clockLabel(draft.endMinutes)} ·{' '}
          {formatDuration(draft.endMinutes - draft.startMinutes)}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="lane-headers">
        <div />
        <div className="lh">Classes &amp; commitments</div>
        <div className="lh">Office hours &amp; flexible</div>
      </div>

      <div className="board">
        <div className="board-head">
          <span className="board-hint">Drag on the grid to add a commitment</span>
          <button
            className="undo-btn"
            onClick={onUndo}
            disabled={undoLabel === null}
            title={undoLabel ?? 'Nothing to undo'}
            aria-label={undoLabel ?? 'Nothing to undo'}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 4L3 7l3 3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 7h6.5A3.5 3.5 0 0 1 13 10.5v0A3.5 3.5 0 0 1 9.5 14H7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Undo
          </button>
        </div>

        <div className="schedule" style={{ height: `${GRID_HEIGHT}px` }}>
          <div className="time-axis">
            {hours.map((h) => (
              <div
                key={h}
                className="hr"
                style={{ top: `${(h - GRID.startHour) * GRID.rowHeight}px` }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          <div className="lane lane-fixed" {...laneHandlers('fixed')}>
            {hours.map((h) => (
              <div
                key={h}
                className="gridline"
                style={{ top: `${(h - GRID.startHour) * GRID.rowHeight}px` }}
              />
            ))}

            {freeWindows.map((w) => {
              const top = yFor(w.start);
              const height = yFor(w.end) - top;
              return (
                <div
                  key={+w.start}
                  className="free"
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  {height >= 34 ? `${formatDuration(w.minutes)} free` : null}
                </div>
              );
            })}

            {/* Conflict chips sit above their block, so they lead the stagger. */}
            {conflicts.map((c) => (
              <div key={c.id} className="conflict-chip" style={{ top: `${yFor(c.start)}px` }}>
                <span className="dot">!</span> Double-booked {formatRange(c.start, c.end)}
              </div>
            ))}

            {fixed.map((p, i) => (
              <div
                key={p.event.id}
                className={`ev ${colorFor(p.event)}${
                  conflicted.has(p.event.id) ? ' conflicting' : ''
                }`}
                style={{ ...blockStyle(p), '--i': i } as CSSProperties}
                title={`${p.event.title} · ${formatRange(p.event.start, p.event.end)}`}
                role="button"
                tabIndex={0}
                onClick={() => onRequestEdit(p.event)}
                onKeyDown={(e) => openOnKey(e, () => onRequestEdit(p.event))}
              >
                <div className="t">{p.event.title}</div>
                {p.height >= 44 && (
                  <div className="m">
                    {formatRange(p.event.start, p.event.end)}
                    {p.event.location ? ` · ${p.event.location}` : ''}
                  </div>
                )}
                <DeleteButton event={p.event} onRequestDelete={onRequestDelete} />
              </div>
            ))}

            {renderDraft('fixed')}

            {nowOffset !== null && now && (
              <div className="now-line" style={{ top: `${nowOffset}px` }}>
                <div className="bar" />
                <div className="knob" />
                <div className="lbl">Now · {formatTime(now)}</div>
              </div>
            )}
          </div>

          <div className="lane lane-flex" {...laneHandlers('flexible')}>
            {hours.map((h) => (
              <div
                key={h}
                className="gridline"
                style={{ top: `${(h - GRID.startHour) * GRID.rowHeight}px` }}
              />
            ))}

            {flexible.map((p, i) => (
              <div
                key={p.event.id}
                className={`ev-flex ${colorFor(p.event)}`}
                style={{ ...blockStyle(p), '--i': i } as CSSProperties}
                title={`${p.event.title} · ${formatRange(p.event.start, p.event.end)}`}
                role="button"
                tabIndex={0}
                onClick={() => onRequestEdit(p.event)}
                onKeyDown={(e) => openOnKey(e, () => onRequestEdit(p.event))}
              >
                <div className="t">{p.event.title}</div>
                {p.height >= 44 && (
                  <div className="m">{formatRange(p.event.start, p.event.end)} · optional</div>
                )}
                <DeleteButton event={p.event} onRequestDelete={onRequestDelete} />
              </div>
            ))}

            {renderDraft('flexible')}
          </div>
        </div>

        {/* The key explains the grid, so it lives with the grid. */}
        <dl className="key">
          <div className="key-item">
            <dt>
              <i className="key-swatch fixed" />
              Fixed
            </dt>
            <dd>class, work, exam — blocks time</dd>
          </div>
          <div className="key-item">
            <dt>
              <i className="key-swatch flex" />
              Flexible
            </dt>
            <dd>optional — never blocks time</dd>
          </div>
          <div className="key-item">
            <dt>
              <i className="key-swatch conflict" />
              Conflict
            </dt>
            <dd>two fixed events overlap</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

function DeleteButton({
  event,
  onRequestDelete,
}: {
  event: ScheduleEvent;
  onRequestDelete: (event: ScheduleEvent) => void;
}) {
  return (
    <button
      className="ev-delete"
      onClick={(e) => {
        // Otherwise the click also lands on the block and opens the editor.
        e.stopPropagation();
        onRequestDelete(event);
      }}
      aria-label={`Delete ${event.title}`}
      title="Delete"
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Enter or Space opens the editor, matching the button role on the block. */
function openOnKey(e: React.KeyboardEvent, run: () => void) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  run();
}

/** Minutes-since-midnight to a locale clock label, via a throwaway date. */
function clockLabel(minutes: number): string {
  return formatTime(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

function formatHour(h: number): string {
  const display = h % 12 === 0 ? 12 : h % 12;
  const meridiem = h < 12 ? 'AM' : 'PM';
  return `${display}:00 ${meridiem}`;
}
