import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, isTask, updateTasks, validateDetails } from '../src/domain/tasks.ts';
import { updateWorkspace, replayWorkspaceActions } from '../src/domain/workspace.ts';
import { decodeTasks, loadTasks, saveTasks, STORAGE_KEY } from '../src/storage/taskStorage.ts';
import { exportTasks, importWorkspace } from '../src/storage/taskTransfer.ts';
import { matchesView, queryWorkspaceTasks } from '../src/domain/taskQueries.ts';
import { TaskRepository } from '../src/storage/taskRepository.ts';
import { normalizeProject } from '../src/domain/projects.ts';
import type { Project } from '../src/domain/projects.ts';

const work: Project = { id: 'work', title: 'Работа', color: 'violet' };
const personal: Project = { id: 'personal', title: 'Личное', color: 'green' };
const base = createTask('Большое дело', 'task', 100);
const task = {
  ...base,
  projectId: work.id,
  focusDate: '2026-11-07',
  notes: 'Детали',
  steps: [
    { id: 'step1', title: 'Первый шаг', completed: false },
    { id: 'step2', title: 'Второй шаг', completed: true },
  ],
};
function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  let queue = Promise.resolve();
  const lock = <T>(work: () => T): Promise<T> => {
    const p = queue.then(work);
    queue = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  };
  return { values, storage, lock };
}

test('projects normalize valid names and reject invalid fields', () => {
  assert.equal(normalizeProject({ ...work, title: '  Работа  ' }).title, 'Работа');
  assert.throws(() => normalizeProject({ ...work, title: ' ' }));
  assert.throws(() => normalizeProject({ ...work, title: 'x'.repeat(49) }));
  assert.throws(() => normalizeProject({ ...work, color: 'url(bad)' as Project['color'] }));
});
test('project rename preserves stable relation; removal keeps tasks and steps in Inbox', () => {
  const data = { tasks: [task], projects: [work] };
  const renamed = updateWorkspace(data, {
    type: 'rename-project',
    project: { ...work, title: 'Новая работа' },
  });
  assert.equal(renamed.tasks[0]?.projectId, 'work');
  assert.equal(renamed.projects[0]?.title, 'Новая работа');
  const removed = updateWorkspace(renamed, { type: 'remove-project', id: 'work' });
  assert.deepEqual(removed.tasks, [{ ...task, projectId: '' }]);
  assert.deepEqual(removed.projects, []);
  assert.equal(data.projects[0]?.title, 'Работа');
});
test('completing parent completes steps; reopening one step reopens parent without losing other steps', () => {
  const completed = updateTasks([task], { type: 'set-completed', id: task.id, completed: true });
  assert.ok(completed[0]?.steps?.every((step) => step.completed));
  const reopened = updateTasks(completed, {
    type: 'set-step',
    id: task.id,
    stepId: 'step1',
    completed: false,
  });
  assert.equal(reopened[0]?.completed, false);
  assert.equal(reopened[0]?.steps?.[0]?.completed, false);
  assert.equal(reopened[0]?.steps?.[1]?.completed, true);
  assert.deepEqual(
    updateTasks(completed, { type: 'set-step', id: task.id, stepId: 'gone', completed: false }),
    completed,
  );
});
test('steps and focus validate bounded content and duplicate IDs', () => {
  assert.equal(isTask({ ...task, steps: [{ id: 'a', title: '  ', completed: false }] }), false);
  assert.equal(isTask({ ...task, steps: [task.steps[0], task.steps[0]] }), false);
  assert.equal(
    isTask({ ...task, steps: [{ id: 'a', title: 'x'.repeat(121), completed: false }] }),
    false,
  );
  assert.throws(() =>
    validateDetails({ notes: '', dueDate: '', priority: 'normal', focusDate: '2026-02-30' }),
  );
});
test('My Day is explicit focus plus today/overdue and expires without altering real deadline', () => {
  const focused = updateTasks([{ ...base, dueDate: '2027-01-01' }], {
    type: 'set-focus',
    id: base.id,
    date: '2026-11-07',
  })[0]!;
  assert.equal(focused.dueDate, '2027-01-01');
  assert.equal(matchesView(focused, 'focus', '2026-11-07'), true);
  assert.equal(matchesView(focused, 'focus', '2026-11-08'), false);
  assert.equal(matchesView({ ...base, dueDate: '2026-11-06' }, 'focus', '2026-11-07'), true);
  assert.equal(
    matchesView({ ...base, completed: true, focusDate: '2026-11-07' }, 'focus', '2026-11-07'),
    false,
  );
});
test('schema v3 roundtrip preserves projects, checklist, focus and drops unknown nested fields', () => {
  const raw = JSON.stringify({
    version: 3,
    projects: [{ ...work, privateExtra: 'drop' }],
    tasks: [
      { ...task, steps: task.steps.map((step) => ({ ...step, extra: 'drop' })), extra: 'drop' },
    ],
  });
  assert.deepEqual(decodeTasks(raw), { tasks: [task], projects: [work], status: 'saved' });
  assert.deepEqual(importWorkspace(exportTasks([task], [work])), {
    tasks: [task],
    projects: [work],
  });
  assert.equal(
    decodeTasks(JSON.stringify({ version: 3, projects: [], tasks: [task] })).status,
    'corrupt',
  );
  assert.equal(
    decodeTasks(JSON.stringify({ version: 3, projects: [work, work], tasks: [] })).status,
    'corrupt',
  );
});
test('v2 migration creates exact full backup before v3 and never replaces data if backup fails', () => {
  const f = fixture();
  const original = JSON.stringify({
    version: 2,
    tasks: [{ ...base, notes: 'Старая заметка', dueDate: '2026-11-07' }],
  });
  f.values.set(STORAGE_KEY, original);
  const denied = {
    getItem: f.storage.getItem,
    setItem: (key: string, value: string) => {
      if (key.endsWith('before-v3')) throw Error('quota');
      f.storage.setItem(key, value);
    },
  };
  assert.equal(saveTasks(denied, [task], [work]), false);
  assert.equal(f.values.get(STORAGE_KEY), original);
  assert.equal(saveTasks(f.storage, [task], [work]), true);
  assert.equal(f.values.get('almis.focus.tasks.before-v3'), original);
  assert.equal(JSON.parse(f.values.get(STORAGE_KEY)!).version, 3);
  assert.deepEqual(loadTasks(f.storage).projects, [work]);
});
test('workspace import merges project and task IDs without overwriting current edits', () => {
  const data = { tasks: [task], projects: [work] };
  const result = updateWorkspace(data, {
    type: 'import-workspace',
    projects: [{ ...work, title: 'Старое имя' }, personal],
    tasks: [
      { ...task, title: 'Старый текст' },
      { ...base, id: 'new', projectId: personal.id },
    ],
  });
  assert.equal(result.projects.find((p) => p.id === 'work')?.title, 'Работа');
  assert.equal(result.tasks.find((t) => t.id === 'task')?.title, task.title);
  assert.equal(result.tasks.find((t) => t.id === 'new')?.projectId, personal.id);
});
test('deleted project does not return from old editor draft; task survives in Inbox', () => {
  const latest = { tasks: [{ ...task, projectId: '' }], projects: [] };
  const next = replayWorkspaceActions(latest, [
    {
      type: 'edit',
      id: task.id,
      title: 'Новый текст',
      details: { notes: '', dueDate: '', priority: 'normal', projectId: 'work' },
    },
  ]);
  assert.equal(next.tasks[0]?.projectId, '');
  assert.equal(next.tasks[0]?.title, 'Новый текст');
  assert.equal(next.projects.length, 0);
});
test('editing title without changing steps preserves another tab step completion', () => {
  const latest = {
    tasks: [{ ...task, steps: task.steps.map((step) => ({ ...step, completed: true })) }],
    projects: [work],
  };
  const result = replayWorkspaceActions(latest, [
    {
      type: 'edit',
      id: task.id,
      title: 'Новый текст',
      details: { notes: 'Детали', dueDate: '', priority: 'normal' },
    },
  ]);
  assert.ok(result.tasks[0]?.steps?.every((step) => step.completed));
});
test('two repositories keep both project catalogs and associated tasks', async () => {
  const f = fixture();
  const a = new TaskRepository(() => f.storage, f.lock),
    b = new TaskRepository(() => f.storage, f.lock);
  await Promise.all([
    a.apply({ type: 'add-project', project: work }),
    b.apply({ type: 'add-project', project: personal }),
  ]);
  await Promise.all([
    a.apply({ type: 'add', task }),
    b.apply({ type: 'add', task: { ...base, id: 'personal-task', projectId: personal.id } }),
  ]);
  const stored = loadTasks(f.storage);
  assert.equal(stored.projects.length, 2);
  assert.equal(stored.tasks.length, 2);
  assert.equal(stored.tasks.find((t) => t.id === 'task')?.projectId, work.id);
});
test('quota retry atomically rebases imported project+task over another tab workspace', async () => {
  const f = fixture();
  let full = true;
  const denied = {
    getItem: f.storage.getItem,
    setItem: (key: string, value: string) => {
      if (full) throw Error('quota');
      f.storage.setItem(key, value);
    },
  };
  const a = new TaskRepository(() => denied, f.lock),
    b = new TaskRepository(() => f.storage, f.lock);
  await a.apply({ type: 'import-workspace', tasks: [task], projects: [work] });
  assert.equal(a.getSnapshot().hasUnsavedChanges, true);
  await b.apply({ type: 'add-project', project: personal });
  await b.apply({ type: 'add', task: { ...base, id: 'b', projectId: personal.id } });
  full = false;
  assert.equal(await a.retrySave(), true);
  const loaded = loadTasks(f.storage);
  assert.equal(loaded.projects.length, 2);
  assert.equal(loaded.tasks.length, 2);
  assert.equal(loaded.status, 'saved');
});

test('editing completed task checklist with unfinished work reopens parent', () => {
  const finished = {
    ...task,
    completed: true,
    steps: task.steps.map((step) => ({ ...step, completed: true })),
  };
  const result = updateTasks([finished], {
    type: 'edit',
    id: task.id,
    title: task.title,
    details: {
      notes: '',
      dueDate: '',
      priority: 'normal',
      steps: [...finished.steps, { id: 'new-step', title: 'Новый шаг', completed: false }],
    },
  });
  assert.equal(result[0]?.completed, false);
  assert.equal(result[0]?.steps?.length, 3);
});

test('clear completed scope never deletes another project or another calendar day', () => {
  const a = { ...base, id: 'done-a', completed: true, projectId: work.id, dueDate: '2026-11-07' };
  const b = {
    ...base,
    id: 'done-b',
    completed: true,
    projectId: personal.id,
    dueDate: '2026-11-07',
  };
  const c = {
    ...base,
    id: 'done-next',
    completed: true,
    projectId: work.id,
    dueDate: '2026-11-08',
  };
  const data = { tasks: [a, b, c], projects: [work, personal] };
  const visible = queryWorkspaceTasks(data.tasks, {
    view: 'all',
    query: '',
    sort: 'newest',
    today: '2026-11-07',
    projectId: work.id,
    calendarDay: '2026-11-07',
  });
  const remaining = updateWorkspace(data, {
    type: 'delete-many',
    ids: visible.filter((task) => task.completed).map((task) => task.id),
  });
  assert.deepEqual(
    remaining.tasks.map((task) => task.id),
    ['done-b', 'done-next'],
  );
});
