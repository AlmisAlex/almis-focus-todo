import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, updateTasks } from '../src/domain/tasks.ts';
import { queryTasks } from '../src/domain/taskQueries.ts';
import { commandSearch } from '../src/domain/commandSearch.ts';
import {
  taskDraft,
  draftChanges,
  materializeDraft,
  draftWithStatus,
} from '../src/domain/taskDraft.ts';
import { loadTasks, saveTasks, STORAGE_KEY } from '../src/storage/taskStorage.ts';
import { PLANNER_KEY, decodePlanner, defaultPlanner } from '../src/domain/planner.ts';
import { commitPlannerCommand, PLANNER_RECOVERY_KEY } from '../src/storage/plannerStorage.ts';
import { readBoundedText } from '../src/domain/boundedText.ts';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../src/storage/workspaceBackup.ts';

function fixture() {
  const data = new Map<string, string>();
  return {
    data,
    port: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    },
  };
}
test('bulk date removal cannot persist an unreadable recurring workspace', () => {
  const f = fixture();
  const recurring = {
    ...createTask('Повтор', 'repeat', 100),
    recurrence: 'daily' as const,
    dueDate: '2026-11-08',
  };
  assert.equal(saveTasks(f.port, [recurring]), true);
  const before = f.data.get(STORAGE_KEY);
  assert.throws(
    () =>
      updateTasks([recurring], { type: 'set-dates', changes: [{ id: recurring.id, dueDate: '' }] }),
    /Повторяющейся/,
  );
  assert.equal(saveTasks(f.port, [{ ...recurring, dueDate: '' }]), false);
  assert.equal(f.data.get(STORAGE_KEY), before);
  assert.deepEqual(loadTasks(f.port).tasks, [recurring]);
  assert.equal(loadTasks(f.port).status, 'saved');
});
test('corrupt planner can restore a backup only after preserving all original bytes', () => {
  const f = fixture();
  const raw = '{ incomplete settings';
  f.data.set(PLANNER_KEY, raw);
  const copy = defaultPlanner();
  copy.preferences.theme = 'night';
  const restored = commitPlannerCommand(f.port, { type: 'restore', data: copy });
  assert.equal(f.data.get(PLANNER_RECOVERY_KEY), raw);
  assert.equal(decodePlanner(f.data.get(PLANNER_KEY)!).preferences.theme, 'night');
  assert.deepEqual(commitPlannerCommand(f.port, { type: 'recover' }), restored);
});
test('explicit planner recovery protects original on backup quota failure', () => {
  const f = fixture();
  f.data.set(PLANNER_KEY, 'ordinary invalid JSON');
  const denied = {
    ...f.port,
    setItem: (key: string, value: string) => {
      if (key === PLANNER_RECOVERY_KEY) throw Error('quota');
      f.port.setItem(key, value);
    },
  };
  assert.throws(() => commitPlannerCommand(denied, { type: 'recover' }), /quota/);
  assert.equal(f.data.get(PLANNER_KEY), 'ordinary invalid JSON');
  assert.equal(commitPlannerCommand(f.port, { type: 'recover' }).timer, null);
  assert.equal(f.data.get(PLANNER_RECOVERY_KEY), 'ordinary invalid JSON');
});
test('PDF text stream stops at a small synthetic character budget and cancels its reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue({ items: [{ str: 'hello' }, { str: 'world' }, { str: 'later' }] });
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await readBoundedText(stream, { characters: 8, items: 4 });
  assert.equal(result.value, 'hello wo');
  assert.equal(result.truncated, true);
  assert.equal(cancelled, true);
});
test('PDF text stream respects item limits and ordinary cancellation without large inputs', async () => {
  const limited = new ReadableStream({
    start(controller) {
      controller.enqueue({ items: [{ str: 'one' }, { str: 'two' }, { str: 'three' }] });
    },
  });
  assert.deepEqual(await readBoundedText(limited, { characters: 40, items: 2 }), {
    value: 'one two',
    truncated: true,
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(readBoundedText(new ReadableStream(), undefined, controller.signal), {
    name: 'AbortError',
  });
});
test('plain tags and visible hashtag notation work in task and global search', () => {
  const task = { ...createTask('Обычная задача', 'a', 100), tags: ['Работа'] };
  for (const query of ['работа', '#Работа']) {
    assert.equal(queryTasks([task], 'all', query, 'newest', '2026-11-08').length, 1);
    assert.equal(
      commandSearch([task], [], query, '2026-11-08').filter((result) => result.kind === 'task')
        .length,
      1,
    );
  }
});
test('existing full v4 file backups remain readable after v5 upgrade', async () => {
  const task = createTask('Старая задача', 'old', 100);
  const file = {
    id: 'file',
    taskId: task.id,
    name: 'note.txt',
    type: 'text/plain',
    size: 3,
    createdAt: 100,
    blob: new Blob(['abc']),
  };
  const legacy = JSON.parse(await exportWorkspaceBackup([task], [], [file]));
  legacy.version = 4;
  const restored = importWorkspaceBackup(JSON.stringify(legacy));
  assert.deepEqual(restored.tasks, [task]);
  assert.equal(await restored.attachments[0]!.blob.text(), 'abc');
});
test('editing details and completion is one atomic replay-safe recurrence operation', () => {
  const task = {
    ...createTask('Повтор', 'r', 100),
    recurrence: 'weekly' as const,
    dueDate: '2026-11-08',
  };
  const action = {
    type: 'edit' as const,
    id: task.id,
    title: 'Новый заголовок',
    details: { notes: 'Детали' },
    status: 'done' as const,
    completion: { at: 1000, today: '2026-11-08', nextIds: { r: 'next' } },
  };
  const tasks = updateTasks([task], action);
  assert.equal(tasks.length, 2);
  assert.equal(tasks.find((item) => item.id === 'r')?.completed, true);
  assert.equal(tasks.find((item) => item.id === 'next')?.title, 'Новый заголовок');
  assert.equal(tasks.find((item) => item.id === 'next')?.dueDate, '2026-11-15');
  assert.deepEqual(updateTasks(tasks, action), tasks);
  const f = fixture();
  assert.equal(saveTasks(f.port, tasks), true);
  assert.equal(loadTasks(f.port).status, 'saved');
});
test('completed editor draft reports its real status and a new pending step reopens it', () => {
  const original = {
    ...createTask('Готово', 'done', 100),
    completed: true,
    workState: 'doing' as const,
  };
  const baseline = taskDraft(original);
  assert.equal(baseline.status, 'done');
  const draft = materializeDraft({ ...baseline, stepDraft: 'Ещё один шаг' });
  assert.equal(draft.status, 'doing');
  assert.equal(draftChanges(baseline, draft).status, 'doing');
});
test('choosing Done includes the last typed checklist step before atomically completing it', () => {
  const original = taskDraft(createTask('План', 'plan', 100));
  const done = draftWithStatus({ ...original, stepDraft: 'Последний шаг' }, 'done');
  assert.equal(done.status, 'done');
  assert.equal(done.stepDraft, '');
  assert.equal(done.steps.length, 1);
  assert.equal(done.steps[0]?.completed, false);
  assert.equal(draftChanges(original, done).status, 'done');
  const changes = draftChanges(original, done);
  const saved = updateTasks([createTask('План', 'plan', 100)], {
    type: 'edit',
    id: 'plan',
    details: changes.details,
    status: changes.status!,
    completion: { at: 1000, today: '2026-11-08', nextIds: {} },
  });
  assert.equal(saved[0]?.steps?.[0]?.completed, true);
});

test('reversing an unsaved Done choice preserves the original checklist completion bits', () => {
  const baseline = taskDraft({
    ...createTask('План', 'plan', 100),
    steps: [
      { id: 'a', title: 'Первый', completed: false },
      { id: 'b', title: 'Второй', completed: true },
    ],
  });
  const draft = draftWithStatus(draftWithStatus(baseline, 'done'), 'todo');
  assert.deepEqual(draft.steps, baseline.steps);
  assert.deepEqual(draftChanges(baseline, draft).details, {});
});
