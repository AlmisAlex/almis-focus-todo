import type { Task } from '../domain/tasks.ts';
import { matchesView } from '../domain/taskQueries.ts';
import { formatDay } from '../domain/calendar.ts';
import { Icon } from './Icon.tsx';

export function DayOverview({
  tasks,
  today,
  onView,
}: {
  tasks: readonly Task[];
  today: string;
  onView: (view: 'overdue' | 'inbox' | 'upcoming') => void;
}) {
  const planned = tasks.filter((task) => task.focusDate === today || task.dueDate === today);
  const done = planned.filter((task) => task.completed).length;
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
        <div className="day-welcome-copy">
          <span className="welcome-kicker">
            <Icon name="sun" size={16} /> ТВОЙ ЛИЧНЫЙ ПЛАН
          </span>
          <span className="welcome-date">{formatDay(today)}</span>
          <h1>
            Мой день<span className="title-dot">.</span>
          </h1>
          <p>
            Освободи место для важного.
            <br />
            Остальное разложим по шагам.
          </p>
        </div>
        <div className="day-art" aria-hidden="true">
          <span className="day-art-orbit" />
          <span className="day-art-sun" />
          <span className="day-art-sheet">
            <i />
            <i />
            <i />
            <b>
              <Icon name="check" size={22} />
            </b>
          </span>
          <span className="day-art-spark">
            <Icon name="spark" size={24} />
          </span>
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
            <small>сделано сегодня</small>
          </div>
          <progress value={done} max={planned.length || 1} aria-label="Прогресс плана на день" />
        </div>
      </header>
      {tasks.length > 0 && (
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
                  {tasks.filter((task) => matchesView(task, status.view, today)).length}
                  <em>{status.hint}</em>
                </strong>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
