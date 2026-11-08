import { newId } from '../domain/ids.ts';
import {
  MAX_FILE_SIZE,
  isAttachment,
  safeFileName,
  validateAttachmentCapacity,
  copyAttachment,
} from '../domain/attachments.ts';
import type { Attachment } from '../domain/attachments.ts';
import { TaskInputError } from '../domain/tasks.ts';

const DB = 'almis.focus.files';
const STORE = 'attachments';
let connection: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      blocked = true;
      connection = undefined;
      reject(new Error('Database upgrade blocked'));
    };
  });
  return connection;
}
function checked(records: unknown[]): Attachment[] {
  if (
    !records.every(isAttachment) ||
    new Set(records.map((record) => record.id)).size !== records.length
  )
    throw new TaskInputError('Хранилище файлов не удалось прочитать. Данные не изменены.');
  validateAttachmentCapacity(records);
  return records.map(copyAttachment);
}
export async function listAttachments(): Promise<Attachment[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => {
      try {
        resolve(checked(request.result));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
async function mutate(
  change: (records: Attachment[], store: IDBObjectStore) => void,
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let failure: unknown;
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        change(checked(request.result), store);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(failure ?? tx.error ?? new Error('File storage write failed'));
  });
}
export async function addAttachments(taskId: string, files: readonly File[]): Promise<void> {
  if (!taskId || taskId.length > 100) throw new TaskInputError('Не удалось определить задачу.');
  if (files.some((file) => file.size > MAX_FILE_SIZE))
    throw new TaskInputError('Размер файла не поддерживается браузером.');
  const additions: Attachment[] = files.map((file) => ({
    id: newId(),
    taskId,
    name: safeFileName(file.name),
    type: file.type.slice(0, 120),
    size: file.size,
    createdAt: Date.now(),
    blob: file,
  }));
  await importAttachments(additions);
}
export async function importAttachments(additions: readonly Attachment[]): Promise<void> {
  checked([...additions]);
  const stored = await listAttachments();
  const existing = new Set(stored.map((file) => file.id));
  const incomingBytes = additions
    .filter((file) => !existing.has(file.id))
    .reduce((sum, file) => sum + file.size, 0);
  if (incomingBytes && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    let available: number | undefined;
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage !== undefined)
        available = Math.max(0, estimate.quota - estimate.usage);
    } catch {
      /* The real transaction remains authoritative. */
    }
    if (available !== undefined && incomingBytes > available)
      throw new TaskInputError(
        'В браузере не хватает места для этих файлов. Сохрани копию и освободи место.',
      );
  }
  await mutate((records, store) => {
    const ids = new Set(records.map((record) => record.id));
    const incoming = additions.filter((record) => !ids.has(record.id));
    validateAttachmentCapacity([...records, ...incoming]);
    for (const record of incoming) store.add(record);
  });
}
export async function removeAttachment(id: string): Promise<void> {
  await mutate((_records, store) => store.delete(id));
}
export function fileStorageMessage(error: unknown): string {
  if (error instanceof TaskInputError) return error.message;
  if (error instanceof DOMException && error.name === 'QuotaExceededError')
    return 'Браузеру не хватает места для файла. Исходные вложения сохранены. Скачай копию и освободи место.';
  return 'Файлы сейчас недоступны. Проверь разрешения и свободное место браузера, затем повтори. Данные не отправлялись на сервер.';
}
