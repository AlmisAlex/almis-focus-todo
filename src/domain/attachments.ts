import { TaskInputError } from './tasks.ts';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_ATTACHMENTS = 100;
export type Attachment = Readonly<{
  id: string;
  taskId: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  blob: Blob;
}>;
export function safeFileName(name: string): string {
  let value = name.replace(/[\u0000-\u001f\u007f/\\:]/g, '_').trim();
  if (value.length > 180) {
    const dot = value.lastIndexOf('.');
    const extension = dot > 0 && value.length - dot <= 17 ? value.slice(dot) : '';
    value = value.slice(0, 180 - extension.length) + extension;
  }
  return !value || value === '.' || value === '..' ? 'файл' : value;
}
export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
    : bytes >= 1024
      ? `${Math.ceil(bytes / 1024)} КБ`
      : `${bytes} Б`;
}
export function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 100 &&
    typeof item.taskId === 'string' &&
    item.taskId.length > 0 &&
    item.taskId.length <= 100 &&
    typeof item.name === 'string' &&
    item.name === safeFileName(item.name) &&
    typeof item.type === 'string' &&
    item.type.length <= 120 &&
    typeof item.size === 'number' &&
    Number.isSafeInteger(item.size) &&
    item.size >= 0 &&
    item.size <= MAX_FILE_SIZE &&
    typeof item.createdAt === 'number' &&
    Number.isSafeInteger(item.createdAt) &&
    item.createdAt > 0 &&
    item.createdAt <= 8_640_000_000_000_000 &&
    item.blob instanceof Blob &&
    item.blob.size === item.size
  );
}
export function copyAttachment(file: Attachment): Attachment {
  return {
    id: file.id,
    taskId: file.taskId,
    name: file.name,
    type: file.type,
    size: file.size,
    createdAt: file.createdAt,
    blob: file.blob,
  };
}
export function validateAttachmentCapacity(files: readonly Attachment[]): void {
  if (files.length > MAX_ATTACHMENTS)
    throw new TaskInputError(`Можно хранить до ${MAX_ATTACHMENTS} файлов.`);
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_FILE_BYTES)
    throw new TaskInputError('Для файлов доступно 50 МБ. Сохрани копию и удали ненужные вложения.');
}
export type PreviewKind = 'image' | 'text' | 'pdf' | 'download';
export function previewKind(name: string): PreviewKind {
  const ext = name.split('.').at(-1)?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (
    [
      'txt',
      'md',
      'csv',
      'json',
      'log',
      'yaml',
      'yml',
      'xml',
      'html',
      'htm',
      'svg',
      'js',
      'ts',
      'css',
      'py',
    ].includes(ext)
  )
    return 'text';
  return 'download';
}
