import type { Task } from '../types/task';
import { describeDeadline, isEndOfDay } from '../lib/deadlines';
import { formatTime } from '../lib/time';

interface Props {
  /** Open tasks due on the selected day, soonest first. */
  tasks: Task[];
  now: Date;
  isToday: boolean;
}

/**
 * What is due on the day being looked at.
 *
 * The to-do list lives in the margin and answers "what do I owe overall". This
 * answers a different question the schedule column should be able to answer on
 * its own — "is anything due on this day" — which otherwise required noticing a
 * date in a list that is sorted by deadline, not by the day you happen to be
 * reading.
 *
 * Deliberately not drawn into the time grid. A deadline is a moment, not a
 * block, and giving it height on an hour axis would claim it occupies time it
 * does not.
 */
export default function DueToday({ tasks, now, isToday }: Props) {
  if (tasks.length === 0) return null;

  return (
    <div className="day-notes due-today">
      {tasks.map((task) => {
        const deadline = task.dueDate ? describeDeadline(task.dueDate, now) : null;
        const late = deadline?.urgency === 'overdue';

        return (
          <div
            key={task.id}
            className={`day-note kind-${late ? 'exam' : 'assignment'}${isToday ? ' today' : ''}`}
          >
            <span className="day-note-rail" aria-hidden="true" />
            <div className="day-note-body">
              <span className="day-note-eyebrow">
                {late && <span className="day-note-now">Overdue</span>}
                <span>{eyebrow(task)}</span>
              </span>
              <strong className="day-note-title">{task.title}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "Due · CHEM 101", or the time when one was actually set. */
function eyebrow(task: Task): string {
  const when =
    task.dueDate && !isEndOfDay(task.dueDate) ? `Due ${formatTime(task.dueDate)}` : 'Due';

  return task.courseCode ? `${when} · ${task.courseCode}` : when;
}
