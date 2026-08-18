/**
 * What an important date is, read from what it is called.
 *
 * An exam and a birthday need different reactions, so they are coloured
 * differently on the day view and in the week strip. The kind is derived from
 * the title rather than stored on the marker: it can always be recomputed, so
 * storing it would only create a second version able to disagree with the
 * first, and would need a database column to hold it.
 */

export type DateKind = 'exam' | 'quiz' | 'assignment' | 'project' | 'break' | 'other';

/**
 * Checked in this order. "No class" wins over everything because a cancelled
 * session is the one entry whose meaning is inverted by getting it wrong.
 *
 * "Final" alone means the exam, but "final project" and "final paper" are the
 * other thing entirely, so the bare word only counts when nothing that turns it
 * into coursework follows it.
 */
const KEYWORDS: { kind: DateKind; words: RegExp }[] = [
  { kind: 'break', words: /\b(no class(es)?|no lecture|holiday|break|recess|closed|no meeting)\b/i },
  {
    kind: 'exam',
    words: /\b(exam|midterm|test)\b|\bfinals?\b(?!\s+(project|paper|essay|presentation|report|portfolio))/i,
  },
  { kind: 'quiz', words: /\bquiz(zes)?\b/i },
  { kind: 'project', words: /\b(project|paper|essay|presentation|report|portfolio)\b/i },
  { kind: 'assignment', words: /\b(due|deadline|submit|turn in|assignment|homework|hw\b|problem set|pset)\b/i },
];

export const KIND_LABEL: Record<DateKind, string> = {
  exam: 'Exam',
  quiz: 'Quiz',
  assignment: 'Due',
  project: 'Project',
  break: 'No class',
  other: 'Important date',
};

export function classifyTitle(title: string): DateKind {
  for (const { kind, words } of KEYWORDS) {
    if (words.test(title)) return kind;
  }
  return 'other';
}

/** Holidays are generated, never reclassified from their wording. */
export type MarkerKind = DateKind | 'holiday';

export function markerKind(marker: { title: string; source: string }): MarkerKind {
  return marker.source === 'holiday' ? 'holiday' : classifyTitle(marker.title);
}

/**
 * When a day holds several dates, the one worth colouring the day by.
 *
 * Ordered by how much trouble missing it causes, which is not the same as how
 * soon it is: a day with an exam and a birthday is an exam day.
 */
const KIND_PRIORITY: MarkerKind[] = [
  'exam', 'quiz', 'project', 'assignment', 'break', 'other', 'holiday',
];

export function dominantKind(markers: { title: string; source: string }[]): MarkerKind {
  let best: MarkerKind = 'holiday';
  let bestRank = KIND_PRIORITY.length;

  for (const marker of markers) {
    const rank = KIND_PRIORITY.indexOf(markerKind(marker));
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
      best = KIND_PRIORITY[rank];
    }
  }
  return best;
}
