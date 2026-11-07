import type { Project } from '../domain/projects.ts';
import type { TaskView } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function WorkspaceMobileNavigation({
  mode,
  filter,
  projectId,
  isHome,
  projects,
  onView,
  onCalendar,
  onProject,
  onFiles,
  onAddProject,
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
}) {
  return (
    <>
      <nav className="mobile-workspace-nav" aria-label="Мобильное рабочее пространство">
        <button type="button" aria-pressed={isHome} onClick={() => onView('focus')}>
          <Icon name="sun" size={17} />
          Мой день
        </button>
        <button
          type="button"
          aria-pressed={mode === 'list' && filter === 'inbox' && !projectId}
          onClick={() => onView('inbox')}
        >
          <Icon name="inbox" size={17} />
          Входящие
        </button>
        <button type="button" aria-pressed={mode === 'calendar'} onClick={onCalendar}>
          <Icon name="calendar" size={17} />
          Календарь
        </button>
        <button
          type="button"
          aria-pressed={mode === 'list' && filter === 'all' && !projectId}
          onClick={() => onView('all')}
        >
          <Icon name="layers" size={17} />
          Все задачи
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
