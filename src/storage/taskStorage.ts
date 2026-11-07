import { isTask, MAX_TASKS } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import { isProject, MAX_PROJECTS } from '../domain/projects.ts';
import type { Project } from '../domain/projects.ts';
import type { WorkspaceData } from '../domain/workspace.ts';

export const STORAGE_KEY = 'almis.focus.workspace.v4';
export const LEGACY_KEY = 'almis.focus.tasks.v1';
export const MIGRATION_KEY = 'almis.focus.tasks.before-v4';
const LEGACY_BASELINE_KEY = 'almis.focus.legacy-baseline.v4';
const BACKUP_KEY = 'almis.focus.tasks.recovery';
export const MAX_PAYLOAD_LENGTH = 12_000_000;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type PersistenceStatus = 'saved' | 'unavailable' | 'corrupt' | 'unsaved' | 'conflict';
export type LoadedTasks = WorkspaceData & { status: PersistenceStatus };
const empty = (status: PersistenceStatus): LoadedTasks => ({ tasks: [], projects: [], status });

export function decodeTasks(raw: string | null): LoadedTasks {
  if (raw === null) return empty('saved');
  if (raw.length > MAX_PAYLOAD_LENGTH) return empty('corrupt');
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty('corrupt');
    const data = parsed as Record<string, unknown>;
    if (
      ![1, 2, 3, 4].includes(data.version as number) ||
      !Array.isArray(data.tasks) ||
      data.tasks.length > MAX_TASKS
    )
      return empty('corrupt');
    const projects: Project[] = [];
    const projectIds = new Set<string>();
    if ((data.version as number) >= 3) {
      if (!Array.isArray(data.projects) || data.projects.length > MAX_PROJECTS)
        return empty('corrupt');
      for (const candidate of data.projects) {
        if (!isProject(candidate) || projectIds.has(candidate.id)) return empty('corrupt');
        projectIds.add(candidate.id);
        projects.push({ id: candidate.id, title: candidate.title, color: candidate.color });
      }
    }
    const ids = new Set<string>();
    const tasks: Task[] = [];
    for (const candidate of data.tasks) {
      if (!isTask(candidate) || ids.has(candidate.id)) return empty('corrupt');
      if (
        (data.version as number) >= 3 &&
        candidate.projectId &&
        !projectIds.has(candidate.projectId)
      )
        return empty('corrupt');
      ids.add(candidate.id);
      tasks.push({
        id: candidate.id,
        title: candidate.title,
        completed: candidate.completed,
        createdAt: candidate.createdAt,
        ...(candidate.notes !== undefined ? { notes: candidate.notes } : {}),
        ...(candidate.dueDate !== undefined ? { dueDate: candidate.dueDate } : {}),
        ...(candidate.priority !== undefined ? { priority: candidate.priority } : {}),
        ...((data.version as number) >= 3 && candidate.projectId !== undefined
          ? { projectId: candidate.projectId }
          : {}),
        ...((data.version as number) >= 3 && candidate.focusDate !== undefined
          ? { focusDate: candidate.focusDate }
          : {}),
        ...((data.version as number) >= 3 && candidate.steps !== undefined
          ? {
              steps: candidate.steps.map((step) => ({
                id: step.id,
                title: step.title,
                completed: step.completed,
              })),
            }
          : {}),
        ...(data.version === 4 && candidate.workState !== undefined
          ? { workState: candidate.workState }
          : {}),
        ...(data.version === 4 && candidate.tags !== undefined
          ? { tags: [...candidate.tags] }
          : {}),
        ...(data.version === 4 && candidate.recurrence !== undefined
          ? { recurrence: candidate.recurrence }
          : {}),
        ...(data.version === 4 && candidate.completedAt !== undefined
          ? { completedAt: candidate.completedAt }
          : {}),
        ...(data.version === 4 && candidate.nextOccurrenceId !== undefined
          ? { nextOccurrenceId: candidate.nextOccurrenceId }
          : {}),
      });
    }
    return { tasks, projects, status: 'saved' };
  } catch {
    return empty('corrupt');
  }
}
export function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
export function loadTasks(storage: StoragePort | null): LoadedTasks {
  if (!storage) return empty('unavailable');
  try {
    return decodeTasks(storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY));
  } catch {
    return empty('unavailable');
  }
}
export function saveTasks(
  storage: StoragePort | null,
  tasks: readonly Task[],
  projects: readonly Project[] = [],
): boolean {
  if (!storage) return false;
  try {
    const payload = JSON.stringify({ version: 4, tasks, projects });
    if (payload.length > MAX_PAYLOAD_LENGTH || decodeTasks(payload).status !== 'saved')
      return false;
    const old = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY);
    if (storage.getItem(STORAGE_KEY) === null)
      storage.setItem(LEGACY_BASELINE_KEY, JSON.stringify({ value: storage.getItem(LEGACY_KEY) }));
    if (
      old !== null &&
      decodeTasks(old).status === 'saved' &&
      JSON.parse(old).version < 4 &&
      storage.getItem(MIGRATION_KEY) === null
    )
      storage.setItem(MIGRATION_KEY, old);
    if (
      old !== null &&
      decodeTasks(old).status === 'saved' &&
      JSON.parse(old).version < 3 &&
      storage.getItem('almis.focus.tasks.before-v3') === null
    ) {
      storage.setItem('almis.focus.tasks.before-v3', old);
    }
    storage.setItem(STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}
export function recoverStorage(
  storage: StoragePort | null,
  tasks: readonly Task[],
  projects: readonly Project[] = [],
): boolean {
  if (!storage) return false;
  try {
    const old = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY);
    if (old !== null && decodeTasks(old).status === 'corrupt') storage.setItem(BACKUP_KEY, old);
    return saveTasks(storage, tasks, projects);
  } catch {
    return false;
  }
}

/** Old releases write only LEGACY_KEY: never let them overwrite the migrated workspace. */
export function legacyWorkspaceChanged(storage: StoragePort | null): boolean {
  try {
    if (!storage?.getItem(STORAGE_KEY)) return false;
    const baseline = storage.getItem(LEGACY_BASELINE_KEY);
    if (baseline === null) return false;
    const before = JSON.parse(baseline) as { value: unknown };
    return (
      (before.value === null || typeof before.value === 'string') &&
      storage.getItem(LEGACY_KEY) !== before.value
    );
  } catch {
    return false;
  }
}
