import type { Task } from '../domain/tasks.ts';
import { formatDeadline } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function TaskItem({
  task,
  today,
  selecting,
  selected,
  busy,
  onSelect,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  today: string;
  selecting: boolean;
  selected: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const overdue = !task.completed && !!task.dueDate && task.dueDate < today;
  return (
    <li
      className={`task-item${task.completed ? ' task-item--completed' : ''}${selected ? ' task-item--selected' : ''}`}
      data-task-id={task.id}
    >
      {selecting && (
        <input
          className="selection-check"
          type="checkbox"
          aria-label={`Выбрать: ${task.title}`}
          checked={selected}
          onChange={() => onSelect(task.id)}
          disabled={busy}
        />
      )}
      <label className="task-main">
        <span className="task-check">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(task.id)}
            disabled={busy}
            aria-label={`${task.completed ? 'Вернуть в работу' : 'Завершить'}: ${task.title}`}
          />
          <Icon name="check" size={15} />
        </span>
        <span className="task-copy">
          <span className="task-title">{task.title}</span>
          {task.notes && <span className="task-note">{task.notes}</span>}
          <span className="task-meta">
            <span className={`status-dot${task.completed ? ' status-dot--done' : ''}`} />
            {task.completed ? 'Готово' : 'В работе'}
            {task.priority === 'high' && (
              <span className="priority-tag priority-tag--high">Высокий приоритет</span>
            )}
            {task.priority === 'low' && <span className="priority-tag">Низкий приоритет</span>}
            {task.dueDate && (
              <span className={`due-tag${overdue ? ' due-tag--overdue' : ''}`}>
                <Icon name="calendar" size={12} />
                <time dateTime={task.dueDate}>
                  {overdue ? 'Просрочено · ' : task.dueDate === today ? 'Сегодня · ' : ''}
                  {formatDeadline(task.dueDate)}
                </time>
              </span>
            )}
          </span>
        </span>
      </label>
      <div className="task-actions">
        <button
          className="icon-button"
          type="button"
          onClick={() => onEdit(task)}
          disabled={busy}
          aria-label={`Изменить: ${task.title}`}
          title="Изменить задачу"
        >
          <Icon name="edit" size={17} />
        </button>
        <button
          className="icon-button delete-button"
          type="button"
          onClick={() => onDelete(task)}
          disabled={busy}
          aria-label={`Удалить: ${task.title}`}
          title="Удалить задачу"
        >
          <Icon name="trash" size={17} />
        </button>
      </div>
    </li>
  );
}
