import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBoardDrag } from '../hooks/useBoardDrag.ts';
import { TaskMoveDialog } from './TaskMoveDialog.tsx';
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
  onStatus: (id: string, status: TaskStatus) => Promise<boolean>;
  busy: boolean;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState('');
  const [column, setColumn] = useState<TaskStatus>('todo');
  const drag = useBoardDrag(
    board,
    busy,
    (id, status) => {
      void onStatus(id, status);
    },
    setMoving,
  );
  const movingTask = tasks.find((task) => task.id === moving);
  const draggedTask = tasks.find((task) => task.id === drag.activeId);
  return (
    <>
      <div className="board-column-tabs" role="group" aria-label="Колонки доски">
        {(['todo', 'doing', 'done'] as const).map((status) => (
          <button
            type="button"
            key={status}
            aria-pressed={column === status}
            onClick={() => {
              const target = board.current?.querySelector<HTMLElement>(
                `[data-board-status="${status}"]`,
              );
              if (target && board.current) {
                board.current.scrollTo({ left: target.offsetLeft, behavior: 'instant' });
                setColumn(status);
              }
            }}
          >
            {{ todo: 'План', doing: 'В работе', done: 'Готово' }[status]}{' '}
            <span>{tasks.filter((t) => taskStatus(t) === status).length}</span>
          </button>
        ))}
      </div>
      <p id="board-drag-help" className="board-help">
        Перетаскивай за ⋮⋮ или нажми на него, чтобы выбрать колонку.
      </p>
      <div
        ref={board}
        className="task-board"
        onScroll={() => {
          const element = board.current;
          if (!element) return;
          const columns = [...element.querySelectorAll<HTMLElement>('[data-board-status]')];
          const nearest = columns.sort(
            (a, b) =>
              Math.abs(a.offsetLeft - element.scrollLeft) -
              Math.abs(b.offsetLeft - element.scrollLeft),
          )[0];
          if (nearest) setColumn(nearest.dataset.boardStatus as TaskStatus);
        }}
        data-dragging={!!drag.activeId}
        onPointerDown={drag.down}
        onPointerMove={drag.move}
        onPointerUp={drag.up}
        onPointerCancel={drag.cancel}
        onLostPointerCapture={drag.cancel}
        onClick={(event) => {
          const handle = (event.target as HTMLElement).closest('[data-task-drag-handle]');
          if (!handle) return;
          if (event.detail !== 0 && drag.suppressClick.current) {
            drag.suppressClick.current = false;
            return;
          }
          const id = handle.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
          if (id) setMoving(id);
        }}
        onDragStart={(event) => {
          const item = (event.target as HTMLElement).closest<HTMLElement>('[data-task-id]');
          if (
            (event.target as HTMLElement).closest('[data-task-drag-handle]') ||
            busy ||
            !item ||
            !tasks.some((task) => task.id === item.dataset.taskId)
          ) {
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
              data-board-status={status}
              data-drop-active={drag.over === status}
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
      {draggedTask &&
        createPortal(
          <div ref={drag.overlay} className="board-drag-preview">
            <strong>{draggedTask.title}</strong>
            <small>Отпусти над нужной колонкой</small>
          </div>,
          document.body,
        )}
      {movingTask && (
        <TaskMoveDialog task={movingTask} onMove={onStatus} onClose={() => setMoving('')} />
      )}
    </>
  );
}
