import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, replayTaskActions } from '../src/domain/tasks.ts';
import { TaskRepository } from '../src/storage/taskRepository.ts';
import type { ExclusiveRunner } from '../src/storage/taskRepository.ts';
import { loadTasks, recoverStorage, STORAGE_KEY } from '../src/storage/taskStorage.ts';

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  let queue: Promise<void> = Promise.resolve();
  const lock: ExclusiveRunner = (work) => {
    const result = queue.then(work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return { values, storage, lock };
}
const aTask = createTask('Задача первой вкладки', 'a', 100);
const bTask = createTask('Задача второй вкладки', 'b', 200);

test('simultaneous tabs serialize writes and retain both tasks', async () => {
  const f = fixture();
  const a = new TaskRepository(() => f.storage, f.lock);
  const b = new TaskRepository(() => f.storage, f.lock);
  await Promise.all([a.apply({ type: 'add', task: aTask }), b.apply({ type: 'add', task: bTask })]);
  assert.deepEqual(
    loadTasks(f.storage).tasks.map((t) => t.id),
    ['b', 'a'],
  );
  a.syncExternal();
  assert.equal(a.getSnapshot().tasks.length, 2);
});

test('quota retry rebases pending additions onto another tab changes', async () => {
  const f = fixture();
  let denied = true;
  const sometimesFull = {
    getItem: f.storage.getItem,
    setItem: (key: string, value: string) => {
      if (denied) throw new Error('quota');
      f.storage.setItem(key, value);
    },
  };
  const a = new TaskRepository(() => sometimesFull, f.lock);
  const b = new TaskRepository(() => f.storage, f.lock);
  await a.apply({ type: 'add', task: aTask });
  assert.equal(a.getSnapshot().status, 'unsaved');
  assert.equal(a.getSnapshot().hasUnsavedChanges, true);
  await b.apply({ type: 'add', task: bTask });
  a.syncExternal();
  assert.deepEqual(a.getSnapshot().tasks, [aTask]);
  denied = false;
  assert.equal(await a.retrySave(), true);
  assert.equal(a.getSnapshot().hasUnsavedChanges, false);
  assert.deepEqual(
    loadTasks(f.storage).tasks.map((t) => t.id),
    ['b', 'a'],
  );
});

test('same-tab quick commands are serialized and errors do not poison the queue', async () => {
  const f = fixture();
  const repository = new TaskRepository(() => f.storage, f.lock);
  await Promise.all([
    repository.apply({ type: 'add', task: aTask }),
    repository.apply({ type: 'add', task: bTask }),
  ]);
  await assert.rejects(repository.apply({ type: 'add', task: aTask }));
  await repository.apply({ type: 'delete', id: 'a' });
  assert.deepEqual(loadTasks(f.storage).tasks, [bTask]);
  assert.equal(repository.getSnapshot().isWorking, false);
});

test('replayed completion is idempotent and explicit deletion does not clear another new task', () => {
  const actions = [
    { type: 'set-completed' as const, id: 'a', completed: true },
    { type: 'delete-many' as const, ids: ['b'] },
  ];
  const once = replayTaskActions([aTask, bTask], actions);
  assert.deepEqual(replayTaskActions(once, actions), once);
  assert.deepEqual(
    replayTaskActions(
      [aTask, { ...bTask, completed: true }],
      [{ type: 'delete-many', ids: ['a'] }],
    ),
    [{ ...bTask, completed: true }],
  );
});

test('full corrupt payload is backed up without truncation before replacement', () => {
  const f = fixture();
  const raw = 'x'.repeat(512_100);
  f.values.set(STORAGE_KEY, raw);
  assert.equal(recoverStorage(f.storage, [aTask]), true);
  assert.equal(f.values.get('almis.focus.tasks.recovery'), raw);
});

test('failed full backup never replaces original corrupt payload', () => {
  const f = fixture();
  const original = '{broken';
  f.values.set(STORAGE_KEY, original);
  const noBackup = {
    getItem: f.storage.getItem,
    setItem: (key: string, value: string) => {
      if (key.includes('recovery')) throw new Error('quota');
      f.storage.setItem(key, value);
    },
  };
  assert.equal(recoverStorage(noBackup, [aTask]), false);
  assert.equal(f.values.get(STORAGE_KEY), original);
});

test('missing exclusive storage support preserves accepted work without an unsafe write', async () => {
  const f = fixture();
  const noLocks: ExclusiveRunner = async () => {
    throw new Error('unsupported');
  };
  const repository = new TaskRepository(() => f.storage, noLocks);
  await repository.apply({ type: 'add', task: aTask });
  assert.equal(repository.getSnapshot().status, 'unavailable');
  assert.deepEqual(repository.getSnapshot().tasks, [aTask]);
  assert.equal(f.values.has(STORAGE_KEY), false);
});
