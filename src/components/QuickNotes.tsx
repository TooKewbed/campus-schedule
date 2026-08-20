import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { describeNoteTime, sortNotes, type QuickNote } from '../types/quickNote';
import { TrashGlyph } from './Glyphs';

interface Props {
  notes: QuickNote[];
  now: Date;
  onAdd: (text: string) => void;
  onChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Quick notes.
 *
 * Same card as the two lists above it, with the parts a note does not need
 * taken out: no checkbox, no sections, no count of what is outstanding. A jot
 * is not something you complete.
 *
 * The one place it deliberately differs from its neighbours is the add field,
 * which is a textarea rather than an input. Enter still files the note — that
 * is what makes it quick — but Shift+Enter gives a second line, so a pasted
 * address or a two-line reminder arrives intact instead of being flattened.
 */
export default function QuickNotes({ notes, now, onAdd, onChange, onDelete }: Props) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const ordered = useMemo(() => sortNotes(notes), [notes]);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
  };

  return (
    <section className="tasks notes">
      <div className="tasks-head">
        <h2>Quick notes</h2>
        <div className="tasks-head-right">
          <span className="count">
            {notes.length === 0
              ? 'Nothing yet'
              : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      <div className="task-card">
        <div className="task-add note-add">
          <span className="task-add-glyph" aria-hidden="true">
            +
          </span>
          <GrowingTextarea
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onCancel={() => setDraft('')}
            placeholder="Jot something down"
            ariaLabel="Write a quick note"
          />
          {draft.trim() && (
            <button className="btn primary tiny" onClick={submit}>
              Save
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          <p className="task-empty">
            A room number, a book someone mentioned, the thing you&rsquo;ll need on Tuesday.
            Nothing here has a deadline or gets ticked off &mdash; it just stays until you
            delete it.
          </p>
        ) : (
          <ul className="note-list">
            {ordered.map((note) => (
              <li key={note.id} className="note-item">
                {editing === note.id ? (
                  <NoteEditor
                    note={note}
                    onChange={(text) => onChange(note.id, text)}
                    onDone={() => setEditing(null)}
                    onDelete={() => {
                      setEditing(null);
                      onDelete(note.id);
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="note-text"
                      onClick={() => setEditing(note.id)}
                      aria-label={`Edit note: ${note.text}`}
                    >
                      {note.text}
                    </button>
                    <div className="note-foot">
                      <span className="note-time">{describeNoteTime(note, now)}</span>
                      <button
                        className="icon-btn danger tiny"
                        onClick={() => onDelete(note.id)}
                        aria-label="Delete this note"
                        title="Delete"
                      >
                        <TrashGlyph />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- editing -- */

interface EditorProps {
  note: QuickNote;
  onChange: (text: string) => void;
  onDone: () => void;
  onDelete: () => void;
}

/**
 * Editing happens in place.
 *
 * Emptying a note removes it. That is the behaviour of every scratchpad worth
 * using, and it means clearing the text does what it looks like it does rather
 * than leaving a blank row that has to be deleted a second way.
 */
function NoteEditor({ note, onChange, onDone, onDelete }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.focus();
    // Caret at the end, not over the top of the existing text — this is an
    // edit, and selecting everything makes the first keystroke destructive.
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  const finish = () => {
    if (!note.text.trim()) onDelete();
    else onDone();
  };

  return (
    <div className="note-edit">
      <textarea
        ref={ref}
        value={note.text}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish();
          }
          // Enter closes the editor rather than filing a new note here; a
          // newline still needs Shift, matching the add field above.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finish();
          }
        }}
        aria-label="Note text"
      />
      <div className="note-foot">
        <span className="note-hint">Enter to finish · Shift+Enter for a new line</span>
        <button
          className="icon-btn danger tiny"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDelete}
          aria-label="Delete this note"
          title="Delete"
        >
          <TrashGlyph />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the field -- */

interface FieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
  ariaLabel: string;
}

/**
 * A textarea that starts one line tall and grows with what is typed.
 *
 * Sized from scrollHeight rather than counting newlines, so a long line that
 * wraps is measured the same as one that was typed on two lines. Capped, past
 * which it scrolls: an add field that can grow to fill the column pushes the
 * notes it is meant to sit above off the screen.
 */
function GrowingTextarea({ value, onChange, onSubmit, onCancel, placeholder, ariaLabel }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="note-field"
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}
