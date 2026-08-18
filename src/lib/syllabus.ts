import { createMarker, type DayMarker } from '../types/dayMarker';

/**
 * Pulling dates out of syllabus text.
 *
 * This is pattern matching, not comprehension, and it is wrong often enough
 * that nothing here writes to the calendar. Everything returns *candidates* for
 * a human to approve. That framing drives the design: it is better to surface a
 * doubtful row and let it be unticked than to silently drop a real exam, so the
 * matching leans inclusive and reports how sure it is instead of filtering.
 *
 * The one thing worth being strict about is the date itself. A wrong title on
 * an exam is an annoyance; a wrong date is the failure mode that matters.
 */

export type DateKind = 'exam' | 'quiz' | 'assignment' | 'project' | 'break' | 'other';

export type Confidence = 'high' | 'medium' | 'low';

export interface Candidate {
  id: string;
  title: string;
  kind: DateKind;
  month: number;
  day: number;
  year: number;
  /** Inclusive last day. Equal to the start for a single date. */
  endMonth: number;
  endDay: number;
  endYear: number;
  /** Days covered, 1 for a single date. */
  span: number;
  confidence: Confidence;
  /** The line it came from, so the review list can show its working. */
  context: string;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** "sept" is common in syllabi and is not a prefix-match for "september". */
const MONTH_ALIASES: Record<string, number> = { sept: 9 };

const WEEKDAYS =
  /^(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s*/i;

/**
 * Keyword sets, checked in this order. "No class" wins over everything because
 * a cancelled session is the one entry whose meaning is inverted by getting the
 * category wrong.
 */
const KEYWORDS: { kind: DateKind; words: RegExp }[] = [
  { kind: 'break', words: /\b(no class(es)?|no lecture|holiday|break|recess|closed|no meeting)\b/i },
  // "Final" alone means the exam, but "final project" and "final paper" are the
  // other thing entirely — so the bare word only counts when nothing that turns
  // it into coursework follows it.
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
  other: 'Date',
};

/* ------------------------------------------------------------------ dates -- */

interface FoundDate {
  month: number;
  day: number;
  /** Explicit in the text, otherwise null and resolved against today. */
  year: number | null;
  endMonth: number;
  endDay: number;
  endYear: number | null;
  start: number;
  end: number;
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function monthFromName(raw: string): number | null {
  const word = raw.toLowerCase().replace(/\./g, '');
  if (MONTH_ALIASES[word]) return MONTH_ALIASES[word];
  const index = MONTHS.findIndex((m) => m.startsWith(word) && word.length >= 3);
  return index === -1 ? null : index + 1;
}

/**
 * Every date in one line, with the span it occupies so the title can have it
 * cut out afterwards.
 *
 * Two shapes are recognised: "Oct 16" and "10/16". Day-first forms like
 * "16 Oct" are deliberately not, because in a US syllabus "16 3" style noise
 * from a table produces more false matches than the format is worth.
 */
function findDates(line: string): FoundDate[] {
  const found: FoundDate[] = [];

  // "Oct 16", "October 16th, 2026", optionally a range: "Oct 16-18",
  // "Oct 16 - Nov 2", "Nov 26 to 28".
  const named =
    /\b([A-Z][a-z]{2,8})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?(?:\s*(?:-|–|—|to|through)\s*(?:([A-Z][a-z]{2,8})\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?)?/g;

  for (const m of line.matchAll(named)) {
    const month = monthFromName(m[1]);
    if (month === null) continue;

    const day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : null;
    if (!validDay(month, day, year)) continue;

    let endMonth = month;
    let endDay = day;
    let endYear = year;

    if (m[5]) {
      const nextMonth = m[4] ? monthFromName(m[4]) : month;
      const nextDay = Number(m[5]);
      const nextYear = m[6] ? Number(m[6]) : year;
      if (nextMonth !== null && validDay(nextMonth, nextDay, nextYear)) {
        endMonth = nextMonth;
        endDay = nextDay;
        endYear = nextYear;
      }
    }

    found.push({
      month, day, year,
      endMonth, endDay, endYear,
      start: m.index, end: m.index + m[0].length,
    });
  }

  // "10/16", "10/16/2026", and ranges "10/16-10/18" or "10/16-18".
  const numeric =
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:-|–|—|to)\s*(?:(\d{1,2})\/)?(\d{1,2})(?:\/(\d{2,4}))?)?\b/g;

  for (const m of line.matchAll(numeric)) {
    // Skip anything already covered by a named-month match.
    if (found.some((f) => m.index < f.end && m.index + m[0].length > f.start)) continue;

    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = m[3] ? expandYear(Number(m[3])) : null;
    if (month < 1 || month > 12) continue;
    if (!validDay(month, day, year)) continue;

    let endMonth = month;
    let endDay = day;
    let endYear = year;

    if (m[5]) {
      const nextMonth = m[4] ? Number(m[4]) : month;
      const nextDay = Number(m[5]);
      const nextYear = m[6] ? expandYear(Number(m[6])) : year;
      if (nextMonth >= 1 && nextMonth <= 12 && validDay(nextMonth, nextDay, nextYear)) {
        endMonth = nextMonth;
        endDay = nextDay;
        endYear = nextYear;
      }
    }

    found.push({
      month, day, year,
      endMonth, endDay, endYear,
      start: m.index, end: m.index + m[0].length,
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

function validDay(month: number, day: number, year: number | null): boolean {
  if (day < 1) return false;
  // A leap-year 29 February is valid, so an unknown year assumes one.
  return day <= daysInMonth(month, year ?? 2024);
}

function expandYear(value: number): number {
  return value >= 100 ? value : 2000 + value;
}

/**
 * The year a bare "Oct 16" means.
 *
 * A syllabus is read shortly before or during its term, so the intended year is
 * the one that puts the date nearest today. That resolves the case a fixed
 * "current year" gets wrong: the January dates in a Fall syllabus belong to
 * next year, not this one.
 */
function resolveYear(month: number, day: number, today: Date): number {
  const base = today.getFullYear();
  let best = base;
  let bestDistance = Infinity;

  for (const year of [base - 1, base, base + 1]) {
    const distance = Math.abs(new Date(year, month - 1, day).getTime() - today.getTime());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = year;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ lines -- */

function classify(line: string): DateKind {
  for (const { kind, words } of KEYWORDS) {
    if (words.test(line)) return kind;
  }
  return 'other';
}

/** What the line says once the date, and the scaffolding around it, is gone. */
function titleFrom(line: string, date: FoundDate): string {
  let text = line.slice(0, date.start) + ' ' + line.slice(date.end);

  text = text
    .replace(/\s+/g, ' ')
    .replace(/\bweek\s+\d+\b/i, '')
    .replace(WEEKDAYS, '')
    // Table cells arrive glued together by separators that are not words.
    .replace(/[|•·–—‐-]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:;.\-–—]+|[\s,:;.\-–—]+$/g, '')
    .trim();

  // Leading weekday can reappear once separators are stripped.
  text = text.replace(WEEKDAYS, '').trim();

  // "Exam 1 will be held on Thursday" — the weekday sat beside the date that
  // was just cut out, and reads as debris once it is gone.
  text = text
    .replace(/\b(on\s+)?(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\.?[\s,]*$/i, '')
    .replace(/[\s,:;.\-–—]+$/, '')
    .trim();

  if (text.length > 90) text = text.slice(0, 87).trimEnd() + '…';
  return text;
}

/* ----------------------------------------------------------------- public -- */

export interface ExtractOptions {
  /** Overridable so the behaviour is testable rather than clock-dependent. */
  today?: Date;
}

/** Anything a person would not read as a schedule entry. */
const NOISE = /^(page|copyright|©|syllabus|instructor|office hours?|email|phone|prereq)/i;

export function extractDates(text: string, options: ExtractOptions = {}): Candidate[] {
  const today = options.today ?? new Date();
  const lines = text.split(/\r?\n/);
  const candidates: Candidate[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line || line.length > 400) continue;
    if (NOISE.test(line)) continue;

    const dates = findDates(line);
    if (dates.length === 0) continue;

    const kind = classify(line);

    // A row listing many dates is usually a table header or a week range; past
    // three, the line is not describing one event and the guesses get worse.
    for (const date of dates.slice(0, 3)) {
      const year = date.year ?? resolveYear(date.month, date.day, today);
      const endYear = date.endYear ?? (date.endMonth < date.month ? year + 1 : year);

      const start = new Date(year, date.month - 1, date.day);
      const end = new Date(endYear, date.endMonth - 1, date.endDay);
      // A backwards range means the two numbers were never one range.
      const span =
        end >= start
          ? Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 14)
          : 1;

      const title = titleFrom(line, date);
      const confidence: Confidence =
        kind !== 'other' ? 'high' : title.length >= 3 ? 'medium' : 'low';

      candidates.push({
        id: `cand-${candidates.length}-${date.month}-${date.day}`,
        title: title || KIND_LABEL[kind],
        kind,
        month: date.month,
        day: date.day,
        year,
        endMonth: span > 1 ? date.endMonth : date.month,
        endDay: span > 1 ? date.endDay : date.day,
        endYear: span > 1 ? endYear : year,
        span,
        confidence,
        context: line,
      });
    }
  }

  return dedupe(candidates).sort(
    (a, b) =>
      new Date(a.year, a.month - 1, a.day).getTime() -
      new Date(b.year, b.month - 1, b.day).getTime(),
  );
}

/**
 * The same entry often appears twice — once in a table, once in prose. Matching
 * on date plus normalised title keeps the more confident copy.
 */
function dedupe(list: Candidate[]): Candidate[] {
  const rank: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
  const seen = new Map<string, Candidate>();

  for (const item of list) {
    const key = `${item.year}-${item.month}-${item.day}-${item.title.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || rank[item.confidence] > rank[existing.confidence]) seen.set(key, item);
  }
  return [...seen.values()];
}

/** Ticked by default. Low-confidence rows are shown but left for the user. */
export function defaultSelection(list: Candidate[]): Set<string> {
  return new Set(list.filter((c) => c.confidence !== 'low').map((c) => c.id));
}

/**
 * Turn an approved candidate into calendar markers.
 *
 * A range becomes one marker per day rather than a single marker on the first
 * day: "no class Nov 26-28" is three days off, and a calendar that shows it on
 * Tuesday alone is telling you something untrue about Wednesday.
 */
export function markersFrom(candidate: Candidate, courseCode: string): DayMarker[] {
  const markers: DayMarker[] = [];
  const cursor = new Date(candidate.year, candidate.month - 1, candidate.day);

  for (let i = 0; i < candidate.span; i++) {
    const marker = createMarker(
      candidate.title,
      cursor.getMonth() + 1,
      cursor.getDate(),
      cursor.getFullYear(),
    );
    markers.push({
      ...marker,
      id: `${marker.id}-${i}`,
      source: 'syllabus',
      courseCode: courseCode.trim() || undefined,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return markers;
}

/** "Oct 16" or "Nov 26 – 28" for the review list. */
export function describeCandidate(candidate: Candidate): string {
  const start = new Date(candidate.year, candidate.month - 1, candidate.day);
  const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (candidate.span <= 1) return label;

  const end = new Date(candidate.endYear, candidate.endMonth - 1, candidate.endDay);
  const endLabel =
    candidate.endMonth === candidate.month
      ? String(candidate.endDay)
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${label} – ${endLabel}`;
}
