import type { ReactNode } from 'react';
import type { Task, TaskStatus } from '../domain/tasks.ts';
import { taskStatus } from '../domain/tasks.ts';

export function TaskBoard({
  tasks,
  renderTask,
  onStatus,
  busy,
}: {
  tasks: readonly Task[];
  renderTask: (task: Task) => ReactNode;
  onStatus: (id: string, status: TaskStatus) => void;
  busy: boolean;
}) {
  return (
    <div
      className="task-board"
      onDragStart={(event) => {
        const item = (event.target as HTMLElement).closest<HTMLElement>('[data-task-id]');
        if (busy || !item || !tasks.some((task) => task.id === item.dataset.taskId)) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-focus-task', item.dataset.taskId!);
      }}
    >
      {(['todo', 'doing', 'done'] as const).map((status) => {
        const rows = tasks.filter((task) => taskStatus(task) === status);
        return (
          <section
            className={`board-column board-column--${status}`}
            key={status}
            aria-label={{ todo: 'Запланировано', doing: 'В процессе', done: 'Готово' }[status]}
            onDragOver={(event) => {
              if (!busy && event.dataTransfer.types.includes('application/x-focus-task')) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData('application/x-focus-task');
              if (!busy && tasks.some((task) => task.id === id)) onStatus(id, status);
            }}
          >
            <header>
              <h3>{{ todo: 'Запланировано', doing: 'В процессе', done: 'Готово' }[status]}</h3>
              <span>{rows.length}</span>
            </header>
            <ul className="task-list">{rows.map(renderTask)}</ul>
            {!rows.length && <p className="board-empty">Пока пусто</p>}
          </section>
        );
      })}
    </div>
  );
}
