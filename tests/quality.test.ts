import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, updateTasks } from '../src/domain/tasks.ts';
import type { TaskStep } from '../src/domain/tasks.ts';
import { replayWorkspaceActions, updateWorkspace } from '../src/domain/workspace.ts';
import { commandSearch } from '../src/domain/commandSearch.ts';
import type { Project } from '../src/domain/projects.ts';

const task = {
  ...createTask('Исходное имя', 'task', 100),
  notes: 'Новая заметка другой вкладки',
  dueDate: '2026-11-09',
  priority: 'high' as const,
};
const step = { id: 's1', title: 'Исходный шаг', completed: false };
const work: Project = { id: 'work', title: 'Работа', color: 'violet' };
const personal: Project = { id: 'personal', title: 'Личное', color: 'green' };

test('title-only editor patch preserves newer note, deadline and priority from another tab', () => {
  const [edited] = updateTasks([task], {
    type: 'edit',
    id: task.id,
    title: 'Новое имя',
    details: {},
  });
  assert.deepEqual(edited, { ...task, title: 'Новое имя' });
});
test('note-only editor patch preserves a concurrently renamed title', () => {
  const [edited] = updateTasks([task], {
    type: 'edit',
    id: task.id,
    details: { notes: 'Моя заметка' },
  });
  assert.deepEqual(edited, { ...task, notes: 'Моя заметка' });
});
test('checklist draft preserves external completion and additions while applying text edit', () => {
  const external = {
    ...task,
    steps: [
      { ...step, completed: true },
      { id: 'external', title: 'Чужой новый шаг', completed: false },
    ],
  };
  const [edited] = updateTasks([external], {
    type: 'edit',
    id: task.id,
    details: { steps: [{ ...step, title: 'Уточнённый шаг' }] },
    baseSteps: [step],
  });
  assert.deepEqual(edited?.steps, [
    { ...step, title: 'Уточнённый шаг', completed: true },
    external.steps[1],
  ]);
});
test('external checklist deletion wins over stale draft; explicit draft deletion is applied', () => {
  const second = { id: 's2', title: 'Второй шаг', completed: false };
  const [edited] = updateTasks([{ ...task, steps: [second] }], {
    type: 'edit',
    id: task.id,
    details: { steps: [{ ...step, title: 'Старый черновик' }] },
    baseSteps: [step, second],
  });
  assert.deepEqual(edited?.steps, []);
});
test('merged concurrent checklist additions enforce capacity before accepting an edit', () => {
  const current: TaskStep[] = Array.from({ length: 20 }, (_, i) => ({
    id: `external${i}`,
    title: `Шаг ${i}`,
    completed: false,
  }));
  assert.throws(
    () =>
      updateTasks([{ ...task, steps: current }], {
        type: 'edit',
        id: task.id,
        details: { steps: [step] },
        baseSteps: [],
      }),
    /20 шагов/,
  );
});
test('queued partial editor intentions retain canonical fields and other-tab step edits', () => {
  const data = { tasks: [{ ...task, steps: [{ ...step, completed: true }] }], projects: [] };
  const merged = replayWorkspaceActions(data, [
    {
      type: 'edit',
      id: task.id,
      title: 'Мой заголовок',
      details: { steps: [{ ...step, title: 'Мой текст шага' }] },
      baseSteps: [step],
    },
  ]);
  assert.equal(merged.tasks[0]?.notes, task.notes);
  assert.equal(merged.tasks[0]?.steps?.[0]?.completed, true);
});
test('bulk project undo never replaces a later move from another tab', () => {
  const data = {
    tasks: [
      { ...task, projectId: work.id },
      { ...task, id: 'second', projectId: work.id },
    ],
    projects: [work, personal],
  };
  const moved = updateWorkspace(data, {
    type: 'set-projects',
    changes: data.tasks.map((t) => ({ id: t.id, projectId: personal.id })),
  });
  const concurrent = updateWorkspace(moved, {
    type: 'move-project',
    ids: ['second'],
    projectId: '',
  });
  const undone = updateWorkspace(concurrent, {
    type: 'set-projects',
    changes: data.tasks.map((t) => ({
      id: t.id,
      projectId: work.id,
      expectedProjectId: personal.id,
    })),
  });
  assert.equal(undone.tasks[0]?.projectId, work.id);
  assert.equal(undone.tasks[1]?.projectId, '');
});
test('global command search finds completed tasks by notes and steps beyond the current view', () => {
  const tasks = [{ ...task, completed: true, steps: [{ ...step, title: 'Согласовать эскиз' }] }];
  assert.equal(commandSearch(tasks, [work], ' ЭСКИЗ ', '2026-11-07')[0]?.kind, 'task');
  assert.equal(commandSearch(tasks, [work], 'другой вкладки', '2026-11-07')[0]?.key, 'task:task');
  assert.equal(commandSearch(tasks, [work], 'работа', '2026-11-07')[0]?.kind, 'project');
  assert.equal(commandSearch(tasks, [work], 'несуществующее', '2026-11-07').length, 0);
});
