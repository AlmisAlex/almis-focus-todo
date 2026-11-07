import { decodeTasks, MAX_PAYLOAD_LENGTH } from './taskStorage.ts';
import { TaskInputError } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';

export function exportTasks(tasks: readonly Task[]): string {
  return JSON.stringify({ version: 2, tasks }, null, 2);
}

export function importTasks(raw: string): Task[] {
  if (raw.length > MAX_PAYLOAD_LENGTH)
    throw new TaskInputError('Файл слишком большой. Выберите резервную копию FOCUS.');
  const decoded = decodeTasks(raw);
  if (decoded.status !== 'saved')
    throw new TaskInputError(
      'Не удалось прочитать копию. Нужен JSON-файл, экспортированный из FOCUS.',
    );
  return decoded.tasks;
}
