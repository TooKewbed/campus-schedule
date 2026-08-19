import { colorFor } from './colors';
import { extractCourseCode } from './categorize';
import type { ColorName, ScheduleEvent } from '../types/event';
import type { Task } from '../types/task';

/**
 * The courses a person is taking, read off what they have already entered.
 *
 * There is deliberately no course record to create and maintain. A course is
 * whatever course codes appear on the schedule and on tagged tasks, which means
 * the list is correct the moment a class is added and cannot drift out of step
 * with the timetable. It also means nobody has to set up courses before the app
 * is useful — the setup step that kills this kind of app.
 */

export interface Course {
  /** e.g. "CHEM 101". */
  code: string;
  /** Matches the colour its blocks are drawn in on the grid. */
  color: ColorName;
  /** Meetings on the schedule; 0 for a course only ever typed onto a task. */
  meetings: number;
}

/**
 * The colour a course is drawn in.
 *
 * Taken from a real event where there is one, so a course chip on a task is
 * exactly the colour of that course's blocks. Where there is no event — a task
 * tagged with a class that is not on the schedule — the same function is asked
 * with a stand-in carrying only the course code, which is the field the
 * automatic colour is derived from anyway. Consistency by construction rather
 * than by two functions agreeing to use the same hash.
 */
export function courseColor(code: string, events: ScheduleEvent[]): ColorName {
  const sample = events.find((e) => e.courseCode === code);
  if (sample) return colorFor(sample);

  return colorFor({
    id: code,
    title: code,
    courseCode: code,
    start: new Date(0),
    end: new Date(0),
    category: 'class',
    source: 'manual',
    recurring: false,
  });
}

/** Every course known to the app, busiest first, then alphabetical. */
export function coursesFrom(events: ScheduleEvent[], tasks: Task[] = []): Course[] {
  const meetings = new Map<string, number>();

  for (const event of events) {
    if (event.courseCode) meetings.set(event.courseCode, (meetings.get(event.courseCode) ?? 0) + 1);
  }
  // A course can exist only on a task — something tagged for a class that has
  // no meetings on the timetable, like an online section.
  for (const task of tasks) {
    if (task.courseCode && !meetings.has(task.courseCode)) meetings.set(task.courseCode, 0);
  }

  return [...meetings.entries()]
    .map(([code, count]) => ({ code, color: courseColor(code, events), meetings: count }))
    .sort((a, b) => b.meetings - a.meetings || a.code.localeCompare(b.code));
}

/** Courses that actually have tasks against them, for a filter that isn't noise. */
export function coursesWithTasks(courses: Course[], tasks: Task[]): Course[] {
  const tagged = new Set(tasks.map((t) => t.courseCode).filter(Boolean));
  return courses.filter((c) => tagged.has(c.code));
}

const LEADING_CODE = /^([A-Za-z]{2,4})[\s-]?(\d{3}[A-Za-z]?)\b[\s:.\-–]*/;

/**
 * A course code typed at the front of a task title.
 *
 * "CHEM 101 lab report" becomes the course plus "lab report". Only a *leading*
 * code is taken: "Read CHEM 101 chapter 4" keeps its title intact, because
 * cutting the code out of the middle leaves "Read chapter 4" — a sentence about
 * a different thing. The code is still detected there, just not removed.
 *
 * Shouted codes are matched anywhere, because the capitals are what make
 * "CHEM 101" unambiguous. A lowercase "chem101" is only accepted when it names
 * a class already on the schedule — nobody writes their course in lower case by
 * accident, but plenty of people write "top 100 songs", and only the `known`
 * check can tell those apart.
 */
export function splitCourseFromTitle(
  raw: string,
  known: string[] = [],
): { courseCode?: string; title: string } {
  const title = raw.trim();
  const leading = LEADING_CODE.exec(title);

  // The strict, capitals-only reading, which also catches a code mid-sentence.
  let code = extractCourseCode(title);

  if (!code && leading) {
    const candidate = `${leading[1].toUpperCase()} ${leading[2].toUpperCase()}`;
    if (known.includes(candidate)) code = candidate;
  }

  if (!code) return { title };
  if (!leading) return { courseCode: code, title };

  // Only strip the prefix when it is the code we actually matched; a title like
  // "ABC 123 notes on CHEM 101" should not lose a prefix it was not tagged for.
  const prefix = `${leading[1].toUpperCase()} ${leading[2].toUpperCase()}`;
  if (prefix !== code) return { courseCode: code, title };

  const rest = title.slice(leading[0].length).trim();
  // Leaving the title empty would produce a task called nothing; when the code
  // is all there is, it is the title.
  return rest ? { courseCode: code, title: rest } : { courseCode: code, title };
}

export function tasksForCourse(tasks: Task[], code: string | null): Task[] {
  if (!code) return tasks;
  return tasks.filter((t) => t.courseCode === code);
}

/** Open tasks due on a given calendar day, soonest first. */
export function dueOn(tasks: Task[], date: Date): Task[] {
  return tasks
    .filter(
      (t) =>
        !t.done &&
        t.dueDate &&
        t.dueDate.getFullYear() === date.getFullYear() &&
        t.dueDate.getMonth() === date.getMonth() &&
        t.dueDate.getDate() === date.getDate(),
    )
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
}
