import { TaskInputError } from './tasks.ts';

export const MAX_FILE_SIZE = Number.MAX_SAFE_INTEGER;
export const MAX_FILE_BYTES = Number.MAX_SAFE_INTEGER;
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
  if (bytes >= 1024 ** 4) return (bytes / 1024 ** 4).toFixed(1) + ' ТБ';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' ГБ';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' МБ';
  return bytes >= 1024 ? Math.ceil(bytes / 1024) + ' КБ' : bytes + ' Б';
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
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_FILE_BYTES)
    throw new TaskInputError('Общий размер файлов не поддерживается браузером.');
}
export type PreviewKind =
  'image' | 'text' | 'pdf' | 'table' | 'audio' | 'video' | 'document' | 'download';
export function previewKind(name: string): PreviewKind {
  const ext = name.split('.').at(-1)?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['csv', 'tsv', 'tab'].includes(ext)) return 'table';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'ogv', 'mov'].includes(ext)) return 'video';
  if (['zip', 'docx', 'xlsx', 'pptx'].includes(ext)) return 'document';
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
