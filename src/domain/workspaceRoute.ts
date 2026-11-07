import type { TaskView } from './taskQueries.ts';

export type WorkspaceRoute = {
  mode: 'list' | 'calendar';
  filter: TaskView;
  projectId: string | null;
};
const home = (): WorkspaceRoute => ({ mode: 'list', filter: 'focus', projectId: null });
const views: readonly TaskView[] = [
  'focus',
  'inbox',
  'all',
  'active',
  'completed',
  'today',
  'overdue',
  'upcoming',
  'undated',
];
export function readWorkspaceRoute(hash: string): WorkspaceRoute {
  if (hash.length > 512) return home();
  const parts = hash.replace(/^#/, '').split('/');
  if (parts[0] === 'calendar' && parts.length === 1)
    return { mode: 'calendar', filter: 'all', projectId: null };
  if (parts[0] === 'view' && parts.length === 2 && views.includes(parts[1] as TaskView))
    return { mode: 'list', filter: parts[1] as TaskView, projectId: null };
  if (
    parts[0] === 'project' &&
    (parts.length === 2 || (parts.length === 3 && parts[2] === 'calendar'))
  ) {
    try {
      const id = decodeURIComponent(parts[1] ?? '');
      if (id && id.length <= 100 && !/[\u0000-\u001f]/.test(id))
        return {
          mode: parts[2] === 'calendar' ? 'calendar' : 'list',
          filter: 'all',
          projectId: id,
        };
    } catch {
      /* Invalid URL encoding uses the safe home view. */
    }
  }
  return home();
}
export function writeWorkspaceRoute(route: WorkspaceRoute): string {
  if (route.projectId)
    return `#project/${encodeURIComponent(route.projectId)}${route.mode === 'calendar' ? '/calendar' : ''}`;
  if (route.mode === 'calendar') return '#calendar';
  return route.filter === 'focus' ? '#list' : `#view/${route.filter}`;
}
