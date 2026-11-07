import { useCallback, useEffect, useRef, useState } from 'react';
import { createTask, updateTasks } from '../domain/tasks.ts';
import type { Task, TaskAction } from '../domain/tasks.ts';
import {
  browserStorage,
  loadTasks,
  recoverStorage,
  saveTasks,
  STORAGE_KEY,
} from '../storage/taskStorage.ts';
import type { LoadedTasks } from '../storage/taskStorage.ts';

function taskId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function useTasks() {
  const [state, setState] = useState<LoadedTasks>(() => loadTasks(browserStorage()));
  const current = useRef(state);

  const publish = useCallback((next: LoadedTasks) => {
    current.current = next;
    setState(next);
  }, []);

  const commit = useCallback(
    (action: TaskAction) => {
      const previous = current.current;
      const tasks = updateTasks(previous.tasks, action);
      // Avoid React updater side effects: each UI command performs one storage write.
      if (previous.status === 'corrupt' || previous.status === 'unavailable') {
        publish({ tasks, status: previous.status });
      } else {
        publish({ tasks, status: saveTasks(browserStorage(), tasks) ? 'saved' : 'unsaved' });
      }
    },
    [publish],
  );

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      // Never silently replace unsaved in-memory work with another tab's state.
      if (current.current.status !== 'saved') return;
      const loaded = loadTasks(browserStorage());
      if (loaded.status === 'saved') publish(loaded);
      else publish({ tasks: current.current.tasks, status: loaded.status });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [publish]);

  const add = useCallback(
    (title: string) => {
      commit({ type: 'add', task: createTask(title, taskId(), Date.now()) });
    },
    [commit],
  );

  const retrySave = useCallback(() => {
    const previous = current.current;
    const ok =
      previous.status === 'corrupt' || previous.status === 'unavailable'
        ? recoverStorage(browserStorage(), previous.tasks)
        : saveTasks(browserStorage(), previous.tasks);
    publish({ tasks: previous.tasks, status: ok ? 'saved' : previous.status });
    return ok;
  }, [publish]);

  return {
    tasks: state.tasks,
    status: state.status,
    add,
    toggle: (id: string) => commit({ type: 'toggle', id }),
    remove: (id: string) => commit({ type: 'delete', id }),
    clearCompleted: () => commit({ type: 'clear-completed' }),
    restore: (tasks: readonly Task[]) => commit({ type: 'restore', tasks }),
    retrySave,
  };
}
