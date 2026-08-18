import { useState } from 'react';
import { openCount, sortTasks, type Task } from '../types/task';

interface Props {
  tasks: Task[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
}

export default function TaskList({ tasks, onAdd, onToggle, onNotesChange, onDelete }: Props) {
  const [draft, setDraft] = useState('');
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());

  const ordered = sortTasks(tasks);
  const remaining = openCount(tasks);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
  };

  const toggleNotes = (id: string) => {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="tasks">
      <div className="tasks-head">
        <h2>To-do</h2>
        <span className="count">
          {tasks.length === 0
            ? 'Nothing yet'
            : remaining === 0
              ? 'All done'
              : `${remaining} remaining`}
        </span>
      </div>

      <div className="task-card">
        <div className="task-add">
          <span className="task-add-glyph" aria-hidden="true">+</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setDraft('');
            }}
            placeholder="Add a task"
            aria-label="Add a task"
          />
          {draft.trim() && (
            <button className="btn primary tiny" onClick={submit}>
              Add
            </button>
          )}
        </div>

        {ordered.length === 0 ? (
          <p className="task-empty">
            Anything that isn&rsquo;t tied to a time slot — errands, emails, readings.
          </p>
        ) : (
          <ul className="task-list">
            {ordered.map((task) => {
              const notesOpen = openNotes.has(task.id);
              return (
                <li key={task.id} className={`task${task.done ? ' done' : ''}`}>
                  <div className="task-row">
                    <button
                      className="check"
                      role="checkbox"
                      aria-checked={task.done}
                      aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
                      onClick={() => onToggle(task.id)}
                    >
                      <CheckGlyph />
                    </button>

                    <button
                      className="task-title"
                      onClick={() => toggleNotes(task.id)}
                      aria-expanded={notesOpen}
                    >
                      <span className="task-text">{task.title}</span>
                      {/* Collapsed rows still surface that a note exists, and
                          what it says — a hidden note is a forgotten note. */}
                      {task.notes.trim() && !notesOpen && (
                        <span className="task-note-preview">{task.notes.trim()}</span>
                      )}
                    </button>

                    <button
                      className={`icon-btn${notesOpen ? ' active' : ''}`}
                      onClick={() => toggleNotes(task.id)}
                      aria-label={notesOpen ? 'Hide note' : 'Add a note'}
                      title={notesOpen ? 'Hide note' : 'Add a note'}
                    >
                      <NoteGlyph filled={Boolean(task.notes.trim())} />
                    </button>

                    <button
                      className="icon-btn danger"
                      onClick={() => onDelete(task.id)}
                      aria-label={`Delete "${task.title}"`}
                      title="Delete"
                    >
                      <TrashGlyph />
                    </button>
                  </div>

                  <div className="task-notes" data-open={notesOpen}>
                    <div className="task-notes-inner">
                      <div className="task-notes-pad">
                        <textarea
                          value={task.notes}
                          onChange={(e) => onNotesChange(task.id, e.target.value)}
                          placeholder="Add a note"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoteGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 6.5h5M5.5 9.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={filled ? 1 : 0.55}
      />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3.2h3v1.3M4.6 4.5l.6 8.3h5.6l.6-8.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
