import { useState } from 'react';
import type { Task, TaskStatus } from '../domain/tasks.ts';
import { taskStatus } from '../domain/tasks.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { Icon } from './Icon.tsx';

export function TaskMoveDialog({
  task,
  onMove,
  onClose,
}: {
  task: Task;
  onMove: (id: string, status: TaskStatus) => Promise<boolean>;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <dialog
      ref={dialog}
      className="task-move-dialog"
      aria-labelledby="move-title"
      onKeyDown={trapTab}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="move-title">Переместить задачу</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть перемещение"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <p>{task.title}</p>
      <div className="move-options">
        {(['todo', 'doing', 'done'] as const).map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy || taskStatus(task) === status}
            onClick={async () => {
              setBusy(true);
              if (await onMove(task.id, status)) onClose();
              else {
                setError('Не удалось переместить. Проверь сохранение и повтори.');
                setBusy(false);
              }
            }}
          >
            <Icon name={status === 'done' ? 'check' : status === 'doing' ? 'timer' : 'circle'} />
            <span>{{ todo: 'Запланировано', doing: 'В процессе', done: 'Готово' }[status]}</span>
            {taskStatus(task) === status && <small>Сейчас здесь</small>}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="input-error">
          {error}
        </p>
      )}
    </dialog>
  );
}
