import { isTask, MAX_TASKS } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';

export const STORAGE_KEY = 'almis.focus.tasks.v1';
const BACKUP_KEY = 'almis.focus.tasks.recovery';
export const MAX_PAYLOAD_LENGTH = 4_000_000;

export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type PersistenceStatus = 'saved' | 'unavailable' | 'corrupt' | 'unsaved' | 'conflict';
export type LoadedTasks = { tasks: Task[]; status: PersistenceStatus };

export function decodeTasks(raw: string | null): LoadedTasks {
  if (raw === null) return { tasks: [], status: 'saved' };
  if (raw.length > MAX_PAYLOAD_LENGTH) return { tasks: [], status: 'corrupt' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { tasks: [], status: 'corrupt' };
    const data = parsed as Record<string, unknown>;
    if (
      (data.version !== 1 && data.version !== 2) ||
      !Array.isArray(data.tasks) ||
      data.tasks.length > MAX_TASKS
    ) {
      return { tasks: [], status: 'corrupt' };
    }
    const ids = new Set<string>();
    const tasks: Task[] = [];
    for (const candidate of data.tasks) {
      if (!isTask(candidate) || ids.has(candidate.id)) return { tasks: [], status: 'corrupt' };
      ids.add(candidate.id);
      // Pick known fields; never pass unknown stored properties into the UI.
      tasks.push({
        id: candidate.id,
        title: candidate.title,
        completed: candidate.completed,
        createdAt: candidate.createdAt,
        ...(candidate.notes !== undefined ? { notes: candidate.notes } : {}),
        ...(candidate.dueDate !== undefined ? { dueDate: candidate.dueDate } : {}),
        ...(candidate.priority !== undefined ? { priority: candidate.priority } : {}),
      });
    }
    return { tasks, status: 'saved' };
  } catch {
    return { tasks: [], status: 'corrupt' };
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
  if (!storage) return { tasks: [], status: 'unavailable' };
  try {
    return decodeTasks(storage.getItem(STORAGE_KEY));
  } catch {
    return { tasks: [], status: 'unavailable' };
  }
}

export function saveTasks(storage: StoragePort | null, tasks: readonly Task[]): boolean {
  if (!storage) return false;
  try {
    const payload = JSON.stringify({ version: 2, tasks });
    if (payload.length > MAX_PAYLOAD_LENGTH) return false;
    const old = storage.getItem(STORAGE_KEY);
    if (
      old !== null &&
      decodeTasks(old).status === 'saved' &&
      JSON.parse(old).version === 1 &&
      storage.getItem('almis.focus.tasks.before-v2') === null
    ) {
      // A failed migration backup must never replace the original v1 data.
      storage.setItem('almis.focus.tasks.before-v2', old);
    }
    storage.setItem(STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

/** Explicit recovery only: preserve the entire original or do not replace it. */
export function recoverStorage(storage: StoragePort | null, tasks: readonly Task[]): boolean {
  if (!storage) return false;
  try {
    const old = storage.getItem(STORAGE_KEY);
    if (old !== null && decodeTasks(old).status === 'corrupt') {
      storage.setItem(BACKUP_KEY, old);
    }
    return saveTasks(storage, tasks);
  } catch {
    return false;
  }
}
