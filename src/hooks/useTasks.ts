import { addDays } from '../domain/calendar.ts';
import { newId } from '../domain/ids.ts';
import type { Project } from '../domain/projects.ts';
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
          ...createTask(title, newId(), Date.now()),
          ...(details ? validateDetails(details) : {}),
        },
      }),
    addExamples: (today: string) => {
      const work = { id: newId(), title: 'Работа', color: 'violet' as const };
      const personal = { id: newId(), title: 'Личное', color: 'green' as const };
      const ideas = { id: newId(), title: 'Идеи и планы', color: 'amber' as const };
      const now = Date.now();
      const tasks: Task[] = [
        {
          ...createTask('Подготовить план проекта', newId(), now + 6),
          projectId: work.id,
          priority: 'high',
          dueDate: today,
          focusDate: today,
          notes: 'Начать с понятного результата, затем разложить работу на шаги.',
          steps: [
            { id: newId(), title: 'Сформулировать результат', completed: true },
            { id: newId(), title: 'Выделить три главных этапа', completed: false },
            { id: newId(), title: 'Запланировать первый шаг', completed: false },
          ],
        },
        {
          ...createTask('Согласовать следующий этап', newId(), now + 5),
          projectId: work.id,
          priority: 'normal',
          dueDate: addDays(today, 1),
          steps: [
            { id: newId(), title: 'Подготовить вопросы', completed: false },
            { id: newId(), title: 'Собрать обратную связь', completed: false },
          ],
        },
        {
          ...createTask('Найти время для себя', newId(), now + 4),
          projectId: personal.id,
          priority: 'normal',
          dueDate: today,
          focusDate: today,
          steps: [
            { id: newId(), title: 'Прогулка без спешки', completed: false },
            { id: newId(), title: 'Отложить телефон на полчаса', completed: false },
          ],
        },
        {
          ...createTask('Записать новую идею', newId(), now + 3),
          projectId: ideas.id,
          priority: 'low',
          notes: 'Хорошие идеи заслуживают отдельного места.',
        },
        {
          ...createTask('Разобрать входящие', newId(), now + 2),
          focusDate: today,
          notes: 'Выбрать проект или оставить дело во входящих.',
        },
        {
          ...createTask('Определить цель недели', newId(), now + 1),
          projectId: work.id,
          completed: true,
          dueDate: today,
          focusDate: today,
        },
      ];
      return repository.apply({
        type: 'import-workspace',
        tasks,
        projects: [work, personal, ideas],
      });
    },
    addProject: (project: Project) => repository.apply({ type: 'add-project', project }),
    renameProject: (project: Project) => repository.apply({ type: 'rename-project', project }),
    removeProject: (id: string) => repository.apply({ type: 'remove-project', id }),
    moveProject: (ids: readonly string[], projectId: string) =>
      repository.apply({ type: 'move-project', ids, projectId }),
    importWorkspace: (tasks: readonly Task[], projects: readonly Project[]) =>
      repository.apply({ type: 'import-workspace', tasks, projects }),
    setFocus: (id: string, date: string) => repository.apply({ type: 'set-focus', id, date }),
    setStep: (id: string, stepId: string, completed: boolean) =>
      repository.apply({ type: 'set-step', id, stepId, completed }),
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
