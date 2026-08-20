/**
 * Icons shared between the to-do list and the shopping list.
 *
 * Only the three both lists actually use live here. The clock, bell and repeat
 * glyphs stay in TaskList, because they draw concepts the shopping list does
 * not have — moving them here would suggest otherwise.
 */

export function CheckGlyph() {
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

export function NoteGlyph({ filled }: { filled: boolean }) {
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

export function TrashGlyph() {
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
