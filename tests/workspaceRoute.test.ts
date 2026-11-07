import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceRoute, writeWorkspaceRoute } from '../src/domain/workspaceRoute.ts';

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
