import { MAX_TASKS, TaskInputError, replayTaskActions, updateTasks } from './tasks.ts';
import type { Task, TaskAction } from './tasks.ts';
import { MAX_PROJECTS, normalizeProject } from './projects.ts';
import type { Project } from './projects.ts';

export type WorkspaceData = { tasks: Task[]; projects: Project[] };
export type ProjectChange = { id: string; projectId: string; expectedProjectId?: string };
export type WorkspaceAction =
  | TaskAction
  | { type: 'add-project'; project: Project }
  | { type: 'rename-project'; project: Project }
  | { type: 'remove-project'; id: string }
  | { type: 'move-project'; ids: readonly string[]; projectId: string }
  | { type: 'set-projects'; changes: readonly ProjectChange[] }
  | { type: 'import-workspace'; tasks: readonly Task[]; projects: readonly Project[] };

function apply(data: WorkspaceData, action: WorkspaceAction, replay: boolean): WorkspaceData {
  let tasks = data.tasks;
  let projects = data.projects;
  switch (action.type) {
    case 'add-project': {
      const project = normalizeProject(action.project);
      if (!projects.some((item) => item.id === project.id)) projects = [...projects, project];
      break;
    }
    case 'rename-project': {
      const project = normalizeProject(action.project);
      projects = projects.map((item) => (item.id === project.id ? project : item));
      break;
    }
    case 'remove-project':
      projects = projects.filter((item) => item.id !== action.id);
      tasks = tasks.map((task) =>
        task.projectId === action.id ? { ...task, projectId: '' } : task,
      );
      break;
    case 'move-project': {
      const ids = new Set(action.ids);
      tasks = tasks.map((task) =>
        ids.has(task.id) ? { ...task, projectId: action.projectId } : task,
      );
      break;
    }
    case 'set-projects': {
      const changes = new Map(action.changes.map((change) => [change.id, change]));
      tasks = tasks.map((task) => {
        const change = changes.get(task.id);
        if (
          !change ||
          (change.expectedProjectId !== undefined &&
            (task.projectId ?? '') !== change.expectedProjectId)
        )
          return task;
        return { ...task, projectId: change.projectId };
      });
      break;
    }
    case 'import-workspace': {
      const ids = new Set(projects.map((item) => item.id));
      projects = [...projects];
      for (const project of action.projects)
        if (!ids.has(project.id)) {
          projects.push(normalizeProject(project));
          ids.add(project.id);
        }
      tasks = replayTaskActions(tasks, [{ type: 'restore', tasks: action.tasks }], false);
      break;
    }
    default:
      tasks = replay ? replayTaskActions(tasks, [action], false) : updateTasks(tasks, action);
  }
  const projectIds = new Set(projects.map((project) => project.id));
  // Stale editor drafts cannot recreate deleted projects. Tasks return to Inbox.
  tasks = tasks.map((task) =>
    task.projectId && !projectIds.has(task.projectId) ? { ...task, projectId: '' } : task,
  );
  return { tasks, projects };
}
function check(data: WorkspaceData): WorkspaceData {
  if (data.projects.length > MAX_PROJECTS)
    throw new TaskInputError(`Можно создать не больше ${MAX_PROJECTS} проектов.`);
  if (data.tasks.length > MAX_TASKS)
    throw new TaskInputError(
      `В списке больше ${MAX_TASKS} задач. Освободи место и повтори сохранение.`,
    );
  return data;
}
export function updateWorkspace(data: WorkspaceData, action: WorkspaceAction): WorkspaceData {
  return check(apply(data, action, false));
}
export function replayWorkspaceActions(
  data: WorkspaceData,
  actions: readonly WorkspaceAction[],
): WorkspaceData {
  for (const action of actions) data = apply(data, action, true);
  return check(data);
}
