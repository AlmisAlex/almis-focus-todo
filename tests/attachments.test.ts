import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAttachment,
  safeFileName,
  previewKind,
  validateAttachmentCapacity,
  MAX_FILE_SIZE,
} from '../src/domain/attachments.ts';
import type { Attachment } from '../src/domain/attachments.ts';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../src/storage/workspaceBackup.ts';
import { createTask } from '../src/domain/tasks.ts';

const file: Attachment = {
  id: 'file1',
  taskId: 'task1',
  name: 'заметка.txt',
  type: 'text/plain',
  size: 5,
  createdAt: 100,
  blob: new Blob(['hello']),
};
const task = createTask('Моя задача', 'task1', 100);

test('file names are safe for download and preserve extension when shortened', () => {
  assert.equal(safeFileName('../путь\\файл:1.txt'), '.._путь_файл_1.txt');
  assert.equal(safeFileName('..'), 'файл');
  const long = safeFileName('а'.repeat(240) + '.docx');
  assert.equal(long.length, 180);
  assert.ok(long.endsWith('.docx'));
});
test('any format is stored, only supported inert formats get in-app preview', () => {
  assert.equal(previewKind('photo.PNG'), 'image');
  assert.equal(previewKind('report.pdf'), 'pdf');
  assert.equal(previewKind('page.html'), 'text');
  assert.equal(previewKind('drawing.svg'), 'text');
  assert.equal(previewKind('sheet.xlsx'), 'download');
  assert.equal(previewKind('archive.zip'), 'download');
});
test('attachment validation rejects inconsistent bytes, unsafe metadata and oversize declarations', () => {
  assert.ok(isAttachment(file));
  assert.ok(!isAttachment({ ...file, size: 4 }));
  assert.ok(!isAttachment({ ...file, name: '../document.txt' }));
  assert.ok(!isAttachment({ ...file, size: MAX_FILE_SIZE + 1 }));
  assert.ok(!isAttachment({ ...file, blob: {} }));
});
test('total file and count limits are checked without allocating large files', () => {
  assert.throws(
    () => validateAttachmentCapacity(Array.from({ length: 101 }, () => file)),
    /100 файлов/,
  );
  assert.throws(
    () =>
      validateAttachmentCapacity(
        Array.from({ length: 6 }, () => ({ ...file, size: MAX_FILE_SIZE })),
      ),
    /50 МБ/,
  );
});
test('full backup round trip preserves binary bytes, projects, steps and orphan attachments', async () => {
  const binary = {
    ...file,
    id: 'orphan',
    taskId: 'removed-task',
    name: 'данные.bin',
    type: 'application/octet-stream',
    size: 4,
    blob: new Blob([new Uint8Array([0, 128, 254, 255])]),
  };
  const projects = [{ id: 'project', title: 'Работа', color: 'violet' as const }];
  const tasks = [
    { ...task, projectId: 'project', steps: [{ id: 's1', title: 'Проверить', completed: false }] },
  ];
  const raw = await exportWorkspaceBackup(tasks, projects, [file, binary]);
  const restored = importWorkspaceBackup(raw);
  assert.equal(JSON.parse(raw).version, 5);
  assert.deepEqual(restored.tasks, tasks);
  assert.deepEqual(restored.projects, projects);
  assert.equal(await restored.attachments[0]?.blob.text(), 'hello');
  assert.deepEqual(
    new Uint8Array(await restored.attachments[1]!.blob.arrayBuffer()),
    new Uint8Array([0, 128, 254, 255]),
  );
  assert.equal(restored.attachments[1]?.taskId, 'removed-task');
});
test('empty project-only and legacy backup import remain supported', async () => {
  const projects = [{ id: 'project', title: 'Работа', color: 'violet' as const }];
  assert.deepEqual(importWorkspaceBackup(await exportWorkspaceBackup([], projects, [])), {
    tasks: [],
    projects,
    attachments: [],
  });
  assert.deepEqual(importWorkspaceBackup(JSON.stringify({ version: 1, tasks: [task] })), {
    tasks: [task],
    projects: [],
    attachments: [],
  });
});
test('full backup rejects altered file length, invalid base64 and duplicate file IDs', async () => {
  const data = JSON.parse(await exportWorkspaceBackup([task], [], [file]));
  const altered = structuredClone(data);
  altered.attachments[0].size = 2;
  assert.throws(() => importWorkspaceBackup(JSON.stringify(altered)), /Размер|Некорректное/);
  const invalid = structuredClone(data);
  invalid.attachments[0].data = '!!!!!!!!';
  assert.throws(() => importWorkspaceBackup(JSON.stringify(invalid)), /Размер/);
  const duplicate = structuredClone(data);
  duplicate.attachments.push(duplicate.attachments[0]);
  assert.throws(() => importWorkspaceBackup(JSON.stringify(duplicate)), /повторяются/);
});
test('backup never copies unknown storage record fields', async () => {
  const raw = await exportWorkspaceBackup(
    [task],
    [],
    [{ ...file, localOnlyNote: 'do-not-export' } as Attachment],
  );
  assert.ok(!raw.includes('localOnlyNote'));
  assert.ok(!raw.includes('do-not-export'));
});
