import { addDays } from './calendar.ts';
export { localDate } from './calendar.ts';
import type { Task, TaskFilter } from './tasks.ts';

export type TaskView =
  TaskFilter | 'today' | 'overdue' | 'upcoming' | 'undated' | 'focus' | 'inbox';
export type TaskSort = 'newest' | 'oldest' | 'priority' | 'due';

export function matchesView(task: Task, view: TaskView, today: string): boolean {
  if (view === 'focus')
    return (
      !task.completed && (task.focusDate === today || (!!task.dueDate && task.dueDate <= today))
    );
  if (view === 'inbox') return !task.completed && !task.projectId;
  if (view === 'upcoming')
    return (
      !task.completed &&
      !!task.dueDate &&
      task.dueDate >= today &&
      task.dueDate <= addDays(today, 6)
    );
  if (view === 'undated') return !task.completed && !task.dueDate;
  if (view === 'today') return !task.completed && task.dueDate === today;
  if (view === 'overdue') return !task.completed && !!task.dueDate && task.dueDate < today;
  return view === 'all' || (view === 'completed' ? task.completed : !task.completed);
}

export function queryTasks(
  tasks: readonly Task[],
  view: TaskView,
  query: string,
  sort: TaskSort,
  today: string,
): Task[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  const result = tasks.filter(
    (task) =>
      matchesView(task, view, today) &&
      (!needle ||
        `${task.title}\n${task.notes ?? ''}\n${task.steps?.map((step) => step.title).join(' ') ?? ''}`
          .toLocaleLowerCase('ru')
          .includes(needle)),
  );
  const rank = { high: 0, normal: 1, low: 2 };
  return result.sort((a, b) => {
    if (sort === 'oldest') return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
    if (sort === 'priority')
      return (
        rank[a.priority ?? 'normal'] - rank[b.priority ?? 'normal'] || b.createdAt - a.createdAt
      );
    if (sort === 'due')
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt - a.createdAt;
    return b.createdAt - a.createdAt || a.id.localeCompare(b.id);
  });
}

export function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T12:00:00`),
  );
}

/** One scope definition is shared by rendering and destructive list actions. */
export function queryWorkspaceTasks(
  tasks: readonly Task[],
  options: {
    view: TaskView;
    query: string;
    sort: TaskSort;
    today: string;
    projectId: string | null;
    calendarDay: string;
  },
): Task[] {
  const scoped = tasks.filter((task) => !options.projectId || task.projectId === options.projectId);
  return queryTasks(
    scoped,
    options.calendarDay ? 'all' : options.view,
    options.query,
    options.sort,
    options.today,
  )
    .filter((task) => !options.calendarDay || task.dueDate === options.calendarDay)
    .sort((a, b) => Number(a.completed) - Number(b.completed));
}
