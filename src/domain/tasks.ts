export const MAX_TITLE_LENGTH = 180;
export const MAX_TASKS = 500;
export const MAX_NOTES_LENGTH = 1000;
export const MAX_STEPS = 20;
export const MAX_STEP_TITLE = 120;
export type TaskStep = Readonly<{ id: string; title: string; completed: boolean }>;
export type DateChange = { id: string; dueDate: string; expectedDate?: string };
export type Priority = 'normal' | 'high' | 'low';
export type TaskDetails = {
  notes: string;
  dueDate: string;
  priority: Priority;
  projectId?: string;
  steps?: readonly TaskStep[];
  focusDate?: string;
};
export type TaskPatch = Partial<TaskDetails>;

export type Task = Readonly<{
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  notes?: string;
  dueDate?: string;
  priority?: Priority;
  projectId?: string;
  steps?: readonly TaskStep[];
  focusDate?: string;
}>;

export type TaskFilter = 'all' | 'active' | 'completed';

export type TaskAction =
  | { type: 'set-dates'; changes: readonly DateChange[] }
  | { type: 'add'; task: Task }
  | { type: 'set-focus'; id: string; date: string }
  | { type: 'set-step'; id: string; stepId: string; completed: boolean }
  | {
      type: 'edit';
      id: string;
      title?: string;
      details: TaskPatch;
      baseSteps?: readonly TaskStep[];
    }
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

export function isTaskStep(value: unknown): value is TaskStep {
  if (!value || typeof value !== 'object') return false;
  const step = value as Record<string, unknown>;
  return (
    typeof step.id === 'string' &&
    step.id.length > 0 &&
    step.id.length <= 100 &&
    typeof step.title === 'string' &&
    step.title.trim().length > 0 &&
    step.title.length <= MAX_STEP_TITLE &&
    typeof step.completed === 'boolean'
  );
}
export function validSteps(value: unknown): value is readonly TaskStep[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_STEPS &&
    value.every(isTaskStep) &&
    new Set(value.map((step) => step.id)).size === value.length
  );
}
function completedTask(task: Task, completed: boolean): Task {
  return {
    ...task,
    completed,
    ...(completed && task.steps
      ? { steps: task.steps.map((step) => ({ ...step, completed: true })) }
      : {}),
  };
}

/** Apply only the checklist changes made in this draft, retaining other-tab edits. */
export function mergeSteps(
  current: readonly TaskStep[],
  baseline: readonly TaskStep[],
  draft: readonly TaskStep[],
): readonly TaskStep[] {
  const base = new Map(baseline.map((step) => [step.id, step]));
  const edited = new Map(draft.map((step) => [step.id, step]));
  const merged = current.flatMap((step) => {
    const before = base.get(step.id);
    if (!before) return [step]; // Added by another tab.
    const after = edited.get(step.id);
    if (!after) return []; // Explicitly removed in this draft.
    return [
      {
        ...step,
        ...(after.title !== before.title ? { title: after.title } : {}),
        ...(after.completed !== before.completed ? { completed: after.completed } : {}),
      },
    ];
  });
  const ids = new Set(merged.map((step) => step.id));
  for (const step of draft)
    if (!base.has(step.id) && !ids.has(step.id)) {
      merged.push(step);
      ids.add(step.id);
    }
  // Baseline steps deleted elsewhere never reappear through an old draft.
  return merged;
}

export function validateDetails(details: TaskDetails): TaskDetails {
  if (typeof details.notes !== 'string' || details.notes.length > MAX_NOTES_LENGTH)
    throw new TaskInputError(`В заметке может быть не больше ${MAX_NOTES_LENGTH} символов.`);
  if (!validDate(details.dueDate)) throw new TaskInputError('Укажите корректную дату.');
  if (!['normal', 'high', 'low'].includes(details.priority))
    throw new TaskInputError('Выберите приоритет.');
  if (
    details.projectId !== undefined &&
    (typeof details.projectId !== 'string' || details.projectId.length > 100)
  )
    throw new TaskInputError('Выбери проект.');
  if (details.steps !== undefined && !validSteps(details.steps))
    throw new TaskInputError('Проверь шаги задачи: до 20 шагов, каждый до 120 символов.');
  if (details.focusDate !== undefined && !validDate(details.focusDate))
    throw new TaskInputError('Проверь дату фокуса.');
  return {
    notes: details.notes.trim(),
    dueDate: details.dueDate,
    priority: details.priority,
    ...(details.projectId !== undefined ? { projectId: details.projectId } : {}),
    ...(details.steps !== undefined
      ? {
          steps: details.steps.map((step) => ({
            id: step.id,
            title: step.title.trim(),
            completed: step.completed,
          })),
        }
      : {}),
    ...(details.focusDate !== undefined ? { focusDate: details.focusDate } : {}),
  };
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
    (item.priority === undefined || ['normal', 'high', 'low'].includes(item.priority as string)) &&
    (item.projectId === undefined ||
      (typeof item.projectId === 'string' && item.projectId.length <= 100)) &&
    (item.steps === undefined || validSteps(item.steps)) &&
    (item.focusDate === undefined || validDate(item.focusDate))
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
    case 'set-focus': {
      if (!validDate(action.date)) throw new TaskInputError('Проверь дату фокуса.');
      return tasks.map((task) =>
        task.id === action.id ? { ...task, focusDate: action.date } : task,
      );
    }
    case 'set-step':
      return tasks.map((task) =>
        task.id !== action.id || !task.steps?.some((step) => step.id === action.stepId)
          ? task
          : {
              ...task,
              ...(action.completed ? {} : { completed: false }),
              steps: (task.steps ?? []).map((step) =>
                step.id === action.stepId ? { ...step, completed: action.completed } : step,
              ),
            },
      );
    case 'set-dates': {
      for (const change of action.changes) {
        if (
          !validDate(change.dueDate) ||
          (change.expectedDate !== undefined && !validDate(change.expectedDate))
        )
          throw new TaskInputError('Укажите корректную дату.');
      }
      const changes = new Map(action.changes.map((change) => [change.id, change]));
      return tasks.map((task) => {
        const change = changes.get(task.id);
        if (
          !change ||
          (change.expectedDate !== undefined && (task.dueDate ?? '') !== change.expectedDate)
        )
          return task;
        return { ...task, dueDate: change.dueDate };
      });
    }
    case 'edit': {
      const existing = tasks.find((task) => task.id === action.id);
      if (!existing)
        throw new TaskInputError(
          'Задача удалена в другой вкладке. Закройте редактор и обновите список.',
        );
      const title = action.title === undefined ? existing.title : normalizeTitle(action.title);
      const patch = { ...action.details };
      if (patch.steps !== undefined && action.baseSteps !== undefined) {
        if (!validSteps(patch.steps) || !validSteps(action.baseSteps))
          throw new TaskInputError('Проверь шаги задачи.');
        patch.steps = mergeSteps(existing.steps ?? [], action.baseSteps, patch.steps);
      }
      const details = validateDetails({
        notes: existing.notes ?? '',
        dueDate: existing.dueDate ?? '',
        priority: existing.priority ?? 'normal',
        ...patch,
      });
      return tasks.map((task) => {
        if (task.id !== action.id) return task;
        const next = { ...task, title, ...details };
        return details.steps?.some((step) => !step.completed) && task.completed
          ? { ...next, completed: false }
          : next;
      });
    }
    case 'set-many-completed': {
      const ids = new Set(action.ids);
      return tasks.map((task) => (ids.has(task.id) ? completedTask(task, action.completed) : task));
    }
    case 'toggle':
      return tasks.map((task) =>
        task.id === action.id ? completedTask(task, !task.completed) : task,
      );
    case 'delete':
      return tasks.filter((task) => task.id !== action.id);
    case 'set-completed':
      return tasks.map((task) =>
        task.id === action.id ? completedTask(task, action.completed) : task,
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
  checkCapacity = true,
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
  if (checkCapacity && tasks.length > MAX_TASKS) {
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
