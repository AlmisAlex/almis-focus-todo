import type { Project } from '../domain/projects.ts';
import { taskWord } from '../domain/tasks.ts';
import { BulkSchedule } from './BulkSchedule.tsx';
import { Icon } from './Icon.tsx';

export function TaskSelectionBar({
  visibleCount,
  taskCount,
  clearableCount,
  selectedCount,
  allSelected,
  selecting,
  busy,
  projects,
  today,
  onSelectMode,
  onSelectAll,
  onClearCompleted,
  onComplete,
  onRemove,
  onSchedule,
  onMove,
}: {
  visibleCount: number;
  taskCount: number;
  clearableCount: number;
  selectedCount: number;
  allSelected: boolean;
  selecting: boolean;
  busy: boolean;
  projects: readonly Project[];
  today: string;
  onSelectMode: () => void;
  onSelectAll: () => void;
  onClearCompleted: () => void;
  onComplete: (completed: boolean) => void;
  onRemove: () => void;
  onSchedule: (date: string) => void;
  onMove: (project: string) => void;
}) {
  return (
    <>
      <div className="list-actions">
        <span aria-live="polite">
          {visibleCount} {taskWord(visibleCount)}
        </span>
        <div className="button-row">
          <button
            type="button"
            className="text-button"
            disabled={!taskCount || busy}
            aria-pressed={selecting}
            onClick={onSelectMode}
          >
            {selecting ? 'Закончить выбор' : 'Выбрать задачи'}
          </button>
          {clearableCount > 0 && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={onClearCompleted}
            >
              Убрать готовое
            </button>
          )}
        </div>
      </div>
      {selecting && (
        <div className="bulk-toolbar" role="group" aria-label="Действия с выбранными задачами">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              disabled={busy || !visibleCount}
              onChange={onSelectAll}
            />{' '}
            Все видимые
          </label>
          <span>Выбрано: {selectedCount}</span>
          <div className="button-row">
            <button
              type="button"
              disabled={busy || !selectedCount}
              onClick={() => onComplete(true)}
            >
              Выполнить
            </button>
            <button
              type="button"
              disabled={busy || !selectedCount}
              onClick={() => onComplete(false)}
            >
              В работу
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={busy || !selectedCount}
              onClick={onRemove}
            >
              Удалить
            </button>
          </div>
          <BulkSchedule today={today} disabled={busy || !selectedCount} onApply={onSchedule} />
          <label className="bulk-project-control">
            <Icon name="folder" size={15} />
            <select
              aria-label="Перенести выбранные задачи в проект"
              value=""
              disabled={busy || !selectedCount}
              onChange={(event) => {
                if (event.target.value)
                  onMove(event.target.value === 'inbox' ? '' : event.target.value.slice(2));
              }}
            >
              <option value="" disabled>
                Перенести в проект…
              </option>
              <option value="inbox">Входящие</option>
              {projects.map((project) => (
                <option key={project.id} value={`p:${project.id}`}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </>
  );
}
