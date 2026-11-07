import { useEffect, useState, useSyncExternalStore } from 'react';
import { createTask, validateDetails, TaskInputError } from '../domain/tasks.ts';
import type { Task, TaskDetails, DateChange } from '../domain/tasks.ts';
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
    add: (title: string, details?: TaskDetails) =>
      repository.apply({
        type: 'add',
        task: {
          ...createTask(title, taskId(), Date.now()),
          ...(details ? validateDetails(details) : {}),
        },
      }),
    addExamples: (today: string) => {
      const now = Date.now();
      const tasks: Task[] = [
        {
          ...createTask('Выбрать одно главное дело на сегодня', taskId(), now + 2),
          priority: 'high',
          dueDate: today,
          notes: 'Нажми на карандаш, чтобы изменить текст, срок или приоритет.',
        },
        createTask('Разбить большое дело на маленькие шаги', taskId(), now + 1),
        createTask('Сделать паузу и отметить результат', taskId(), now),
      ];
      return repository.apply({ type: 'restore', tasks });
    },
    toggle: (id: string) => {
      const task = repository.getSnapshot().tasks.find((item) => item.id === id);
      return repository.apply({ type: 'set-completed', id, completed: !task?.completed });
    },
    edit: async (id: string, title: string, details: TaskDetails) => {
      await repository.apply({ type: 'edit', id, title, details });
      if (!repository.getSnapshot().tasks.some((task) => task.id === id))
        throw new TaskInputError(
          'Задача удалена в другой вкладке. Скопируйте нужный текст и закройте редактор.',
        );
    },
    changeDates: (changes: readonly DateChange[]) =>
      repository.apply({ type: 'set-dates', changes }),
    setManyCompleted: (ids: readonly string[], completed: boolean) =>
      repository.apply({ type: 'set-many-completed', ids, completed }),
    removeMany: (ids: readonly string[]) => repository.apply({ type: 'delete-many', ids }),
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
