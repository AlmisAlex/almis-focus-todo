import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  MAX_TASKS,
  MAX_TITLE_LENGTH,
  selectTasks,
  taskWord,
  updateTasks,
} from '../src/domain/tasks.ts';
import {
  decodeTasks,
  loadTasks,
  recoverStorage,
  saveTasks,
  STORAGE_KEY,
} from '../src/storage/taskStorage.ts';

const first = createTask('  Сделать важное  ', 'one', 1_700_000_000_000);
const second = createTask('Позвонить 🎯', 'two', 1_700_000_001_000);

test('creation trims boundaries and preserves Unicode', () => {
  assert.equal(first.title, 'Сделать важное');
  assert.equal(second.title, 'Позвонить 🎯');
  assert.equal(first.completed, false);
});
test('blank/oversized tasks are rejected', () => {
  for (const title of ['', ' \t ', 'x'.repeat(MAX_TITLE_LENGTH + 1)]) {
    assert.throws(() => createTask(title, 'id', 42));
  }
  assert.equal(createTask('x'.repeat(MAX_TITLE_LENGTH), 'id', 42).title.length, MAX_TITLE_LENGTH);
});
test('addition does not mutate input or accept duplicate IDs', () => {
  const original = [first];
  const added = updateTasks(original, { type: 'add', task: second });
  assert.deepEqual(original, [first]);
  assert.deepEqual(added, [second, first]);
  assert.throws(() => updateTasks(original, { type: 'add', task: first }));
});
test('task capacity is bounded', () => {
  const full = Array.from({ length: MAX_TASKS }, (_, i) => ({ ...first, id: String(i) }));
  assert.throws(() => updateTasks(full, { type: 'add', task: second }));
});
test('toggle can complete and reopen the selected task', () => {
  const completed = updateTasks([first, second], { type: 'toggle', id: first.id });
  assert.equal(completed[0]?.completed, true);
  assert.equal(completed[1], second);
  assert.equal(first.completed, false);
  assert.equal(updateTasks(completed, { type: 'toggle', id: first.id })[0]?.completed, false);
});
test('delete only affects the requested task', () => {
  assert.deepEqual(updateTasks([first, second], { type: 'delete', id: first.id }), [second]);
  assert.deepEqual(updateTasks([first], { type: 'delete', id: 'missing' }), [first]);
});
test('clear completed retains active work', () => {
  const tasks = [{ ...first, completed: true }, second];
  assert.deepEqual(updateTasks(tasks, { type: 'clear-completed' }), [second]);
});
test('undo preserves IDs and does not duplicate an existing task', () => {
  assert.deepEqual(updateTasks([second], { type: 'restore', tasks: [first, second] }), [
    second,
    first,
  ]);
  assert.deepEqual(updateTasks([], { type: 'restore', tasks: [first, first] }), [first]);
});
test('filters and case-insensitive Cyrillic search combine', () => {
  const tasks = [{ ...first, completed: true }, second];
  assert.deepEqual(selectTasks(tasks, 'active', ''), [second]);
  assert.deepEqual(selectTasks(tasks, 'completed', 'ВАЖНОЕ'), [tasks[0]]);
  assert.deepEqual(selectTasks(tasks, 'all', '  🎯  '), [second]);
  assert.deepEqual(selectTasks(tasks, 'all', 'неизвестно'), []);
});
test('task plural forms cover Russian exceptions', () => {
  for (const count of [1, 21, 101]) assert.equal(taskWord(count), 'задача');
  for (const count of [2, 4, 22]) assert.equal(taskWord(count), 'задачи');
  for (const count of [0, 5, 11, 12, 14, 111]) assert.equal(taskWord(count), 'задач');
});
test('reload restores text, state, IDs and ordering', () => {
  const original = [{ ...first, completed: true }, second];
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  assert.equal(saveTasks(storage, original), true);
  assert.deepEqual(loadTasks(storage), { tasks: original, status: 'saved' });
});
test('malformed/unexpected data never crashes or becomes tasks', () => {
  for (const raw of [
    '{',
    'null',
    '[]',
    '42',
    '{"version":9,"tasks":[]}',
    '{"version":1,"tasks":[null]}',
  ]) {
    assert.equal(decodeTasks(raw).status, 'corrupt');
  }
  assert.equal(
    decodeTasks(JSON.stringify({ version: 1, tasks: [first, first] })).status,
    'corrupt',
  );
  assert.equal(decodeTasks('x'.repeat(512_001)).status, 'corrupt');
});
test('stored values are validated and unknown fields dropped', () => {
  const raw = JSON.stringify({ version: 1, tasks: [{ ...first, injected: 'ignored' }] });
  assert.deepEqual(decodeTasks(raw), { tasks: [first], status: 'saved' });
  for (const patch of [{ completed: 'false' }, { createdAt: NaN }, { title: '  ' }, { id: '' }]) {
    assert.equal(
      decodeTasks(JSON.stringify({ version: 1, tasks: [{ ...first, ...patch }] })).status,
      'corrupt',
    );
  }
});
test('missing storage and quota errors degrade without throwing', () => {
  assert.equal(loadTasks(null).status, 'unavailable');
  assert.equal(saveTasks(null, [first]), false);
  const broken = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.equal(loadTasks(broken).status, 'unavailable');
  assert.equal(saveTasks(broken, [first]), false);
});
test('corrupt original is unchanged on read and backed up before explicit recovery', () => {
  const store = new Map([[STORAGE_KEY, '{broken']]);
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  assert.equal(loadTasks(storage).status, 'corrupt');
  assert.equal(store.get(STORAGE_KEY), '{broken');
  assert.equal(recoverStorage(storage, [first]), true);
  assert.equal(store.get('almis.focus.tasks.recovery'), '{broken');
  assert.deepEqual(loadTasks(storage).tasks, [first]);
});
