import { useEffect, useMemo, useRef, useState } from 'react';
import { groupShopping, openShoppingCount, type ShoppingItem } from '../types/shopping';
import { CheckGlyph, NoteGlyph, TrashGlyph } from './Glyphs';

interface Props {
  items: ShoppingItem[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onClearGot: () => void;
}

/**
 * The shopping list.
 *
 * Built from the same class names as the to-do list on purpose: it is the same
 * component to look at, and giving it a parallel set of styles would mean every
 * future change to a row had to be made twice and would drift the first time
 * one was missed. What differs is what is missing — no clock, no repeat, no
 * course, no reminder bell — because none of those apply to groceries.
 *
 * The one thing it has that the to-do list does not is a way to empty the
 * basket. A to-do list accumulates a history worth keeping; a shopping list is
 * the same handful of items over and over, and without this you would delete
 * them one at a time after every shop.
 */
export default function ShoppingList({
  items,
  onAdd,
  onToggle,
  onNotesChange,
  onDelete,
  onClearGot,
}: Props) {
  const [draft, setDraft] = useState('');
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [confirmClear, setConfirmClear] = useState(false);

  const groups = useMemo(() => groupShopping(items), [items]);
  const remaining = openShoppingCount(items);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
  };

  const countLabel =
    items.length === 0 ? 'Nothing yet' : remaining === 0 ? 'All picked up' : `${remaining} to buy`;

  const row = (item: ShoppingItem) => {
    const open = openNotes[item.id] === true;
    const toggleNotes = () => setOpenNotes((prev) => ({ ...prev, [item.id]: !prev[item.id] }));

    return (
      <li key={item.id} className={`task${item.done ? ' done' : ''}`}>
        <div className="task-row">
          <button
            className="check"
            role="checkbox"
            aria-checked={item.done}
            aria-label={item.done ? `Put "${item.title}" back` : `Mark "${item.title}" as picked up`}
            onClick={() => onToggle(item.id)}
          >
            <CheckGlyph />
          </button>

          <div className="task-main">
            <button className="task-title" onClick={toggleNotes} aria-expanded={open}>
              <span className="task-text">{item.title}</span>
              {/* A note nobody can see is a note nobody reads, and on a shopping
                  list the note is usually the part that matters — the size, the
                  brand, the aisle. */}
              {item.notes.trim() && !open && (
                <span className="task-note-preview">{item.notes.trim()}</span>
              )}
            </button>
          </div>

          <button
            className={`icon-btn${open ? ' active' : ''}`}
            onClick={toggleNotes}
            aria-expanded={open}
            aria-label={`Note for "${item.title}"`}
            title="Note"
          >
            <NoteGlyph filled={Boolean(item.notes.trim())} />
          </button>

          <button
            className="icon-btn danger"
            onClick={() => onDelete(item.id)}
            aria-label={`Delete "${item.title}"`}
            title="Delete"
          >
            <TrashGlyph />
          </button>
        </div>

        {/* inert while closed, so the textarea is not reachable by Tab when it
            cannot be seen. */}
        <div className="task-notes" data-open={open} inert={!open}>
          <div className="task-notes-inner">
            <div className="task-notes-pad">
              <textarea
                value={item.notes}
                onChange={(e) => onNotesChange(item.id, e.target.value)}
                placeholder="Brand, size, aisle…"
                rows={2}
              />
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="tasks shopping">
      <div className="tasks-head">
        <h2>Shopping</h2>
        <div className="tasks-head-right">
          <span className="count">{countLabel}</span>
        </div>
      </div>

      <div className="task-card">
        <div className="task-add">
          <span className="task-add-glyph" aria-hidden="true">
            +
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setDraft('');
            }}
            placeholder="Add an item"
            aria-label="Add a shopping item"
          />
          {draft.trim() && (
            <button className="btn primary tiny" onClick={submit}>
              Add
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="task-empty">
            Milk, printer paper, whatever you&rsquo;ll forget by the time you&rsquo;re there.
            Kept apart from your to-do list, and never given a deadline.
          </p>
        ) : (
          <>
            {groups.open.length > 0 && <ul className="task-list">{groups.open.map(row)}</ul>}

            {groups.got.length > 0 && (
              <>
                <h3 className="task-section">
                  In the basket
                  <span>{groups.got.length}</span>
                </h3>
                <ul className="task-list">{groups.got.map(row)}</ul>

                <div className="shopping-clear">
                  <ClearBasket count={groups.got.length} onClear={onClearGot} confirm={confirmClear} setConfirm={setConfirmClear} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

interface ClearProps {
  count: number;
  confirm: boolean;
  setConfirm: (value: boolean) => void;
  onClear: () => void;
}

/**
 * Emptying the basket in two taps.
 *
 * It removes several things at once and there is no undo for the list, so a
 * single stray tap should not be able to do it. A second tap is cheaper than a
 * dialog and enough to make it deliberate; the intent lapses on its own so the
 * button is never left armed for a press made minutes later for another reason.
 */
function ClearBasket({ count, confirm, setConfirm, onClear }: ClearProps) {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!confirm) return;
    timer.current = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(timer.current);
  }, [confirm, setConfirm]);

  // Reset if the basket changes underneath — a count that no longer matches the
  // one being confirmed is not the action the user armed.
  useEffect(() => {
    setConfirm(false);
  }, [count, setConfirm]);

  return (
    <button
      className={`linkish${confirm ? ' danger' : ''}`}
      onClick={() => {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        onClear();
        setConfirm(false);
      }}
    >
      {confirm
        ? `Tap again to remove ${count === 1 ? 'it' : `all ${count}`}`
        : `Clear the basket`}
    </button>
  );
}
