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
  onCreate: () => void;
  onExamples: () => void;
  onStep: (id: string, stepId: string, completed: boolean) => void;
  busy: boolean;
  onComplete: (id: string) => void;
}) {
  const focus = queryTasks(tasks, 'focus', '', 'priority', today),
    next = focus[0];
  const steps = next?.steps?.filter((step) => !step.completed).slice(0, 2) ?? [];
  const planned = tasks.filter((task) => task.focusDate === today || task.dueDate === today),
    done = planned.filter((task) => task.completed).length;
  const statuses = [
    {
      view: 'overdue' as const,
      label: 'Требуют внимания',
      hint: 'просрочено',
      icon: 'calendar' as const,
    },
    {
      view: 'upcoming' as const,
      label: 'На этой неделе',
      hint: 'в плане',
      icon: 'calendar' as const,
    },
    { view: 'inbox' as const, label: 'Входящие', hint: 'без проекта', icon: 'inbox' as const },
  ];
  return (
    <section
      className={`day-overview${tasks.length ? '' : ' day-overview--empty'}`}
      aria-label="Обзор моего дня"
    >
      <header className="day-welcome">
        <div>
          <span className="welcome-date">{formatDay(today)}</span>
          <h1>
            Мой день<span className="title-dot">.</span>
          </h1>
          <p>Меньше шума. Больше сделанного.</p>
        </div>
        <div className="day-plan-progress">
          <span className="progress-check">
            <Icon name="check" size={19} />
          </span>
          <div>
            <strong>
              {done}
              <span> / {planned.length}</span>
            </strong>
            <small>готово из плана на сегодня</small>
          </div>
          <progress value={done} max={planned.length || 1} aria-label="Прогресс плана на день" />
        </div>
      </header>
      <div className="day-overview-grid">
        <article className="next-action-card">
          <div className="focus-card-top">
            <span>
              <Icon name="star" size={14} /> ПРИОРИТЕТ ДНЯ
            </span>
            <span>{projects.find((p) => p.id === next?.projectId)?.title ?? 'Входящие'}</span>
          </div>
          {next ? (
            <>
              <h2>{next.title}</h2>
              <p>{next.notes || 'Один понятный шаг — и дело сдвинется с места.'}</p>
              {!!steps.length && (
                <div className="focus-card-steps">
                  {steps.map((step) => (
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
                <span>
                  {next.steps?.length
                    ? `${next.steps.filter((s) => s.completed).length} из ${next.steps.length} шагов`
                    : `${focus.length} в фокусе`}
                </span>
                <div className="button-row">
                  {next.steps?.length && next.steps.every((s) => s.completed) && (
                    <button
                      type="button"
                      className="focus-complete"
                      disabled={busy}
                      onClick={() => onComplete(next.id)}
                    >
                      <Icon name="check" size={15} />
                      Завершить
                    </button>
                  )}
                  <button type="button" onClick={() => onTask(next)}>
                    Открыть задачу
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <>
              <h2>{tasks.length ? 'С чего начнёшь сегодня?' : 'Большие планы. Маленькие шаги.'}</h2>
              <p>
                {tasks.length
                  ? 'Отметь задачу звёздочкой, чтобы добавить её в свой день.'
                  : 'Создай первое дело, добавь детали и двигайся в своём темпе.'}
              </p>
              <footer>
                <button type="button" onClick={onCreate}>
                  Создать задачу
                  <Icon name="plus" size={16} />
                </button>
                {!tasks.length && (
                  <button type="button" className="demo-workspace" onClick={onExamples}>
                    Посмотреть пример
                  </button>
                )}
              </footer>
            </>
          )}
        </article>
        <div className="day-status-stack">
          {statuses.map((status) => (
            <button
              key={status.view}
              type="button"
              className={`day-status-card day-status-card--${status.view}`}
              onClick={() => onView(status.view)}
            >
              <span className="status-icon">
                <Icon name={status.icon} size={18} />
              </span>
              <span>
                <small>{status.label}</small>
                <strong>
                  {tasks.filter((t) => matchesView(t, status.view, today)).length}
                  <em>{status.hint}</em>
                </strong>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
