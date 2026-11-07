import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readWorkspaceRoute,
  writeWorkspaceRoute,
  routeAfterCreate,
} from '../src/domain/workspaceRoute.ts';
import type { Task } from '../src/domain/tasks.ts';
import type { WorkspaceRoute } from '../src/domain/workspaceRoute.ts';
import { queryWorkspaceTasks } from '../src/domain/taskQueries.ts';

test('workspace routes restore global views and calendar', () => {
  for (const view of ['focus', 'inbox', 'all', 'upcoming', 'completed'] as const) {
    const route = { mode: 'list' as const, filter: view, projectId: null };
    assert.deepEqual(readWorkspaceRoute(writeWorkspaceRoute(route)), route);
  }
  assert.equal(readWorkspaceRoute('#calendar').mode, 'calendar');
});
test('project routes round trip IDs without putting task content in URL', () => {
  const route = { mode: 'list' as const, filter: 'all' as const, projectId: 'project/один' };
  assert.deepEqual(readWorkspaceRoute(writeWorkspaceRoute(route)), route);
  assert.deepEqual(readWorkspaceRoute(writeWorkspaceRoute({ ...route, mode: 'calendar' })), {
    ...route,
    mode: 'calendar',
  });
});
test('invalid or unknown routes safely fall back to My Day', () => {
  for (const hash of [
    '#view/unknown',
    '#project/',
    '#project/%ZZ',
    '#project/' + 'x'.repeat(101),
    '#' + 'x'.repeat(600),
    '#other',
  ])
    assert.equal(readWorkspaceRoute(hash).filter, 'focus');
});

test('new tasks retain matching contexts and every creation destination contains the task', () => {
  const today = '2026-11-07';
  const base: Task = { id: 'new', title: 'Новая задача', completed: false, createdAt: 1 };
  const cases: { route: WorkspaceRoute; task: Task; expected: WorkspaceRoute }[] = [
    {
      route: { mode: 'list', filter: 'inbox', projectId: null },
      task: base,
      expected: { mode: 'list', filter: 'inbox', projectId: null },
    },
    {
      route: { mode: 'list', filter: 'active', projectId: null },
      task: base,
      expected: { mode: 'list', filter: 'active', projectId: null },
    },
    {
      route: { mode: 'list', filter: 'focus', projectId: null },
      task: { ...base, projectId: 'work', focusDate: today },
      expected: { mode: 'list', filter: 'focus', projectId: null },
    },
    {
      route: { mode: 'list', filter: 'focus', projectId: null },
      task: { ...base, dueDate: '2026-11-09' },
      expected: { mode: 'list', filter: 'all', projectId: null },
    },
    {
      route: { mode: 'list', filter: 'completed', projectId: null },
      task: base,
      expected: { mode: 'list', filter: 'all', projectId: null },
    },
    {
      route: { mode: 'list', filter: 'all', projectId: 'work' },
      task: { ...base, projectId: 'personal' },
      expected: { mode: 'list', filter: 'all', projectId: 'personal' },
    },
    {
      route: { mode: 'list', filter: 'all', projectId: 'work' },
      task: base,
      expected: { mode: 'list', filter: 'inbox', projectId: null },
    },
    {
      route: { mode: 'calendar', filter: 'all', projectId: 'work' },
      task: { ...base, projectId: 'personal', dueDate: today },
      expected: { mode: 'calendar', filter: 'all', projectId: 'personal' },
    },
    {
      route: { mode: 'calendar', filter: 'all', projectId: 'work' },
      task: { ...base, projectId: 'work' },
      expected: { mode: 'list', filter: 'undated', projectId: 'work' },
    },
    {
      route: { mode: 'calendar', filter: 'all', projectId: null },
      task: { ...base, projectId: 'personal', dueDate: today },
      expected: { mode: 'calendar', filter: 'all', projectId: null },
    },
  ];
  for (const { route, task, expected } of cases) {
    const next = routeAfterCreate(task, route, today);
    assert.deepEqual(next, expected);
    assert.equal(
      queryWorkspaceTasks([task], {
        view: next.filter,
        projectId: next.projectId,
        calendarDay: next.mode === 'calendar' ? (task.dueDate ?? '') : '',
        query: '',
        sort: 'newest',
        today,
      }).length,
      1,
    );
  }
});
