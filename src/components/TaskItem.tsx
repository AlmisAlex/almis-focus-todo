import type { Task } from '../domain/tasks.ts';
import { taskStatus } from '../domain/tasks.ts';
import type { TaskStatus } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import { formatDeadline } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function TaskItem({
  task,
  attachmentCount,
  projects,
  today,
  selecting,
  selected,
  revealed = false,
  busy,
  onSelect,
  onToggle,
  onDelete,
  onEdit,
  onOpen = onEdit,
  onFocusTask,
  onStep,
  onProject,
  onStatus,
  draggable = false,
}: {
  task: Task;
  attachmentCount: number;
  projects: readonly Project[];
  today: string;
  selecting: boolean;
  selected: boolean;
  revealed?: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onOpen?: (task: Task) => void;
  onFocusTask: (task: Task) => void;
  onStep: (id: string, stepId: string, completed: boolean) => void;
  onProject: (id: string) => void;
  onStatus: (id: string, status: TaskStatus) => void;
  draggable?: boolean;
}) {
  const overdue = !task.completed && !!task.dueDate && task.dueDate < today;
  const project = projects.find((item) => item.id === task.projectId);
  const steps = task.steps ?? [];
  const done = steps.filter((step) => step.completed).length;
  return (
    <li
      className={`task-item${task.completed ? ' task-item--completed' : ''}${selected ? ' task-item--selected' : ''}${revealed ? ' task-item--revealed' : ''}${task.priority === 'high' && !task.completed ? ' task-item--important' : ''}`}
      data-task-id={task.id}
      data-selecting={selecting}
      draggable={draggable && !busy}
    >
      <div className="task-row">
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
        <label className="task-check">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(task.id)}
            disabled={busy}
            aria-label={`${task.completed ? 'Вернуть в работу' : 'Завершить'}: ${task.title}`}
          />
          <Icon name="check" size={15} />
        </label>
        <div className="task-copy">
          <button
            type="button"
            className="task-open"
            onClick={() => onOpen(task)}
            aria-label={`Открыть задачу: ${task.title}`}
          >
            <span className="task-title">{task.title}</span>
          </button>
          {task.notes && <span className="task-note">{task.notes}</span>}
          <div className="task-meta">
            <label className="task-status-control">
              <span className="sr-only">Статус: {task.title}</span>
              <select
                aria-label={`Статус: ${task.title}`}
                value={taskStatus(task)}
                disabled={busy}
                onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)}
              >
                <option value="todo">Запланировано</option>
                <option value="doing">В процессе</option>
                <option value="done">Готово</option>
              </select>
            </label>
            {task.recurrence && (
              <span className="repeat-tag">
                ↻ {task.recurrence === 'daily' ? 'Каждый день' : 'Каждую неделю'}
              </span>
            )}
            {task.tags?.map((tag) => (
              <span className="task-tag" key={tag}>
                #{tag}
              </span>
            ))}
            {attachmentCount > 0 && (
              <span className="file-count-tag">
                <Icon name="paperclip" size={12} />
                Вложений: {attachmentCount}
              </span>
            )}
            {project ? (
              <button
                type="button"
                className="task-project-badge"
                onClick={() => onProject(project.id)}
              >
                <span className={`project-dot project-dot--${project.color}`} />
                {project.title}
              </button>
            ) : (
              <span className="task-inbox-badge">
                <Icon name="inbox" size={11} /> Входящие
              </span>
            )}
            {task.priority === 'high' && (
              <span className="priority-tag priority-tag--high">Высокий</span>
            )}
            {task.dueDate && (
              <span className={`due-tag${overdue ? ' due-tag--overdue' : ''}`}>
                <Icon name="calendar" size={12} />
                <time dateTime={task.dueDate}>
                  {overdue ? 'Просрочено · ' : task.dueDate === today ? 'Сегодня · ' : ''}
                  {formatDeadline(task.dueDate)}
                </time>
              </span>
            )}
            {task.focusDate === today && (
              <span className="focus-date-tag">
                <Icon name="star" size={10} /> Фокус дня
              </span>
            )}
          </div>
        </div>
        <div className="task-actions">
          {draggable && (
            <button
              type="button"
              className="icon-button task-drag-handle"
              data-task-drag-handle
              disabled={busy}
              aria-label={`Переместить: ${task.title}`}
              aria-describedby="board-drag-help"
              title="Потяни за значок или нажми, чтобы выбрать колонку"
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
          >
            <Icon name="star" size={17} />
          </button>
          <button
            className="icon-button task-edit-button"
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
      </div>
      {steps.length > 0 && (
        <details className="task-steps">
          <summary>
            <span>
              {done} из {steps.length} шагов
            </span>
            <progress value={done} max={steps.length} aria-label={`Шаги задачи ${task.title}`} />
            <span className="steps-expand">Шаги</span>
          </summary>
          <ul>
            {steps.map((step) => (
              <li key={step.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={step.completed}
                    disabled={busy}
                    onChange={() => onStep(task.id, step.id, !step.completed)}
                    aria-label={`Шаг: ${step.title}`}
                    data-step-id={step.id}
                    data-step-task={task.id}
                  />
                  <span>{step.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
