import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js/index-native.js';
import { exportWorkspaceArchive, importWorkspaceArchive } from '../src/storage/workspaceArchive.ts';
import { BoundedArchiveReader } from '../src/storage/archiveReader.ts';
import { createTask } from '../src/domain/tasks.ts';
import { defaultPlanner } from '../src/domain/planner.ts';
import { emptyJournal, applyJournal } from '../src/domain/journal.ts';
const task = createTask('Проверить копию', 'task', 100);
const file = {
  id: 'file',
  taskId: 'deleted-task',
  name: 'данные.bin',
  type: 'application/octet-stream',
  size: 5,
  createdAt: 100,
  blob: new Blob([new Uint8Array([0, 1, 128, 254, 255])]),
};
test('ZIP7 roundtrip preserves bytes, orphan metadata, journal and paused timer', async () => {
  const planner = defaultPlanner();
  planner.timer = {
    id: 'timer',
    taskId: 'task',
    title: 'Проверить копию',
    kind: 'focus',
    duration: 420000,
    elapsed: 37000,
    startedAt: null,
  };
  const journal = applyJournal(emptyJournal(), {
    type: 'append',
    entries: [
      {
        id: 'note',
        taskId: 'deleted-task',
        stepId: '',
        at: 100,
        text: 'Таблица\n| Этап | Статус |',
        fileId: 'file',
        taskTitle: 'Удалённая задача',
      },
    ],
  });
  const archive = await exportWorkspaceArchive([task], [], [file], planner, journal);
  const restored = await importWorkspaceArchive(archive);
  assert.deepEqual(restored.tasks, [task]);
  assert.deepEqual(restored.journal, journal);
  assert.deepEqual(restored.planner?.timer, planner.timer);
  assert.deepEqual(
    [...new Uint8Array(await restored.attachments[0]!.blob.arrayBuffer())],
    [0, 1, 128, 254, 255],
  );
  assert.equal(restored.attachments[0]?.taskId, 'deleted-task');
});
test('ZIP import rejects ordinary invalid input and noncanonical manifest paths', async () => {
  await assert.rejects(importWorkspaceArchive(new Blob(['not an archive'])));
  const writer = new ZipWriter(new BlobWriter(), { level: 0, useWebWorkers: false });
  await writer.add(
    'focus.json',
    new BlobReader(
      new Blob([
        JSON.stringify({
          version: 7,
          backup: { version: 6, tasks: [], projects: [], attachments: [] },
          files: [{ path: 'files/01', meta: {} }],
        }),
      ]),
    ),
  );
  await writer.add('files/01', new BlobReader(new Blob(['a'])));
  await assert.rejects(importWorkspaceArchive(await writer.close()), /ZIP-копию/);
});
test('metadata reader bounds a declared read before allocation', async () => {
  const reader = new BoundedArchiveReader(new Blob(['a']));
  await assert.rejects(reader.readUint8Array(0, 17 * 1024 * 1024), /каталог/);
});
test('already cancelled archive transfer does not start reading or writing', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    exportWorkspaceArchive([], [], [], undefined, undefined, controller.signal),
    { name: 'AbortError' },
  );
  await assert.rejects(importWorkspaceArchive(new Blob([]), controller.signal), {
    name: 'AbortError',
  });
});
