import type { Project } from '../domain/projects.ts';
import type { Task } from '../domain/tasks.ts';
import { matchesView, queryTasks } from '../domain/taskQueries.ts';
import { formatDay } from '../domain/calendar.ts';
import { Icon } from './Icon.tsx';

export function DayOverview({
  tasks,
  projects,
  today,
  onTask,
  onView,
  onProject,
  onCreate,
  onExamples,
  onStep,
  busy,
  onComplete,
}: {
  tasks: readonly Task[];
  projects: readonly Project[];
  today: string;
  onTask: (task: Task) => void;
  onView: (view: 'overdue' | 'inbox' | 'upcoming') => void;
  onProject: (id: string) => void;
  onCreate: () => void;
  onExamples: () => void;
  onStep: (id: string, stepId: string, completed: boolean) => void;
  busy: boolean;
  onComplete: (id: string) => void;
}) {
  const focus = queryTasks(tasks, 'focus', '', 'priority', today);
  const next = focus[0];
  const unfinishedSteps = next?.steps?.filter((step) => !step.completed) ?? [];
  const visibleSteps = unfinishedSteps.length
    ? unfinishedSteps.slice(0, 2)
    : (next?.steps?.slice(-2) ?? []);
  const planned = tasks.filter(
    (task) =>
      task.focusDate === today ||
      task.dueDate === today ||
      (!task.completed && !!task.dueDate && task.dueDate < today),
  );
  const done = planned.filter((task) => task.completed).length;
  const overdue = tasks.filter((task) => matchesView(task, 'overdue', today)).length;
  const inbox = tasks.filter((task) => matchesView(task, 'inbox', today)).length;
  const upcoming = tasks.filter((task) => matchesView(task, 'upcoming', today)).length;
  const project = projects.find((item) => item.id === next?.projectId);
  return (
    <section className="day-overview" aria-label="Обзор моего дня">
      <header className="day-welcome">
        <div>
          <span className="welcome-date">{formatDay(today)}</span>
          <h1>
            Твой день.
            <br />
            <em>Начни с главного.</em>
          </h1>
          <p>Всё важное под рукой. Остальное подождёт своего времени.</p>
        </div>
        <div className="day-plan-progress">
          <Icon name="sun" size={20} />
          <strong>
            {done}
            <span> / {planned.length}</span>
          </strong>
          <small>готово в плане</small>
          <progress value={done} max={planned.length || 1} aria-label="Прогресс плана на день" />
        </div>
      </header>
      <div className="day-overview-grid">
        <article className="next-action-card">
          <div className="focus-card-top">
            <span>
              <Icon name="star" size={14} /> СЛЕДУЮЩИЙ ШАГ
            </span>
            <span>
              {next?.priority === 'high'
                ? 'Высокий приоритет'
                : next
                  ? 'В твоём фокусе'
                  : 'Свой темп'}
            </span>
          </div>
          {next ? (
            <>
              <span className="focus-project-name">{project?.title ?? 'Входящие'}</span>
              <h2>{next.title}</h2>
              <p>{next.notes || 'Один понятный шаг — и день уже движется вперёд.'}</p>
              {next.steps && next.steps.length > 0 && (
                <div className="focus-card-steps">
                  {visibleSteps.map((step) => (
                    <label key={step.id}>
                      <input
                        type="checkbox"
                        checked={step.completed}
                        disabled={busy}
                        data-step-id={step.id}
                        data-step-task={next.id}
                        aria-label={`Следующий шаг: ${step.title}`}
                        onChange={() => onStep(next.id, step.id, !step.completed)}
                      />
                      <span>{step.title}</span>
                    </label>
                  ))}
                </div>
              )}
              <footer>
                {next.steps?.length ? (
                  <span>
                    {next.steps.filter((step) => step.completed).length} из {next.steps.length}{' '}
                    шагов
                  </span>
                ) : (
                  <span>{focus.length} в фокусе</span>
                )}
                {next.steps?.length && next.steps.every((step) => step.completed) ? (
                  <button
                    type="button"
                    className="focus-complete"
                    disabled={busy}
                    onClick={() => onComplete(next.id)}
                  >
                    <Icon name="check" size={15} />
                    Завершить
                  </button>
                ) : null}
                <button type="button" onClick={() => onTask(next)}>
                  Открыть задачу <Icon name="arrow" size={17} />
                </button>
              </footer>
            </>
          ) : (
            <>
              <h2>{tasks.length ? 'Что будет главным сегодня?' : 'Освободи место для важного.'}</h2>
              <p>
                {tasks.length
                  ? 'Добавь задачу в фокус звёздочкой — её настоящий срок останется прежним.'
                  : 'Собери дела по проектам, разбей на шаги и спланируй день в одном месте.'}
              </p>
              <footer>
                <button type="button" onClick={onCreate}>
                  Добавить главное дело <Icon name="plus" size={17} />
                </button>
                {!tasks.length && (
                  <button type="button" className="demo-workspace" onClick={onExamples}>
                    Посмотреть пример
                  </button>
                )}
              </footer>
            </>
          )}
          <img src="/images/focus-orbit.webp" alt="" width="840" height="840" />
        </article>
        <div className="day-status-stack">
          <button
            type="button"
            className="day-status-card day-status-card--overdue"
            onClick={() => onView('overdue')}
          >
            <span className="status-icon">
              <Icon name="calendar" size={18} />
            </span>
            <span>
              <small>Требуют внимания</small>
              <strong>
                {overdue}
                <em>просрочено</em>
              </strong>
            </span>
            <Icon name="arrow" size={15} />
          </button>
          <button type="button" className="day-status-card" onClick={() => onView('upcoming')}>
            <span className="status-icon">
              <Icon name="calendar" size={18} />
            </span>
            <span>
              <small>Ближайшая неделя</small>
              <strong>
                {upcoming}
                <em>задач в плане</em>
              </strong>
            </span>
            <Icon name="arrow" size={15} />
          </button>
          <button type="button" className="day-status-card" onClick={() => onView('inbox')}>
            <span className="status-icon">
              <Icon name="inbox" size={18} />
            </span>
            <span>
              <small>Разобрать входящие</small>
              <strong>
                {inbox}
                <em>без проекта</em>
              </strong>
            </span>
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </div>
      {projects.length > 0 && (
        <div className="day-project-overview">
          <header>
            <h2>Проекты под контролем</h2>
            <span>Продолжи с того, что важно</span>
          </header>
          <div>
            {projects.slice(0, 4).map((project) => {
              const items = tasks.filter((task) => task.projectId === project.id),
                ready = items.filter((task) => task.completed).length;
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`project-overview-card project-overview-card--${project.color}`}
                  onClick={() => onProject(project.id)}
                >
                  <span className="project-overview-icon">
                    <Icon name="folder" size={18} />
                    <span>
                      {ready} / {items.length}
                    </span>
                  </span>
                  <strong>{project.title}</strong>
                  <progress
                    value={ready}
                    max={items.length || 1}
                    aria-label={`Прогресс проекта ${project.title}`}
                  />
                  <small>
                    {items.length - ready} в работе <Icon name="arrow" size={13} />
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
