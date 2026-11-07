import type { Task, TaskDetails, TaskPatch, TaskStep, Priority } from './tasks.ts';
import { MAX_ATTACHMENTS, MAX_FILE_BYTES, MAX_FILE_SIZE } from './attachments.ts';
import { TaskInputError, validateDetails, parseTags, taskStatus } from './tasks.ts';
import type { WorkState, Recurrence, TaskStatus } from './tasks.ts';
import { newId } from './ids.ts';

export type TaskDraft = {
  title: string;
  notes: string;
  dueDate: string;
  priority: Priority;
  projectId: string;
  focusDate: string;
  steps: readonly TaskStep[];
  stepDraft: string;
  tagsText: string;
  workState: WorkState;
  recurrence: Recurrence;
  status: TaskStatus;
};
export function taskDraft(task?: Task, defaults: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: task?.title ?? '',
    notes: task?.notes ?? '',
    dueDate: task?.dueDate ?? '',
    priority: task?.priority ?? 'normal',
    projectId: task?.projectId ?? '',
    focusDate: task?.focusDate ?? '',
    steps: task?.steps ?? [],
    stepDraft: '',
    tagsText: task?.tags?.join(', ') ?? '',
    workState: task?.workState ?? 'todo',
    recurrence: task?.recurrence ?? '',
    status: task ? taskStatus(task) : 'todo',
    ...defaults,
  };
}
export function draftDetails(draft: TaskDraft): TaskDetails {
  return validateDetails({
    notes: draft.notes,
    dueDate: draft.dueDate,
    priority: draft.priority,
    projectId: draft.projectId,
    focusDate: draft.focusDate,
    steps: draft.steps,
    tags: parseTags(draft.tagsText),
    workState: draft.status === 'done' ? draft.workState : draft.status,
    recurrence: draft.recurrence,
  });
}
export function materializeDraft(draft: TaskDraft): TaskDraft {
  const title = draft.stepDraft.trim();
  return !title
    ? draft
    : {
        ...draft,
        stepDraft: '',
        status: draft.status === 'done' ? draft.workState : draft.status,
        steps: [...draft.steps, { id: newId(), title, completed: false }],
      };
}
export function draftChanges(
  baseline: TaskDraft,
  draft: TaskDraft,
): { title: string | undefined; details: TaskPatch; status?: TaskStatus } {
  const details: TaskPatch = {};
  for (const key of ['notes', 'dueDate', 'priority', 'projectId', 'focusDate'] as const)
    if (draft[key] !== baseline[key]) Object.assign(details, { [key]: draft[key] });
  if (JSON.stringify(draft.steps) !== JSON.stringify(baseline.steps)) details.steps = draft.steps;
  if (draft.tagsText !== baseline.tagsText) details.tags = parseTags(draft.tagsText);
  if (draft.workState !== baseline.workState) details.workState = draft.workState;
  if (draft.recurrence !== baseline.recurrence) details.recurrence = draft.recurrence;
  return {
    title: draft.title !== baseline.title ? draft.title : undefined,
    details,
    ...(draft.status !== baseline.status ? { status: draft.status } : {}),
  };
}

/** Checklist completion is deferred to the atomic save so changing one's mind is reversible. */
export function draftWithStatus(draft: TaskDraft, status: TaskStatus): TaskDraft {
  const prepared = status === 'done' ? materializeDraft(draft) : draft;
  return { ...prepared, status, ...(status !== 'done' ? { workState: status } : {}) };
}
export function validatePendingFiles(files: readonly File[], stored: { size: number }[]): void {
  if (files.some((file) => file.size > MAX_FILE_SIZE))
    throw new TaskInputError('Один файл может занимать до 10 МБ.');
  if (files.length + stored.length > MAX_ATTACHMENTS)
    throw new TaskInputError('В пространстве может быть до 100 файлов.');
  if ([...files, ...stored].reduce((sum, file) => sum + file.size, 0) > MAX_FILE_BYTES)
    throw new TaskInputError(
      'Для файлов доступно 50 МБ. Удали ненужные вложения или выбери меньше файлов.',
    );
}
