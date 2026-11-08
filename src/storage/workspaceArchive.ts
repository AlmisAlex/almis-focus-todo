import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js/index-native.js';
import type { Entry, FileEntry } from '@zip.js/zip.js/index-native.js';
import type { Attachment } from '../domain/attachments.ts';
import { copyAttachment, isAttachment, validateAttachmentCapacity } from '../domain/attachments.ts';
import type { Task } from '../domain/tasks.ts';
import { TaskInputError } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import type { Planner } from '../domain/planner.ts';
import type { Journal } from '../domain/journal.ts';
import { BoundedArchiveReader } from './archiveReader.ts';
import { exportWorkspaceBackup, importWorkspaceBackup } from './workspaceBackup.ts';

const MAX_MANIFEST = 8 * 1024 * 1024;
function fail(): never {
  throw new TaskInputError('Не удалось прочитать ZIP-копию FOCUS. Проверь файл.');
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const checkAbort = (signal?: AbortSignal) => signal?.throwIfAborted();
const signalOptions = (signal?: AbortSignal) => (signal ? { signal } : {});
const readOptions = (signal?: AbortSignal) => ({
  useWebWorkers: false,
  strictness: 'strict' as const,
  checkSignature: true,
  checkCrc32: true,
  checkOverlappingEntry: true,
  ...signalOptions(signal),
});
function storedEntry(entry: Entry, archiveSize: number): FileEntry {
  if (
    entry.directory ||
    entry.symlink ||
    entry.encrypted ||
    entry.compressionMethod !== 0 ||
    !Number.isSafeInteger(entry.uncompressedSize) ||
    entry.uncompressedSize < 0 ||
    entry.uncompressedSize > archiveSize ||
    entry.compressedSize !== entry.uncompressedSize
  )
    fail();
  return entry;
}

/** Version 7 keeps file bytes as streamed ZIP entries; no base64 or whole-file
 * ArrayBuffer. Stored entries also make import work without decompression. */
export async function exportWorkspaceArchive(
  tasks: readonly Task[],
  projects: readonly Project[],
  files: readonly Attachment[],
  planner?: Planner,
  journal?: Journal,
  signal?: AbortSignal,
): Promise<Blob> {
  checkAbort(signal);
  validateAttachmentCapacity(files);
  if (
    files.some((file) => !isAttachment(file)) ||
    new Set(files.map((file) => file.id)).size !== files.length
  )
    fail();
  const backup = JSON.parse(
    await exportWorkspaceBackup(tasks, projects, [], planner, journal),
  ) as Record<string, unknown>;
  backup.version = 6;
  const descriptors = files.map((file, index) => {
    const { blob: _blob, ...meta } = copyAttachment(file);
    return { path: `files/${index}`, meta };
  });
  const manifest = new Blob([JSON.stringify({ version: 7, backup, files: descriptors })], {
    type: 'application/json',
  });
  if (manifest.size > MAX_MANIFEST) throw new TaskInputError('Описание копии слишком большое.');
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    useWebWorkers: false,
    level: 0,
    bufferedWrite: false,
    ...signalOptions(signal),
  });
  let closed = false;
  try {
    await writer.add('focus.json', new BlobReader(manifest), { ...signalOptions(signal) });
    for (const [index, file] of files.entries()) {
      checkAbort(signal);
      await writer.add(`files/${index}`, new BlobReader(file.blob), { ...signalOptions(signal) });
    }
    checkAbort(signal);
    const blob = await writer.close();
    closed = true;
    return blob;
  } finally {
    if (!closed) await writer.close().catch(() => undefined);
  }
}

export async function importWorkspaceArchive(
  blob: Blob,
  signal?: AbortSignal,
): Promise<ReturnType<typeof importWorkspaceBackup>> {
  checkAbort(signal);
  const reader = new ZipReader(new BoundedArchiveReader(blob), readOptions(signal));
  try {
    const entries = new Map<string, FileEntry>();
    for await (const entry of reader.getEntriesGenerator()) {
      checkAbort(signal);
      if (entries.size >= 101 || entries.has(entry.filename)) fail();
      entries.set(entry.filename, storedEntry(entry, blob.size));
    }
    const manifestEntry = entries.get('focus.json');
    if (!manifestEntry || manifestEntry.uncompressedSize > MAX_MANIFEST) fail();
    const manifestBlob = await manifestEntry.getData(
      new BlobWriter('application/json'),
      readOptions(signal),
    );
    if (manifestBlob.size > MAX_MANIFEST) fail();
    let manifest: unknown;
    try {
      manifest = JSON.parse(await manifestBlob.text());
    } catch {
      fail();
    }
    if (
      !record(manifest) ||
      !keys(manifest, ['version', 'backup', 'files']) ||
      manifest.version !== 7 ||
      !record(manifest.backup) ||
      !keys(manifest.backup, [
        'version',
        'tasks',
        'projects',
        'attachments',
        'planner',
        'journal',
      ]) ||
      manifest.backup.version !== 6 ||
      !Array.isArray(manifest.backup.attachments) ||
      manifest.backup.attachments.length ||
      !Array.isArray(manifest.files) ||
      manifest.files.length > 100 ||
      entries.size !== manifest.files.length + 1
    )
      fail();
    const workspace = importWorkspaceBackup(JSON.stringify(manifest.backup));
    const attachments: Attachment[] = [];
    for (const [index, descriptor] of manifest.files.entries()) {
      checkAbort(signal);
      if (
        !record(descriptor) ||
        !keys(descriptor, ['path', 'meta']) ||
        descriptor.path !== `files/${index}` ||
        !record(descriptor.meta) ||
        !keys(descriptor.meta, ['id', 'taskId', 'name', 'type', 'size', 'createdAt'])
      )
        fail();
      const meta = descriptor.meta;
      const entry = entries.get(descriptor.path);
      if (!entry || entry.uncompressedSize !== meta.size) fail();
      const content = await entry.getData(
        new BlobWriter(typeof meta.type === 'string' ? meta.type : ''),
        readOptions(signal),
      );
      const candidate = { ...meta, blob: content };
      if (!isAttachment(candidate)) fail();
      attachments.push(copyAttachment(candidate));
    }
    if (new Set(attachments.map((file) => file.id)).size !== attachments.length) fail();
    validateAttachmentCapacity(attachments);
    return { ...workspace, attachments };
  } finally {
    await reader.close().catch(() => undefined);
  }
}
