import type { ReactNode } from 'react';
import type { TaskView } from '../domain/taskQueries.ts';
import type { Preferences } from '../domain/planner.ts';
import { Icon } from './Icon.tsx';

export function WorkspaceViewBar({
  mode,
  layout,
  filter,
  onChange,
  children,
  columns,
  onColumns,
}: {
  mode: 'list' | 'calendar';
  layout: Preferences['layout'];
  filter: TaskView;
  columns: 2 | 3;
  onColumns: (columns: 2 | 3) => void;
  onChange: (mode: 'list' | 'calendar', layout?: Preferences['layout']) => void;
  children: ReactNode;
}) {
  return (
    <div className="workspace-viewbar">
      <div className="view-switch" role="group" aria-label="Отображение задач">
        {(
          [
            ['list', 'Список', 'layers'],
            ['board', 'Доска', 'board'],
            ['cards', 'Карточки', 'grid'],
          ] as const
        ).map(([value, title, icon]) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === 'list' && layout === value}
            onClick={() => onChange('list', value)}
          >
            <Icon name={icon} size={15} />
            {title}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={mode === 'calendar'}
          onClick={() => onChange('calendar')}
        >
          <Icon name="calendar" size={15} />
          Календарь
        </button>
      </div>
      <select
        className="mobile-layout-picker"
        aria-label="Вид задач"
        value={mode === 'calendar' ? 'calendar' : layout}
        onChange={(e) => {
          const value = e.target.value;
          if (value === 'calendar') onChange('calendar');
          else onChange('list', value as Preferences['layout']);
        }}
      >
        <option value="list">Список</option>
        <option value="board">Доска</option>
        <option value="cards">Карточки</option>
        <option value="calendar">Календарь</option>
      </select>
      {children}
      {mode === 'list' && layout === 'cards' && (
        <div className="cards-columns" role="group" aria-label="Колонки карточек на компьютере">
          {([2, 3] as const).map((n) => (
            <button type="button" key={n} aria-pressed={columns === n} onClick={() => onColumns(n)}>
              {n} колонки
            </button>
          ))}
        </div>
      )}
      <span>
        {mode === 'calendar'
          ? 'Планируй по дням'
          : filter === 'upcoming'
            ? 'Сегодня и следующие шесть дней'
            : filter === 'undated'
              ? 'Выбери срок для этих задач'
              : 'Выбери удобный вид'}
      </span>
    </div>
  );
}
