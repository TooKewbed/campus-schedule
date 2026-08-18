import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, parseISODate, sameDay, startOfDay, startOfWeek, toISODate } from '../lib/time';
import { WEEKDAYS } from '../lib/weekdays';

interface Props {
  /** YYYY-MM-DD, matching the native date input this replaces. */
  value: string;
  onChange: (value: string) => void;
}

const WEEKDAY_INITIALS = WEEKDAYS.map((d) => d.label);
const POPOVER_WIDTH = 268;
const POPOVER_HEIGHT = 330;

/**
 * Calendar popover for picking a date.
 *
 * Rendered in a portal rather than inline: its container clips overflow to
 * animate the disclosure open, which would slice the popover in half. Fixed
 * positioning off the trigger's rect keeps it anchored without inheriting that
 * clipping.
 */
export default function DatePicker({ value, onChange }: Props) {
  const selected = useMemo(() => parseISODate(value), [value]);

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(selected));
  const [focused, setFocused] = useState(selected);
  const [rect, setRect] = useState<DOMRect | null>(null);
  /**
   * Where the popover mounts.
   *
   * A modal <dialog> is promoted to the top layer and makes the rest of the
   * document inert, so a popover portalled to <body> from inside one paints
   * behind the backdrop and refuses every click. Mounting into the dialog
   * itself keeps it in the top layer with its trigger.
   */
  const [container, setContainer] = useState<Element | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLButtonElement>(null);
  const shouldFocusRef = useRef(false);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  const openPicker = () => {
    setViewMonth(firstOfMonth(selected));
    setFocused(selected);
    place();
    setContainer(triggerRef.current?.closest('dialog') ?? document.body);
    shouldFocusRef.current = true;
    setOpen(true);
  };

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  // Dismiss on outside press or Escape; keep anchored while the page moves.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, close, place]);

  /**
   * Inside a <dialog>, Escape is a native close request that a keydown listener
   * can't suppress — it would shut the whole form. Cancelling it here means
   * Escape dismisses the calendar first, leaving the dialog and its contents
   * intact; a second press then closes the dialog as usual.
   */
  useEffect(() => {
    if (!open) return;
    const dialog = triggerRef.current?.closest('dialog');
    if (!dialog) return;

    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [open, close]);

  // Scroll anywhere over the calendar to move through months.
  useEffect(() => {
    const el = popRef.current;
    if (!open || !el) return;

    let cooling = false;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cooling || Math.abs(e.deltaY) < 2) return;
      cooling = true;
      setTimeout(() => (cooling = false), 90);
      setViewMonth((m) => shiftMonth(m, e.deltaY > 0 ? 1 : -1));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  // Roving focus: only the focused day is tabbable, and it takes focus when
  // the selection moves by keyboard.
  useLayoutEffect(() => {
    if (open && shouldFocusRef.current) {
      focusedRef.current?.focus();
      shouldFocusRef.current = false;
    }
  }, [open, focused, viewMonth]);

  const moveFocus = (days: number) => {
    const next = addDays(focused, days);
    setFocused(next);
    if (next.getMonth() !== viewMonth.getMonth() || next.getFullYear() !== viewMonth.getFullYear()) {
      setViewMonth(firstOfMonth(next));
    }
    shouldFocusRef.current = true;
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(moves[e.key]);
      return;
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const next = shiftMonth(viewMonth, e.key === 'PageUp' ? -1 : 1);
      setViewMonth(next);
      setFocused(clampToMonth(focused, next));
      shouldFocusRef.current = true;
    }
  };

  const pick = (date: Date) => {
    onChange(toISODate(date));
    close();
  };

  const days = useMemo(() => buildGrid(viewMonth), [viewMonth]);
  const today = startOfDay(new Date());

  return (
    <div className="datepicker">
      <button
        ref={triggerRef}
        type="button"
        className="datepicker-trigger"
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarGlyph />
        <span>{longDate(selected)}</span>
      </button>

      {open && rect && container &&
        createPortal(
          <div
            ref={popRef}
            className="datepicker-pop"
            role="dialog"
            aria-label="Choose a date"
            style={placement(rect)}
          >
            <div className="dp-head">
              <button
                type="button"
                className="dp-nav"
                onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="dp-month" aria-live="polite">
                {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                className="dp-nav"
                onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="dp-weekdays" aria-hidden="true">
              {WEEKDAY_INITIALS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="dp-grid" role="grid" onKeyDown={onGridKeyDown}>
              {days.map((date) => {
                const outside = date.getMonth() !== viewMonth.getMonth();
                const isSelected = sameDay(date, selected);
                const isFocused = sameDay(date, focused);
                const classes = ['dp-day'];
                if (outside) classes.push('outside');
                if (isSelected) classes.push('selected');
                if (sameDay(date, today)) classes.push('today');

                return (
                  <button
                    key={date.getTime()}
                    ref={isFocused ? focusedRef : undefined}
                    type="button"
                    role="gridcell"
                    className={classes.join(' ')}
                    tabIndex={isFocused ? 0 : -1}
                    aria-selected={isSelected}
                    aria-label={longDate(date)}
                    onClick={() => pick(date)}
                    onFocus={() => setFocused(date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="dp-foot">
              <button type="button" className="btn plain tiny" onClick={() => pick(today)}>
                Today
              </button>
              <span className="dp-hint">Scroll to change month</span>
            </div>
          </div>,
          container,
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ utils */

/** Flip above the trigger when there isn't room below. */
function placement(rect: DOMRect): React.CSSProperties {
  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < POPOVER_HEIGHT && rect.top > POPOVER_HEIGHT;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_WIDTH - 8);

  return {
    position: 'fixed',
    left: `${left}px`,
    top: above ? undefined : `${rect.bottom + 6}px`,
    bottom: above ? `${window.innerHeight - rect.top + 6}px` : undefined,
    width: `${POPOVER_WIDTH}px`,
    // Origin-aware: the popover grows out of its trigger, not its own centre.
    transformOrigin: above ? 'bottom left' : 'top left',
  };
}

/** Six Monday-first weeks covering the month, with spillover days included. */
function buildGrid(month: Date): Date[] {
  const start = startOfWeek(month);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Keep a day valid when moving to a shorter month (Jan 31 -> Feb 28). */
function clampToMonth(day: Date, month: Date): Date {
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day.getDate(), lastDay));
}


function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
