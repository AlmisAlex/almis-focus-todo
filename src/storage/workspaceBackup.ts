import {
  isAttachment,
  MAX_ATTACHMENTS,
  validateAttachmentCapacity,
  copyAttachment,
} from '../domain/attachments.ts';
import type { Attachment } from '../domain/attachments.ts';
import { TaskInputError } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import { importWorkspace } from './taskTransfer.ts';

export const MAX_BACKUP_LENGTH = 75 * 1024 * 1024;
export async function exportWorkspaceBackup(
  tasks: readonly Task[],
  projects: readonly Project[],
  files: readonly Attachment[],
): Promise<string> {
  validateAttachmentCapacity(files);
  const attachments = [];
  for (const file of files) {
    if (!isAttachment(file)) throw new TaskInputError('Не удалось прочитать вложение для копии.');
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 4096)
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 4096)));
    const { blob: _blob, ...meta } = copyAttachment(file);
    attachments.push({ ...meta, data: btoa(chunks.join('')) });
  }
  return JSON.stringify({ version: 4, tasks, projects, attachments });
}
export function importWorkspaceBackup(raw: string): {
  tasks: Task[];
  projects: Project[];
  attachments: Attachment[];
} {
  if (raw.length > MAX_BACKUP_LENGTH)
    throw new TaskInputError('Копия слишком большая. Нужен файл FOCUS до 75 МБ.');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new TaskInputError('Не удалось прочитать JSON-копию FOCUS.');
  }
  if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 4)
    return { ...importWorkspace(raw), attachments: [] };
  const value = data as Record<string, unknown>;
  const workspace = importWorkspace(
    JSON.stringify({ version: 3, tasks: value.tasks, projects: value.projects }),
  );
  if (!Array.isArray(value.attachments) || value.attachments.length > MAX_ATTACHMENTS)
    throw new TaskInputError('Проверь вложения в резервной копии.');
  const attachments: Attachment[] = [];
  for (const candidate of value.attachments) {
    if (!candidate || typeof candidate !== 'object')
      throw new TaskInputError('Не удалось прочитать вложение.');
    const item = candidate as Record<string, unknown>;
    if (
      typeof item.size !== 'number' ||
      item.size < 0 ||
      item.size > 10 * 1024 * 1024 ||
      typeof item.data !== 'string' ||
      item.data.length !== 4 * Math.ceil(item.size / 3) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(item.data)
    )
      throw new TaskInputError('Размер или содержимое вложения не совпадает с копией.');
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = Uint8Array.from(atob(item.data), (char) => char.charCodeAt(0));
    } catch {
      throw new TaskInputError('Не удалось прочитать содержимое вложения.');
    }
    const attachment = {
      id: item.id,
      taskId: item.taskId,
      name: item.name,
      type: item.type,
      size: item.size,
      createdAt: item.createdAt,
      blob: new Blob([bytes], { type: typeof item.type === 'string' ? item.type : '' }),
    };
    if (!isAttachment(attachment))
      throw new TaskInputError('Некорректное вложение в резервной копии.');
    attachments.push(attachment);
  }
  if (new Set(attachments.map((file) => file.id)).size !== attachments.length)
    throw new TaskInputError('В копии повторяются идентификаторы файлов.');
  validateAttachmentCapacity(attachments);
  return { ...workspace, attachments };
}
