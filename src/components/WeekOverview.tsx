import { addDays, formatDay } from '../domain/calendar.ts';
import { taskWord } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';

export function WeekOverview({
  tasks,
  today,
  onSelect,
}: {
  tasks: readonly Task[];
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <section className="week-overview" aria-label="Нагрузка на ближайшие 7 дней">
      <h3>Ближайшая неделя</h3>
      <div>
        {Array.from({ length: 7 }, (_, index) => {
          const date = addDays(today, index);
          const count = tasks.filter((task) => !task.completed && task.dueDate === date).length;
          const weekday = new Intl.DateTimeFormat('ru', {
            weekday: 'short',
            timeZone: 'UTC',
          }).format(new Date(`${date}T12:00:00Z`));
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={`${formatDay(date)}. ${count} ${taskWord(count)} в работе`}
            >
              <span>{index === 0 ? 'Сегодня' : weekday}</span>
              <strong>{Number(date.slice(8))}</strong>
              <small>{count ? `• ${count}` : '—'}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
