import { useEffect, useState, useSyncExternalStore } from 'react';
import { createTask } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import { browserStorage, STORAGE_KEY } from '../storage/taskStorage.ts';
import { TaskRepository } from '../storage/taskRepository.ts';
import type { ExclusiveRunner } from '../storage/taskRepository.ts';

const exclusively: ExclusiveRunner = async (work) => {
  if (!navigator.locks) throw new Error('Safe storage transactions are unavailable.');
  return navigator.locks.request(`${STORAGE_KEY}.write`, () => work());
};

function taskId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function useTasks() {
  const [repository] = useState(() => new TaskRepository(browserStorage, exclusively));
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) repository.syncExternal();
    };
    const protectUnsaved = (event: BeforeUnloadEvent) => {
      if (!repository.getSnapshot().hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('storage', sync);
    window.addEventListener('beforeunload', protectUnsaved);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('beforeunload', protectUnsaved);
    };
  }, [repository]);

  return {
    ...state,
    add: (title: string) =>
      repository.apply({ type: 'add', task: createTask(title, taskId(), Date.now()) }),
    toggle: (id: string) => {
      const task = repository.getSnapshot().tasks.find((item) => item.id === id);
      return repository.apply({ type: 'set-completed', id, completed: !task?.completed });
    },
    remove: (id: string) => repository.apply({ type: 'delete', id }),
    clearCompleted: () =>
      repository.apply({
        type: 'delete-many',
        ids: repository
          .getSnapshot()
          .tasks.filter((task) => task.completed)
          .map((task) => task.id),
      }),
    restore: (tasks: readonly Task[]) => repository.apply({ type: 'restore', tasks }),
    retrySave: () => repository.retrySave(),
  };
}
