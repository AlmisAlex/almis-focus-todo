import { TaskInputError } from './tasks.ts';

export const MAX_PROJECTS = 24;
export const MAX_PROJECT_TITLE = 48;
export const PROJECT_COLORS = ['violet', 'blue', 'green', 'amber', 'rose'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];
export type Project = Readonly<{ id: string; title: string; color: ProjectColor }>;
export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    p.id.length <= 100 &&
    typeof p.title === 'string' &&
    p.title.trim().length > 0 &&
    p.title.length <= MAX_PROJECT_TITLE &&
    PROJECT_COLORS.includes(p.color as ProjectColor)
  );
}
export function normalizeProject(project: Project): Project {
  if (!isProject(project))
    throw new TaskInputError('Укажи название проекта до 48 символов и выбери цвет.');
  return { id: project.id, title: project.title.trim(), color: project.color };
}
