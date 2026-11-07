import type { RefObject } from 'react';
import type { TaskSort } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function TaskFilters({
  query,
  sort,
  tag,
  status,
  tags,
  searchRef,
  onQuery,
  onSort,
  onTag,
  onStatus,
  onReset,
}: {
  query: string;
  sort: TaskSort;
  tag: string;
  status: string;
  tags: readonly string[];
  searchRef: RefObject<HTMLInputElement | null>;
  onQuery: (value: string) => void;
  onSort: (value: TaskSort) => void;
  onTag: (value: string) => void;
  onStatus: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <details className="task-filter-panel">
      <summary>
        <Icon name="search" size={14} /> Фильтры и поиск
        {(query || tag || status) && (
          <span className="filter-active-count">
            {Number(!!query) + Number(!!tag) + Number(!!status)}
          </span>
        )}
      </summary>
      <div className="task-filter-body">
        <div className="organization-filters" role="group" aria-label="Фильтры задач">
          <label>
            <span className="sr-only">Фильтр по статусу</span>
            <select
              aria-label="Фильтр по статусу"
              value={status}
              onChange={(event) => onStatus(event.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="todo">Запланировано</option>
              <option value="doing">В процессе</option>
              <option value="done">Готово</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Фильтр по метке</span>
            <select
              aria-label="Фильтр по метке"
              value={tags.includes(tag) ? tag : ''}
              onChange={(event) => onTag(event.target.value)}
            >
              <option value="">Все метки</option>
              {tags.map((value) => (
                <option key={value} value={value}>
                  #{value}
                </option>
              ))}
            </select>
          </label>
          {(tag || status) && (
            <button type="button" className="text-button" onClick={onReset}>
              Сбросить фильтры
            </button>
          )}
        </div>
        <div className="list-toolbar">
          <div className="search-field">
            <Icon name="search" size={17} />
            <label className="sr-only" htmlFor="task-search">
              Поиск задач
            </label>
            <input
              id="task-search"
              aria-keyshortcuts="Alt+/"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Поиск по задачам, заметкам и меткам"
              autoComplete="off"
            />
            {query && (
              <button
                className="search-clear"
                type="button"
                aria-label="Очистить поиск"
                onClick={() => {
                  onQuery('');
                  searchRef.current?.focus();
                }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <label className="sort-control">
            <span className="sr-only">Порядок задач</span>
            <select
              aria-label="Порядок задач"
              value={sort}
              onChange={(event) => onSort(event.target.value as TaskSort)}
            >
              <option value="newest">Новые</option>
              <option value="oldest">Старые</option>
              <option value="priority">Приоритет</option>
              <option value="due">Срок</option>
            </select>
          </label>
        </div>
      </div>
    </details>
  );
}
