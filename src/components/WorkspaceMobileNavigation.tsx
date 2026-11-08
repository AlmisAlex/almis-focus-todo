import type { Project } from '../domain/projects.ts';
import type { TaskView } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function WorkspaceMobileNavigation({
  mode,
  projectId,
  projects,
  onView,
  onCalendar,
  onProject,
  onFiles,
  onAddProject,
  layout,
  onList,
  onBoard,
  onFocus,
  onSettings,
}: {
  mode: 'list' | 'calendar';
  filter: TaskView;
  projectId: string | null;
  isHome: boolean;
  projects: readonly Project[];
  onView: (view: TaskView) => void;
  onCalendar: () => void;
  onProject: (id: string) => void;
  onFiles: () => void;
  onAddProject: () => void;
  layout: 'list' | 'board' | 'cards';
  onList: () => void;
  onBoard: () => void;
  onFocus: () => void;
  onSettings: () => void;
}) {
  return (
    <>
      <nav className="mobile-workspace-nav" aria-label="Мобильное рабочее пространство">
        <button type="button" aria-pressed={mode === 'list' && layout !== 'board'} onClick={onList}>
          <Icon name="layers" size={18} />
          Задачи
        </button>
        <button
          type="button"
          aria-pressed={mode === 'list' && layout === 'board'}
          onClick={onBoard}
        >
          <Icon name="board" size={18} />
          Доска
        </button>
        <button type="button" aria-pressed={mode === 'calendar'} onClick={onCalendar}>
          <Icon name="calendar" size={17} />
          Календарь
        </button>
        <button type="button" onClick={onFocus}>
          <Icon name="timer" size={18} />
          Фокус
        </button>
        <button type="button" onClick={onSettings}>
          <Icon name="settings" size={18} />
          Настройки
        </button>
      </nav>
      <div className="mobile-project-controls">
        <label className="mobile-project-picker">
          <Icon name="folder" size={15} />
          <span className="sr-only">Открыть проект</span>
          <select
            aria-label="Открыть проект"
            value={projectId ?? ''}
            onChange={(event) =>
              event.target.value ? onProject(event.target.value) : onView('focus')
            }
          >
            <option value="">Моё пространство</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label="Открыть библиотеку файлов"
          onClick={onFiles}
        >
          <Icon name="paperclip" size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Создать проект с телефона"
          onClick={onAddProject}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </>
  );
}
