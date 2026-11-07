import type { Task } from '../domain/tasks.ts';
import { Icon } from './Icon.tsx';

const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });

export function TaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <li className={`task-item${task.completed ? ' task-item--completed' : ''}`}>
      <label className="task-main">
        <span className="task-check">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(task.id)}
            aria-label={`${task.completed ? 'Вернуть в работу' : 'Завершить'}: ${task.title}`}
          />
          <Icon name="check" size={15} />
        </span>
        <span className="task-copy">
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            <span className={`status-dot${task.completed ? ' status-dot--done' : ''}`} />
            {task.completed ? 'Готово' : 'В работе'}
            <span className="meta-divider">/</span>
            <time dateTime={new Date(task.createdAt).toISOString()}>
              {dateFormat.format(task.createdAt)}
            </time>
          </span>
        </span>
      </label>
      <button
        className="icon-button delete-button"
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Удалить: ${task.title}`}
        title="Удалить задачу"
      >
        <Icon name="trash" size={18} />
      </button>
    </li>
  );
}
