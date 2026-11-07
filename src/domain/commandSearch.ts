import type { Task } from './tasks.ts';
import type { Project } from './projects.ts';
import { queryTasks } from './taskQueries.ts';
import type { TaskView } from './taskQueries.ts';

export type CommandResult =
  | { kind: 'task'; key: string; label: string; task: Task }
  | { kind: 'project'; key: string; label: string; project: Project }
  | { kind: 'view'; key: string; label: string; view: TaskView }
  | { kind: 'create' | 'calendar' | 'files'; key: string; label: string };

export function commandSearch(
  tasks: readonly Task[],
  projects: readonly Project[],
  query: string,
  today: string,
): CommandResult[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  const navigation: CommandResult[] = [
    { kind: 'create', key: 'create', label: 'Добавить задачу' },
    { kind: 'view', key: 'focus', label: 'Мой день', view: 'focus' },
    { kind: 'view', key: 'all', label: 'Все задачи', view: 'all' },
    { kind: 'view', key: 'inbox', label: 'Входящие', view: 'inbox' },
    { kind: 'view', key: 'upcoming', label: 'Ближайшая неделя', view: 'upcoming' },
    { kind: 'calendar', key: 'calendar', label: 'Календарь' },
    { kind: 'files', key: 'files', label: 'Файлы и вложения' },
  ];
  return [
    ...navigation.filter((item) => !needle || item.label.toLocaleLowerCase('ru').includes(needle)),
    ...projects
      .filter((project) => !needle || project.title.toLocaleLowerCase('ru').includes(needle))
      .slice(0, 5)
      .map((project): CommandResult => ({
        kind: 'project',
        key: `project:${project.id}`,
        label: project.title,
        project,
      })),
    ...queryTasks(tasks, 'all', needle, 'newest', today)
      .slice(0, needle ? 12 : 4)
      .map((task): CommandResult => ({
        kind: 'task',
        key: `task:${task.id}`,
        label: task.title,
        task,
      })),
  ];
}
