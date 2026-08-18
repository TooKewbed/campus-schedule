import type { EventCategory } from '../types/event';

/**
 * Infer a category from an .ics event's text. Registrar exports and Google
 * Calendar files carry no notion of "this is optional", so the fixed/flexible
 * split has to be inferred here — and the user can always correct it later.
 *
 * Order matters: "Physics Lab Office Hours" is office hours, not a lab.
 */
const RULES: { category: EventCategory; pattern: RegExp }[] = [
  { category: 'office-hours', pattern: /\boffice\s*hours?\b|\bo\/h\b/i },
  { category: 'tutoring', pattern: /\btutor(ing|ial)?\b|\bhelp\s*(room|desk|session)\b/i },
  { category: 'study', pattern: /\bstudy\b|\breview\s*session\b|\bstudy\s*group\b|\bsi\s*session\b/i },
  { category: 'exam', pattern: /\b(exam|midterm|final|quiz)\b/i },
  { category: 'lab', pattern: /\blab(oratory)?\b|\brecitation\b|\bdiscussion\s*section\b/i },
  { category: 'work', pattern: /\bwork\b|\bshift\b|\bjob\b|\bemployment\b/i },
  { category: 'appointment', pattern: /\bappointment\b|\badvis(ing|or)\b|\bmeeting\b|\bdoctor\b|\bdentist\b/i },
];

/** Explicit CATEGORIES values win over guessing from the summary. */
const EXPLICIT: Record<string, EventCategory> = {
  class: 'class',
  lecture: 'class',
  lab: 'lab',
  exam: 'exam',
  work: 'work',
  'office hours': 'office-hours',
  'office-hours': 'office-hours',
  study: 'study',
  tutoring: 'tutoring',
  appointment: 'appointment',
};

export function inferCategory(
  summary: string,
  description = '',
  categories: string[] = [],
): EventCategory {
  for (const raw of categories) {
    const hit = EXPLICIT[raw.trim().toLowerCase()];
    if (hit) return hit;
  }

  const haystack = `${summary} ${description}`;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.category;
  }

  // Default to fixed. Over-blocking time is the safe error: a student sees a
  // busy slot that was actually free, rather than missing something real.
  return 'class';
}

const COURSE_CODE = /\b([A-Z]{2,4})[\s-]?(\d{3}[A-Z]?)\b/;

export function extractCourseCode(summary: string): string | undefined {
  const match = COURSE_CODE.exec(summary);
  return match ? `${match[1]} ${match[2]}` : undefined;
}
