import { useEffect, useId, useState } from 'react';
import type { Task } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import { commandSearch } from '../domain/commandSearch.ts';
import type { CommandResult } from '../domain/commandSearch.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { Icon } from './Icon.tsx';

export function CommandPalette({
  tasks,
  projects,
  today,
  onPick,
  onClose,
}: {
  tasks: readonly Task[];
  projects: readonly Project[];
  today: string;
  onPick: (result: CommandResult) => void;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = commandSearch(tasks, projects, query, today);
  const index = Math.min(active, results.length - 1);
  const activeId = index >= 0 ? `${listId}-${index}` : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);
  return (
    <dialog
      ref={dialog}
      className="command-dialog"
      aria-label="Поиск по всему пространству"
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="command-search-field">
        <Icon name="search" size={22} />
        <input
          data-dialog-autofocus
          type="text"
          role="combobox"
          aria-label="Найти задачу, проект или раздел"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={activeId}
          autoComplete="off"
          value={query}
          placeholder="Куда отправимся?"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (results.length)
                setActive(
                  (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length,
                );
            }
            if (event.key === 'Enter' && results[index]) {
              event.preventDefault();
              onPick(results[index]);
            }
          }}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть общий поиск"
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="command-context">Задачи, проекты и быстрые переходы · всё локально</div>
      <div id={listId} className="command-results" role="listbox" aria-label="Результаты поиска">
        {results.map((result, i) => (
          <button
            key={result.key}
            id={`${listId}-${i}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={i === index}
            className="command-result"
            onPointerMove={() => setActive(i)}
            onClick={() => onPick(result)}
          >
            <span
              className={`command-result-icon${result.kind === 'task' && result.task.completed ? ' is-complete' : ''}`}
            >
              <Icon
                name={
                  result.kind === 'project'
                    ? 'folder'
                    : result.kind === 'create'
                      ? 'plus'
                      : result.kind === 'calendar'
                        ? 'calendar'
                        : result.kind === 'task'
                          ? result.task.completed
                            ? 'check'
                            : 'circle'
                          : 'layers'
                }
                size={18}
              />
            </span>
            <span className="command-result-copy">
              <strong>{result.label}</strong>
              <small>
                {result.kind === 'task'
                  ? `${projects.find((project) => project.id === result.task.projectId)?.title ?? 'Входящие'} · ${result.task.completed ? 'Завершена' : 'В работе'}`
                  : result.kind === 'project'
                    ? 'Проект'
                    : 'Быстрый переход'}
              </small>
            </span>
            <span className="command-result-enter" aria-hidden="true">
              ↵
            </span>
          </button>
        ))}
      </div>
      {!results.length && (
        <p className="command-empty" role="status">
          Ничего не нашлось. Попробуй название, заметку или текст шага.
        </p>
      )}
      <footer>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> выбрать <kbd>Enter</kbd> открыть
        </span>
        <span>
          <kbd>Esc</kbd> закрыть
        </span>
      </footer>
    </dialog>
  );
}
