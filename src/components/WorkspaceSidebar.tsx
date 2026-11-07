import type { Project } from '../domain/projects.ts';
import type { Task } from '../domain/tasks.ts';
import type { TaskView } from '../domain/taskQueries.ts';
import { matchesView } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function WorkspaceSidebar({
  tasks,
  projects,
  today,
  mode,
  filter,
  projectId,
  onView,
  onCalendar,
  onProject,
  onManageProject,
  onFiles,
  fileCount,
}: {
  tasks: readonly Task[];
  projects: readonly Project[];
  today: string;
  mode: string;
  filter: TaskView;
  projectId: string | null;
  onView: (view: TaskView) => void;
  onCalendar: () => void;
  onProject: (id: string) => void;
  onManageProject: (project: Project | null) => void;
  onFiles: () => void;
  fileCount: number;
}) {
  const views: {
    id: TaskView;
    label: string;
    icon: 'sun' | 'inbox' | 'layers' | 'calendar' | 'check';
  }[] = [
    { id: 'focus', label: 'Мой день', icon: 'sun' },
    { id: 'inbox', label: 'Входящие', icon: 'inbox' },
    { id: 'all', label: 'Все задачи', icon: 'layers' },
    { id: 'upcoming', label: 'Ближайшая неделя', icon: 'calendar' },
    { id: 'completed', label: 'Завершённые', icon: 'check' },
  ];
  return (
    <aside className="sidebar workspace-sidebar">
      <a
        href="#list"
        className="brand"
        onClick={(event) => {
          event.preventDefault();
          onView('focus');
        }}
        aria-label="FOCUS — мой день"
      >
        <span className="brand-symbol">
          f<span />
        </span>
        <span>
          FOCUS<span className="brand-dot">.</span>
          <small>ЛИЧНОЕ ПРОСТРАНСТВО</small>
        </span>
      </a>
      <div className="sidebar-workspace">
        <span className="workspace-avatar">f.</span>
        <div>
          <strong>Моё пространство</strong>
          <small>Локально · без аккаунта</small>
        </div>
        <Icon name="shield" size={15} />
      </div>
      <nav className="sidebar-section" aria-label="Рабочее пространство">
        <span className="section-caption">ПЛАНИРОВАНИЕ</span>
        <div className="sidebar-filters">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`filter-button${mode === 'list' && !projectId && filter === view.id ? ' is-selected' : ''}`}
              aria-pressed={mode === 'list' && !projectId && filter === view.id}
              onClick={() => onView(view.id)}
            >
              <Icon name={view.icon} size={18} />
              <span>{view.label}</span>
              <span className="filter-count">
                {tasks.filter((task) => matchesView(task, view.id, today)).length}
              </span>
            </button>
          ))}
          <button
            type="button"
            className={`filter-button${mode === 'calendar' ? ' is-selected' : ''}`}
            aria-pressed={mode === 'calendar'}
            onClick={onCalendar}
          >
            <Icon name="calendar" size={18} />
            <span>Календарь</span>
          </button>
        </div>
        <button type="button" className="filter-button sidebar-files-button" onClick={onFiles}>
          <Icon name="paperclip" size={18} />
          <span>Файлы</span>
          <span className="filter-count">{fileCount}</span>
        </button>
      </nav>
      <section className="sidebar-projects" aria-labelledby="projects-label">
        <header>
          <span className="section-caption" id="projects-label">
            МОИ ПРОЕКТЫ
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onManageProject(null)}
            aria-label="Создать проект"
          >
            <Icon name="plus" size={16} />
          </button>
        </header>
        {projects.length ? (
          <div className="project-navigation">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-nav-row${projectId === project.id ? ' is-selected' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onProject(project.id)}
                  aria-pressed={projectId === project.id}
                >
                  <span className={`project-dot project-dot--${project.color}`} />
                  <span>{project.title}</span>
                  <small>
                    {
                      tasks.filter((task) => task.projectId === project.id && !task.completed)
                        .length
                    }
                  </small>
                </button>
                <button
                  type="button"
                  className="project-settings"
                  onClick={() => onManageProject(project)}
                  aria-label={`Настроить проект: ${project.title}`}
                >
                  <Icon name="edit" size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button type="button" className="new-project-hint" onClick={() => onManageProject(null)}>
            <Icon name="folder" size={20} />
            <span>
              Раздели работу и личные дела<small>Создать первый проект</small>
            </span>
          </button>
        )}
      </section>
      <div className="sidebar-bottom">
        <div className="local-note">
          <Icon name="shield" size={16} />
          <span>
            Твои задачи — только у тебя.
            <br />
            Сохраняй резервные копии.
          </span>
        </div>
        <a className="maker" href="https://almistech.ru" target="_blank" rel="noopener noreferrer">
          MADE BY ALMIS <Icon name="arrow" size={13} />
        </a>
      </div>
    </aside>
  );
}
