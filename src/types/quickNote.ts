/**
 * A quick note.
 *
 * The third list in the margin, and the one with no state to track. A task can
 * be done and an item can be in the basket; a jotted room number is never
 * "finished" — it is either still worth keeping or it is deleted. So there is
 * no `done`, no section, and no count of what is outstanding.
 *
 * What it has instead is a time, because the whole value of a scratch note is
 * knowing whether it is from this morning's lecture or from March.
 */
export interface QuickNote {
  id: string;
  /** Free text, newlines and all. Kept exactly as typed. */
  text: string;
  createdAt: Date;
  /** Equal to createdAt until it is edited, which is how "edited" is told. */
  updatedAt: Date;
}

export function createQuickNote(text: string): QuickNote {
  const now = new Date();
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    // Trimmed at the ends only: internal blank lines are part of what was
    // written, and collapsing them would rewrite someone's note.
    text: text.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Newest first.
 *
 * The opposite of the other two lists, and deliberately. A to-do list is read
 * from the top to find what to do next; a scratchpad is read from the top to
 * find what you just wrote down.
 */
export function sortNotes(notes: QuickNote[]): QuickNote[] {
  return [...notes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Was this note changed after it was written? */
export function wasEdited(note: QuickNote): boolean {
  // A second of slack: created and updated are two `new Date()` calls in the
  // same tick, and a stored copy can round differently.
  return note.updatedAt.getTime() - note.createdAt.getTime() > 1000;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago, in as few words as possible.
 *
 * Relative while that is the useful reading, absolute once it stops being —
 * "6d ago" is a fact you can act on, "43d ago" is one you have to do arithmetic
 * on, so past a week it becomes a date.
 */
export function describeNoteTime(note: QuickNote, now: Date): string {
  const at = note.createdAt;
  const gap = now.getTime() - at.getTime();
  const prefix = wasEdited(note) ? 'edited ' : '';

  // A clock that is behind, or a note synced from a device whose clock is
  // ahead. Better to say "just now" than "in 3 minutes".
  if (gap < MINUTE) return `${prefix}just now`;
  if (gap < HOUR) return `${prefix}${Math.floor(gap / MINUTE)}m ago`;
  if (gap < DAY) return `${prefix}${Math.floor(gap / HOUR)}h ago`;
  if (gap < 7 * DAY) return `${prefix}${Math.floor(gap / DAY)}d ago`;

  const sameYear = at.getFullYear() === now.getFullYear();
  const date = at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${prefix}${date}`;
}

/** The first line, for anywhere a note has to fit on one. */
export function noteSummary(note: QuickNote): string {
  const [first = ''] = note.text.split('\n');
  return first.trim();
}
