export const MAX_TITLE_LENGTH = 180;
export const MAX_TASKS = 500;
export const MAX_NOTES_LENGTH = 1000;
export type Priority = 'normal' | 'high' | 'low';
export type TaskDetails = { notes: string; dueDate: string; priority: Priority };

export type Task = Readonly<{
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  notes?: string;
  dueDate?: string;
  priority?: Priority;
}>;

export type TaskFilter = 'all' | 'active' | 'completed';

export type TaskAction =
  | { type: 'add'; task: Task }
  | { type: 'edit'; id: string; title: string; details: TaskDetails }
  | { type: 'set-many-completed'; ids: readonly string[]; completed: boolean }
  | { type: 'toggle'; id: string }
  | { type: 'set-completed'; id: string; completed: boolean }
  | { type: 'delete'; id: string }
  | { type: 'delete-many'; ids: readonly string[] }
  | { type: 'clear-completed' }
  | { type: 'restore'; tasks: readonly Task[] };

export class TaskInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskInputError';
  }
}

export function normalizeTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new TaskInputError('Напишите, что хотите сделать.');
  if (title.length > MAX_TITLE_LENGTH) {
    throw new TaskInputError(`В задаче может быть не больше ${MAX_TITLE_LENGTH} символов.`);
  }
  return title;
}

export function createTask(title: string, id: string, createdAt: number): Task {
  if (!id || !Number.isSafeInteger(createdAt) || createdAt <= 0) {
    throw new TaskInputError('Не удалось создать задачу. Попробуйте ещё раз.');
  }
  return { id, title: normalizeTitle(title), completed: false, createdAt };
}

export function validDate(value: unknown): value is string {
  if (value === '') return true;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '1900-01-01' ||
    value > '9999-12-31'
  )
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDetails(details: TaskDetails): TaskDetails {
  if (typeof details.notes !== 'string' || details.notes.length > MAX_NOTES_LENGTH)
    throw new TaskInputError(`В заметке может быть не больше ${MAX_NOTES_LENGTH} символов.`);
  if (!validDate(details.dueDate)) throw new TaskInputError('Укажите корректную дату.');
  if (!['normal', 'high', 'low'].includes(details.priority))
    throw new TaskInputError('Выберите приоритет.');
  return { notes: details.notes.trim(), dueDate: details.dueDate, priority: details.priority };
}

export function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 100 &&
    typeof item.title === 'string' &&
    item.title.trim().length > 0 &&
    item.title.length <= MAX_TITLE_LENGTH &&
    typeof item.completed === 'boolean' &&
    typeof item.createdAt === 'number' &&
    Number.isSafeInteger(item.createdAt) &&
    item.createdAt > 0 &&
    item.createdAt <= 8_640_000_000_000_000 &&
    (item.notes === undefined ||
      (typeof item.notes === 'string' && item.notes.length <= MAX_NOTES_LENGTH)) &&
    (item.dueDate === undefined || validDate(item.dueDate)) &&
    (item.priority === undefined || ['normal', 'high', 'low'].includes(item.priority as string))
  );
}

export function updateTasks(tasks: readonly Task[], action: TaskAction): Task[] {
  switch (action.type) {
    case 'add': {
      if (tasks.length >= MAX_TASKS) {
        throw new TaskInputError(
          `В списке уже ${MAX_TASKS} задач. Удалите ненужные, чтобы добавить новые.`,
        );
      }
      if (tasks.some((task) => task.id === action.task.id)) {
        throw new TaskInputError('Эта задача уже добавлена.');
      }
      return [action.task, ...tasks];
    }
    case 'edit': {
      if (!tasks.some((task) => task.id === action.id))
        throw new TaskInputError(
          'Задача удалена в другой вкладке. Закройте редактор и обновите список.',
        );
      const title = normalizeTitle(action.title);
      const details = validateDetails(action.details);
      return tasks.map((task) => (task.id === action.id ? { ...task, title, ...details } : task));
    }
    case 'set-many-completed': {
      const ids = new Set(action.ids);
      return tasks.map((task) =>
        ids.has(task.id) ? { ...task, completed: action.completed } : task,
      );
    }
    case 'toggle':
      return tasks.map((task) =>
        task.id === action.id ? { ...task, completed: !task.completed } : task,
      );
    case 'delete':
      return tasks.filter((task) => task.id !== action.id);
    case 'set-completed':
      return tasks.map((task) =>
        task.id === action.id ? { ...task, completed: action.completed } : task,
      );
    case 'delete-many': {
      const ids = new Set(action.ids);
      return tasks.filter((task) => !ids.has(task.id));
    }
    case 'clear-completed':
      return tasks.filter((task) => !task.completed);
    case 'restore': {
      const ids = new Set(tasks.map((task) => task.id));
      const restored = action.tasks.filter((task) => {
        if (ids.has(task.id)) return false;
        ids.add(task.id);
        return true;
      });
      if (tasks.length + restored.length > MAX_TASKS) {
        throw new TaskInputError('Не хватает места для восстановления. Освободите место в списке.');
      }
      return [...restored, ...tasks].sort((a, b) => b.createdAt - a.createdAt);
    }
  }
}

/** Replay unsaved intentions onto the latest state instead of overwriting a stale snapshot. */
export function replayTaskActions(
  canonical: readonly Task[],
  actions: readonly TaskAction[],
): Task[] {
  let tasks = [...canonical];
  for (const action of actions) {
    if (action.type === 'add' || action.type === 'restore') {
      const incoming = action.type === 'add' ? [action.task] : action.tasks;
      const ids = new Set(tasks.map((task) => task.id));
      const additions = incoming.filter((task) => {
        if (ids.has(task.id)) return false;
        ids.add(task.id);
        return true;
      });
      tasks = [...additions, ...tasks].sort((a, b) => b.createdAt - a.createdAt);
    } else if (action.type === 'edit' && !tasks.some((task) => task.id === action.id)) {
      // An external deletion wins; never resurrect a task with an old editor draft.
      continue;
    } else tasks = updateTasks(tasks, action);
  }
  if (tasks.length > MAX_TASKS) {
    throw new TaskInputError(
      'Объединённый список переполнен. Удалите ненужные задачи и повторите сохранение.',
    );
  }
  return tasks;
}

export function selectTasks(tasks: readonly Task[], filter: TaskFilter, query: string): Task[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return tasks.filter(
    (task) =>
      (filter === 'all' || (filter === 'completed' ? task.completed : !task.completed)) &&
      (!needle || task.title.toLocaleLowerCase('ru').includes(needle)),
  );
}

export function taskWord(count: number): string {
  if (count % 100 >= 11 && count % 100 <= 14) return 'задач';
  if (count % 10 === 1) return 'задача';
  if (count % 10 >= 2 && count % 10 <= 4) return 'задачи';
  return 'задач';
}
