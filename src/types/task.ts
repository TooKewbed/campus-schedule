/**
 * The task model.
 *
 * One model, two eventual views. The plan calls for the general to-do list and
 * the assignment tracker to share a single underlying record — "an assignment
 * is really just a task with a course and a due date attached." So `courseCode`
 * and `dueDate` exist here from day one but stay optional: the tracker ships
 * later as a filtered view over these same records, not as a parallel system
 * that has to be synced.
 */
export interface Task {
  id: string;
  title: string;
  done: boolean;
  /** Free-form notes. Always a string — empty rather than undefined, so the
   *  editor never has to distinguish "no notes" from "notes cleared". */
  notes: string;
  createdAt: Date;
  completedAt: Date | null;
  /** Set only for coursework. Reserved for the assignment tracker. */
  courseCode?: string;
  dueDate?: Date;
}

export function createTask(title: string): Task {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim(),
    done: false,
    notes: '',
    createdAt: new Date(),
    completedAt: null,
  };
}

/**
 * Ordering now lives in lib/deadlines as `groupTasks`, which splits the list
 * into time-sensitive, anytime and done rather than returning one sequence.
 * The single-sequence version was removed rather than left here, because a
 * second ordering nothing calls is a description of behaviour the app no
 * longer has.
 */

export function openCount(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + (t.done ? 0 : 1), 0);
}
