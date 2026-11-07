import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  updateTasks,
  replayTaskActions,
  validDate,
  MAX_NOTES_LENGTH,
} from '../src/domain/tasks.ts';
import { queryTasks, localDate } from '../src/domain/taskQueries.ts';
import { decodeTasks, loadTasks, saveTasks, STORAGE_KEY } from '../src/storage/taskStorage.ts';
import { exportTasks, importTasks } from '../src/storage/taskTransfer.ts';
import { TaskRepository } from '../src/storage/taskRepository.ts';

const first = createTask('Первое дело', 'a', 100);
const details = { notes: 'Проверить детали', dueDate: '2026-11-07', priority: 'high' as const };
function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  let queue = Promise.resolve();
  const lock = <T>(work: () => T): Promise<T> => {
    const next = queue.then(work);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
  return { data, storage, lock };
}

test('edit preserves ID, creation date and completed state; invalid drafts do not mutate tasks', () => {
  const original = [{ ...first, completed: true }];
  const edited = updateTasks(original, {
    type: 'edit',
    id: 'a',
    title: '  Обновлённое  ',
    details,
  });
  assert.deepEqual(edited, [{ ...first, completed: true, title: 'Обновлённое', ...details }]);
  assert.equal(original[0]?.title, first.title);
  assert.throws(() => updateTasks(original, { type: 'edit', id: 'a', title: ' ', details }));
  assert.throws(() =>
    updateTasks(original, {
      type: 'edit',
      id: 'a',
      title: 'Текст',
      details: { ...details, notes: 'x'.repeat(MAX_NOTES_LENGTH + 1) },
    }),
  );
  assert.throws(() => updateTasks(original, { type: 'edit', id: 'gone', title: 'Текст', details }));
});
test('calendar dates validate leap years and reject rollover dates', () => {
  for (const date of ['', '2028-02-29', '2026-11-07', '9999-12-31'])
    assert.equal(validDate(date), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-1', '0000-01-01', '<html>'])
    assert.equal(validDate(date), false);
  assert.equal(localDate(new Date(2026, 10, 7, 0, 5)), '2026-11-07');
});
test('date views exclude completed tasks; notes searchable; due/priority sorting is stable', () => {
  const tasks = [
    { ...first, ...details },
    { ...first, id: 'b', createdAt: 200, dueDate: '2026-11-06', priority: 'low' as const },
    { ...first, id: 'c', createdAt: 300, completed: true, dueDate: '2026-11-06' },
    { ...first, id: 'd', createdAt: 400 },
  ];
  const query = (
    view: Parameters<typeof queryTasks>[1],
    sort: Parameters<typeof queryTasks>[3] = 'newest',
  ) => queryTasks(tasks, view, '', sort, '2026-11-07').map((task) => task.id);
  assert.deepEqual(query('today'), ['a']);
  assert.deepEqual(query('overdue'), ['b']);
  assert.deepEqual(query('active', 'priority'), ['a', 'd', 'b']);
  assert.deepEqual(query('active', 'due'), ['b', 'a', 'd']);
  assert.deepEqual(
    queryTasks(tasks, 'all', 'ДЕТАЛИ', 'newest', '2026-11-07').map((task) => task.id),
    ['a'],
  );
  assert.deepEqual(
    tasks.map((task) => task.id),
    ['a', 'b', 'c', 'd'],
  );
});
test('batch completion is idempotent and does not change unselected tasks', () => {
  const tasks = [first, { ...first, id: 'b' }];
  const action = { type: 'set-many-completed' as const, ids: ['a', 'missing'], completed: true };
  const result = updateTasks(tasks, action);
  assert.equal(result[0]?.completed, true);
  assert.equal(result[1]?.completed, false);
  assert.deepEqual(replayTaskActions(result, [action, action]), result);
});
test('v1 migrates to v2 with exact full backup and all existing fields intact', () => {
  const f = fixture();
  const old = JSON.stringify({ version: 1, tasks: [first] });
  f.data.set(STORAGE_KEY, old);
  assert.deepEqual(loadTasks(f.storage).tasks, [first]);
  const edited = { ...first, ...details };
  assert.equal(saveTasks(f.storage, [edited]), true);
  assert.equal(f.data.get('almis.focus.tasks.before-v2'), old);
  assert.equal(JSON.parse(f.data.get(STORAGE_KEY)!).version, 2);
  assert.deepEqual(loadTasks(f.storage).tasks, [edited]);
});
test('failed migration backup never replaces original data', () => {
  const f = fixture();
  const old = JSON.stringify({ version: 1, tasks: [first] });
  f.data.set(STORAGE_KEY, old);
  const full = {
    getItem: f.storage.getItem,
    setItem: (key: string, value: string) => {
      if (key.endsWith('before-v2')) throw new Error('quota');
      f.storage.setItem(key, value);
    },
  };
  assert.equal(saveTasks(full, [{ ...first, ...details }]), false);
  assert.equal(f.data.get(STORAGE_KEY), old);
});
test('storage rejects invalid optional fields and drops unknown properties', () => {
  for (const patch of [
    { priority: 'urgent' },
    { notes: 33 },
    { dueDate: '2026-02-30' },
    { notes: 'x'.repeat(MAX_NOTES_LENGTH + 1) },
  ])
    assert.equal(
      decodeTasks(JSON.stringify({ version: 2, tasks: [{ ...first, ...patch }] })).status,
      'corrupt',
    );
  assert.deepEqual(
    decodeTasks(JSON.stringify({ version: 2, tasks: [{ ...first, ...details, extra: 'ignored' }] }))
      .tasks,
    [{ ...first, ...details }],
  );
});
test('export/import round trip includes notes, deadlines and Unicode; invalid files rejected', () => {
  const tasks = [
    { ...first, ...details, title: 'План 🎯 <текст>', notes: 'Строка\nДругая строка' },
  ];
  assert.deepEqual(importTasks(exportTasks(tasks)), tasks);
  for (const invalid of [
    'null',
    '{}',
    '{broken',
    '{"version":3,"tasks":[]}',
    '{"version":2,"tasks":[null]}',
  ])
    assert.throws(() => importTasks(invalid));
  const existing = [{ ...tasks[0]!, title: 'Новее в текущем списке' }];
  assert.deepEqual(updateTasks(existing, { type: 'restore', tasks }), existing);
});
test('external deletion during edit never resurrects the task or poisons later additions', async () => {
  const f = fixture();
  saveTasks(f.storage, [first]);
  const a = new TaskRepository(() => f.storage, f.lock);
  const b = new TaskRepository(() => f.storage, f.lock);
  await b.apply({ type: 'delete', id: 'a' });
  await a.apply({ type: 'edit', id: 'a', title: 'Старый черновик', details });
  assert.deepEqual(loadTasks(f.storage).tasks, []);
  await a.apply({ type: 'add', task: { ...first, id: 'new' } });
  assert.equal(a.getSnapshot().hasUnsavedChanges, false);
  assert.equal(loadTasks(f.storage).tasks[0]?.id, 'new');
});
test('quota retry merges edit with another tab addition and keeps all new fields', async () => {
  const f = fixture();
  saveTasks(f.storage, [first]);
  let full = true;
  const quota = {
    getItem: f.storage.getItem,
    setItem: (key: string, value: string) => {
      if (full) throw new Error('quota');
      f.storage.setItem(key, value);
    },
  };
  const a = new TaskRepository(() => quota, f.lock);
  const b = new TaskRepository(() => f.storage, f.lock);
  await a.apply({ type: 'edit', id: 'a', title: 'Правка', details });
  await b.apply({ type: 'add', task: { ...first, id: 'b', createdAt: 200 } });
  full = false;
  assert.equal(await a.retrySave(), true);
  assert.equal(loadTasks(f.storage).tasks.length, 2);
  assert.deepEqual(
    loadTasks(f.storage).tasks.find((task) => task.id === 'a'),
    { ...first, title: 'Правка', ...details },
  );
});
