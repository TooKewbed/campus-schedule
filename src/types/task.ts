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
 * Open tasks first in the order they were added, completed ones below with the
 * most recently finished on top. Stable ordering matters more than clever
 * ordering: a list that reshuffles as you check things off is hard to use.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) {
      return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function openCount(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + (t.done ? 0 : 1), 0);
}
