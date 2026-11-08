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
  const completed = planned.filter((task) => task.completed).length;
  const remaining = planned.length - completed;
  const completion = planned.length ? Math.round((completed / planned.length) * 100) : 0;
  const actions = (
    [
      { view: 'overdue', label: 'Просрочено', description: 'требует решения', icon: 'calendar' },
      {
        view: 'upcoming',
        label: 'Ближайшие планы',
        description: 'на этой неделе',
        icon: 'calendar',
      },
      { view: 'inbox', label: 'Входящие', description: 'разобрать позже', icon: 'inbox' },
    ] as const
  ).map((action) => ({
    ...action,
    count: tasks.filter((task) => matchesView(task, action.view, today)).length,
  }));
  return (
    <section className="overview-dashboard" aria-labelledby="overview-title">
      <header className="overview-dashboard__header">
        <div className="overview-dashboard__copy">
          <div className="overview-dashboard__eyebrow">
            <Icon name="sun" size={15} />
            <span>МОЙ ДЕНЬ</span>
          </div>
          <time className="overview-dashboard__date" dateTime={today}>
            {formatDay(today)}
          </time>
          <h1 id="overview-title">План на сегодня</h1>
          <p>
            {planned.length
              ? remaining
                ? `Осталось ${remaining} из ${planned.length} в плане.`
                : 'План на сегодня завершён.'
              : tasks.length
                ? 'Выбери главное из уже сохранённых задач.'
                : 'Добавь первую задачу ниже.'}
          </p>
        </div>
        <div className="overview-dashboard__progress" aria-label="Прогресс плана на день">
          <div className="overview-dashboard__progress-heading">
            <span className="overview-dashboard__progress-icon">
              <Icon name="check" size={16} />
            </span>
            <span>
              <strong>
                {completed}
                <small> / {planned.length}</small>
              </strong>
              <em>{completion}% выполнено</em>
            </span>
          </div>
          <progress
            value={completed}
            max={planned.length || 1}
            aria-label="Выполнено задач в плане"
          />
        </div>
        <figure className="overview-dashboard__art" aria-hidden="true">
          <img src="/images/focus-ledger.webp" width="640" height="640" alt="" decoding="async" />
        </figure>
      </header>
      <div className="overview-dashboard__actions" aria-label="Требующие внимания разделы">
        {actions.map((action) => (
          <button
            key={action.view}
            type="button"
            className={`overview-action overview-action--${action.view}`}
            onClick={() => onView(action.view)}
            aria-label={`${action.label}: ${action.count}. Открыть раздел.`}
          >
            <span className="overview-action__icon">
              <Icon name={action.icon} size={16} />
            </span>
            <span className="overview-action__copy">
              <small>{action.label}</small>
              <strong>{action.description}</strong>
            </span>
            <span className="overview-action__count">{action.count}</span>
            <Icon name="arrow" size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}
