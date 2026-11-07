import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  updateTasks,
  replayTaskActions,
  parseTags,
  validateDetails,
  MAX_TASKS,
  taskStatus,
} from '../src/domain/tasks.ts';
import type { Task, TaskAction } from '../src/domain/tasks.ts';
import {
  saveTasks,
  loadTasks,
  STORAGE_KEY,
  LEGACY_KEY,
  MIGRATION_KEY,
  legacyWorkspaceChanged,
} from '../src/storage/taskStorage.ts';
import { TaskRepository } from '../src/storage/taskRepository.ts';
import {
  defaultPlanner,
  updatePlanner,
  decodePlanner,
  timerElapsed,
} from '../src/domain/planner.ts';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../src/storage/workspaceBackup.ts';

const task: Task = {
  ...createTask('Пример', 'a', 100),
  dueDate: '2026-11-07',
  recurrence: 'daily',
  tags: ['Пример'],
  steps: [{ id: 'step', title: 'Проверить', completed: false }],
};
const complete = (id = 'a', child = 'b'): TaskAction => ({
  type: 'complete-occurrences',
  ids: [id],
  completed: true,
  at: 1000,
  today: '2026-11-07',
  nextIds: { [id]: child },
});
function storageFixture() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  };
}
test('recurrence completion, retry, reopening and child deletion never duplicate an occurrence', () => {
  const first = updateTasks([task], complete());
  assert.equal(first.length, 2);
  assert.equal(first.find((t) => t.id === 'a')?.completedAt, 1000);
  const child = first.find((t) => t.id === 'b')!;
  assert.equal(child.dueDate, '2026-11-08');
  assert.equal(child.completed, false);
  assert.equal(child.steps?.[0]?.completed, false);
  assert.equal(child.nextOccurrenceId, undefined);
  assert.deepEqual(replayTaskActions(first, [complete(), complete()]), first);
  const reopened = updateTasks(first, { type: 'set-work-state', id: 'a', workState: 'doing' });
  assert.equal(taskStatus(reopened.find((t) => t.id === 'a')!), 'doing');
  assert.equal(updateTasks(reopened, complete('a', 'another')).length, 2);
  const deleted = updateTasks(reopened, { type: 'delete', id: 'b' });
  assert.equal(updateTasks(deleted, complete('a', 'another')).length, 1);
  assert.equal(
    updateTasks(first, complete('b', 'c')).find((t) => t.id === 'c')?.dueDate,
    '2026-11-09',
  );
  assert.deepEqual(replayTaskActions([], [complete()]), []);
});
test('recurrence uses current canonical schedule and fails atomically at capacity or calendar boundary', () => {
  const latest = { ...task, recurrence: 'weekly' as const, dueDate: '2026-11-10' };
  assert.equal(
    replayTaskActions([latest], [complete()]).find((t) => t.id === 'b')?.dueDate,
    '2026-11-17',
  );
  assert.equal(
    updateTasks([{ ...task, dueDate: '2026-10-01' }], complete()).find((t) => t.id === 'b')
      ?.dueDate,
    '2026-11-08',
  );
  const full = [
    task,
    ...Array.from({ length: MAX_TASKS - 1 }, (_, i) => createTask('Дело', `x${i}`, 100)),
  ];
  assert.throws(() => updateTasks(full, complete()), /Освободите/);
  assert.equal(full[0]?.completed, false);
  assert.throws(() => updateTasks([{ ...task, dueDate: '9999-12-31' }], complete()), /пределы/);
  assert.throws(
    () => validateDetails({ notes: '', priority: 'normal', dueDate: '', recurrence: 'daily' }),
    /первый срок/,
  );
});
test('two serialized repositories completing the same recurring task and retry after quota retain one child', async () => {
  const f = storageFixture();
  saveTasks(f.storage, [task]);
  let queue = Promise.resolve();
  const lock = <T>(work: () => T) => {
    const result = queue.then(work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const a = new TaskRepository(() => f.storage, lock);
  const b = new TaskRepository(() => f.storage, lock);
  await Promise.all([a.apply(complete()), b.apply(complete('a', 'c'))]);
  assert.equal(loadTasks(f.storage).tasks.length, 2);
  let denied = true;
  const port = {
    ...f.storage,
    setItem: (key: string, value: string) => {
      if (denied) throw Error('quota');
      f.storage.setItem(key, value);
    },
  };
  const repo = new TaskRepository(() => port, lock);
  const child = loadTasks(f.storage).tasks.find((t) => t.id !== 'a')!;
  await repo.apply(complete(child.id, 'd'));
  assert.equal(repo.getSnapshot().status, 'unsaved');
  denied = false;
  assert.equal(await repo.retrySave(), true);
  assert.equal(loadTasks(f.storage).tasks.length, 3);
});
test('v3 migration preserves original bytes; old-version writes cannot overwrite v4 workspace', () => {
  const f = storageFixture();
  const original = JSON.stringify({
    version: 3,
    tasks: [{ ...createTask('Старое', 'old', 100), notes: 'текст' }],
    projects: [],
  });
  f.values.set(LEGACY_KEY, original);
  assert.equal(loadTasks(f.storage).tasks[0]?.title, 'Старое');
  assert.equal(saveTasks(f.storage, [task]), true);
  assert.equal(f.values.get(MIGRATION_KEY), original);
  assert.equal(f.values.get(LEGACY_KEY), original);
  assert.equal(legacyWorkspaceChanged(f.storage), false);
  f.values.set(LEGACY_KEY, JSON.stringify({ version: 3, tasks: [], projects: [] }));
  assert.equal(legacyWorkspaceChanged(f.storage), true);
  assert.deepEqual(loadTasks(f.storage).tasks, [task]);
  assert.equal(JSON.parse(f.values.get(STORAGE_KEY)!).version, 4);
});
test('an old-tab write is exposed even when migration started with empty legacy storage', () => {
  const f = storageFixture();
  saveTasks(f.storage, [task]);
  assert.equal(legacyWorkspaceChanged(f.storage), false);
  f.values.set(
    LEGACY_KEY,
    JSON.stringify({
      version: 3,
      tasks: [createTask('Из прежней вкладки', 'legacy', 100)],
      projects: [],
    }),
  );
  assert.equal(legacyWorkspaceChanged(f.storage), true);
  assert.deepEqual(loadTasks(f.storage).tasks, [task]);
});
test('tags normalize case duplicates, enforce limits and survive v4 storage and v5 backup', async () => {
  assert.deepEqual(parseTags(' #Работа, звонок, работа, '), ['работа', 'звонок']);
  assert.throws(() => parseTags('x'.repeat(25)));
  assert.throws(() => parseTags(Array.from({ length: 9 }, (_, i) => String(i)).join(',')));
  const f = storageFixture();
  saveTasks(f.storage, [task]);
  assert.deepEqual(loadTasks(f.storage).tasks, [task]);
  const restored = importWorkspaceBackup(await exportWorkspaceBackup([task], [], []));
  assert.deepEqual(restored.tasks, [task]);
});
test('focus clock survives reload, background time, pause and duplicate completion without double counting', () => {
  let data = updatePlanner(defaultPlanner(), {
    type: 'start',
    id: 'session',
    taskId: 'a',
    title: 'Дело',
    kind: 'focus',
    now: 1000,
  });
  data = decodePlanner(JSON.stringify(data));
  assert.equal(timerElapsed(data.timer!, 61_000), 60_000);
  data = updatePlanner(data, { type: 'pause', id: 'session', now: 61_000 });
  assert.equal(timerElapsed(data.timer!, 500_000), 60_000);
  data = updatePlanner(data, { type: 'resume', id: 'session', now: 500_000 });
  data = updatePlanner(data, { type: 'finish', id: 'session', now: 560_000 });
  assert.equal(data.history[0]?.seconds, 120);
  assert.equal(data.timer, null);
  assert.equal(
    updatePlanner(data, { type: 'finish', id: 'session', now: 600_000 }).history.length,
    1,
  );
  assert.throws(() => updatePlanner(data, { type: 'preferences', patch: { focusMinutes: 0 } }));
});
test('full backup includes preferences/history and paused timer; restore merges history idempotently', async () => {
  let data = updatePlanner(defaultPlanner(), {
    type: 'preferences',
    patch: { theme: 'night', density: 'compact' },
  });
  data = updatePlanner(data, {
    type: 'start',
    id: 's',
    taskId: '',
    title: '',
    kind: 'focus',
    now: Date.now() - 1000,
  });
  const parsed = importWorkspaceBackup(await exportWorkspaceBackup([task], [], [], data));
  assert.equal(parsed.planner?.preferences.theme, 'night');
  assert.equal(parsed.planner?.timer?.startedAt, null);
  const restored = updatePlanner(defaultPlanner(), { type: 'restore', data: parsed.planner! });
  assert.equal(restored.timer?.id, 's');
  assert.equal(restored.preferences.density, 'compact');
  assert.deepEqual(updatePlanner(restored, { type: 'restore', data: parsed.planner! }), restored);
});
