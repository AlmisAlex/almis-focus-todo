import type { ReactNode } from 'react';
import type { TaskView } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function WorkspaceViewBar({
  mode,
  layout,
  filter,
  onChange,
  children,
}: {
  mode: 'list' | 'calendar';
  layout: 'list' | 'board';
  filter: TaskView;
  onChange: (mode: 'list' | 'calendar', layout?: 'list' | 'board') => void;
  children: ReactNode;
}) {
  return (
    <div className="workspace-viewbar">
      <div className="view-switch" role="group" aria-label="Отображение задач">
        <button
          type="button"
          aria-pressed={mode === 'list' && layout === 'list'}
          onClick={() => onChange('list', 'list')}
        >
          <Icon name="layers" size={15} />
          Список
        </button>
        <button
          type="button"
          aria-pressed={mode === 'list' && layout === 'board'}
          onClick={() => onChange('list', 'board')}
        >
          <Icon name="layers" size={15} /> Доска
        </button>
        <button
          type="button"
          aria-pressed={mode === 'calendar'}
          onClick={() => onChange('calendar')}
        >
          <Icon name="calendar" size={15} />
          Календарь
        </button>
      </div>
      {children}
      <span>
        {mode === 'calendar'
          ? 'Планируй по дням и оценивай нагрузку'
          : filter === 'upcoming'
            ? 'Сегодня и следующие шесть дней'
            : filter === 'undated'
              ? 'Задачи, которым ещё нужно выбрать срок'
              : 'Все дела в удобном представлении'}
      </span>
    </div>
  );
}
