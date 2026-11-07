import { decodeTasks, MAX_PAYLOAD_LENGTH } from './taskStorage.ts';
import { TaskInputError } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import type { WorkspaceData } from '../domain/workspace.ts';

export function exportTasks(tasks: readonly Task[], projects: readonly Project[] = []): string {
  return JSON.stringify({ version: 4, tasks, projects }, null, 2);
}
export function importWorkspace(raw: string): WorkspaceData {
  if (raw.length > MAX_PAYLOAD_LENGTH)
    throw new TaskInputError('Файл слишком большой. Выберите резервную копию FOCUS.');
  const decoded = decodeTasks(raw);
  if (decoded.status !== 'saved')
    throw new TaskInputError(
      'Не удалось прочитать копию. Нужен JSON-файл, экспортированный из FOCUS.',
    );
  return { tasks: decoded.tasks, projects: decoded.projects };
}
export function importTasks(raw: string): Task[] {
  return importWorkspace(raw).tasks;
}
