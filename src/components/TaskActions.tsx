import type { Task } from '../domain/tasks.ts';
import { Icon } from './Icon.tsx';

export function TaskActions({
  task,
  today,
  busy,
  draggable,
  card,
  onFocusTask,
  onEdit,
  onDelete,
}: {
  task: Task;
  today: string;
  busy: boolean;
  draggable: boolean;
  card: boolean;
  onFocusTask: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <div
      className={`task-actions${card ? ' task-card-actions' : ''}`}
      data-movable={draggable}
      role="group"
      aria-label={`Действия: ${task.title}`}
    >
      {draggable && (
        <button
          type="button"
          className="icon-button task-drag-handle"
          data-task-drag-handle
          disabled={busy}
          aria-label={`Переместить: ${task.title}`}
          aria-describedby="board-drag-help"
          title="Потяни или нажми, чтобы выбрать колонку"
        >
          <Icon name="grip" size={18} />
        </button>
      )}
      <button
        type="button"
        className={`icon-button focus-task-button${task.focusDate === today ? ' is-focused' : ''}`}
        disabled={busy || task.completed}
        aria-pressed={task.focusDate === today}
        onClick={() => onFocusTask(task)}
        aria-label={`${task.focusDate === today ? 'Убрать из фокуса' : 'В фокус на сегодня'}: ${task.title}`}
        title={task.focusDate === today ? 'Убрать из моего дня' : 'В мой день'}
      >
        <Icon name="star" size={17} />
        <span className="task-action-label">Мой день</span>
      </button>
      <button
        type="button"
        className="icon-button task-edit-button"
        onClick={() => onEdit(task)}
        disabled={busy}
        aria-label={`Изменить: ${task.title}`}
        title="Изменить задачу"
      >
        <Icon name="edit" size={17} />
        <span className="task-action-label">Изменить</span>
      </button>
      <button
        type="button"
        className="icon-button delete-button"
        onClick={() => onDelete(task)}
        disabled={busy}
        aria-label={`Удалить: ${task.title}`}
        title="Удалить задачу"
      >
        <Icon name="trash" size={17} />
      </button>
    </div>
  );
}
