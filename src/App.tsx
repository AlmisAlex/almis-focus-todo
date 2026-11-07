import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_TITLE_LENGTH, selectTasks, TaskInputError, taskWord } from './domain/tasks.ts';
import type { Task, TaskFilter } from './domain/tasks.ts';
import { useTasks } from './hooks/useTasks.ts';
import { Icon } from './components/Icon.tsx';
import { TaskItem } from './components/TaskItem.tsx';

const filters: { id: TaskFilter; label: string; icon: 'layers' | 'circle' | 'check' }[] = [
  { id: 'all', label: 'Все задачи', icon: 'layers' },
  { id: 'active', label: 'В работе', icon: 'circle' },
  { id: 'completed', label: 'Готово', icon: 'check' },
];

export default function App() {
  const model = useTasks();
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [undoTasks, setUndoTasks] = useState<readonly Task[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const completed = model.tasks.filter((task) => task.completed).length;
  const active = model.tasks.length - completed;
  const counts = { all: model.tasks.length, active, completed };
  const visible = useMemo(
    () => selectTasks(model.tasks, filter, query),
    [model.tasks, filter, query],
  );
  const progress = model.tasks.length ? Math.round((completed / model.tasks.length) * 100) : 0;
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const choices = list.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const target = choices?.[Math.min(pendingFocus.current, (choices?.length ?? 1) - 1)];
    (target ?? input.current)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [visible]);
  const date = new Intl.DateTimeFormat('ru', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const focusComposer = () => {
    input.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    input.current?.focus();
  };

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        input.current?.focus();
      } else if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const reportError = (caught: unknown) => {
    setError(
      caught instanceof TaskInputError
        ? caught.message
        : 'Не удалось изменить задачу. Попробуйте ещё раз.',
    );
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (model.isWorking) return;
    try {
      await model.add(title);
      setTitle('');
      setError('');
      setFilter('all');
      setQuery('');
      setUndoTasks([]);
      setNotice('Задача добавлена.');
      input.current?.focus();
    } catch (caught) {
      reportError(caught);
    }
  };

  const toggle = async (id: string) => {
    try {
      const task = model.tasks.find((item) => item.id === id);
      if (filter !== 'all')
        pendingFocus.current = Math.max(
          0,
          visible.findIndex((item) => item.id === id),
        );
      await model.toggle(id);
      setError('');
      setNotice(task?.completed ? 'Задача снова в работе.' : 'Ещё одна задача готова.');
      setUndoTasks([]);
    } catch (caught) {
      reportError(caught);
    }
  };

  const remove = async (task: Task) => {
    try {
      await model.remove(task.id);
      setUndoTasks([task]);
      setNotice('Задача удалена.');
      setError('');
      input.current?.focus();
    } catch (caught) {
      reportError(caught);
    }
  };

  const clearCompleted = async () => {
    try {
      const removed = model.tasks.filter((task) => task.completed);
      await model.clearCompleted();
      setUndoTasks(removed);
      setNotice(`Удалено: ${removed.length}.`);
      setError('');
    } catch (caught) {
      reportError(caught);
    }
  };

  const undo = async () => {
    try {
      await model.restore(undoTasks);
      setUndoTasks([]);
      setNotice('Задачи восстановлены.');
      setError('');
    } catch (caught) {
      reportError(caught);
    }
  };

  const filterButtons = (mobile = false) => (
    <div className={mobile ? 'mobile-filters' : 'sidebar-filters'} aria-label="Фильтр задач">
      {filters.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`filter-button${filter === item.id ? ' is-selected' : ''}`}
          aria-pressed={filter === item.id}
          aria-controls="task-list"
          onClick={() => setFilter(item.id)}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
          <span className="filter-count">{counts[item.id]}</span>
        </button>
      ))}
    </div>
  );

  const isSearching = query.trim().length > 0;
  const emptyTitle = isSearching
    ? 'Пока без совпадений.'
    : filter === 'completed'
      ? 'Здесь будут твои победы.'
      : model.tasks.length
        ? 'Важное уже сделано.'
        : 'Большое начинается с малого.';
  const emptyText = isSearching
    ? 'Попробуй другое слово или сбрось поиск.'
    : filter === 'completed'
      ? 'Отметь первую задачу — и она появится здесь.'
      : model.tasks.length
        ? 'Можно выдохнуть. Или задумать что-то новое.'
        : 'Добавь первую задачу. Одного шага уже достаточно.';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        К задачам
      </a>
      <aside className="sidebar">
        <a href="#main" className="brand" aria-label="FOCUS — к задачам">
          <span className="brand-symbol">
            f<span />
          </span>
          <span>
            FOCUS<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-section">
          <span className="section-caption">ТВОЁ ПРОСТРАНСТВО</span>
          {filterButtons()}
        </div>
        <div className="sidebar-bottom">
          <div className="progress-card">
            <span className="progress-caption">
              <Icon name="spark" size={16} /> Твой ритм
            </span>
            <div className="progress-number">
              {progress}
              <span>%</span>
            </div>
            <progress
              value={completed}
              max={model.tasks.length || 1}
              aria-label="Прогресс выполнения задач"
            />
            <span className="progress-detail">
              {completed} из {model.tasks.length} выполнено
            </span>
            <p>
              {progress === 100 && model.tasks.length
                ? 'Отличный ритм. Так держать.'
                : 'Даже маленький шаг — уже движение.'}
            </p>
          </div>
          <div className="local-note">
            <Icon name="shield" size={16} />
            <span>
              Твои задачи.
              <br />
              Только в этом браузере.
            </span>
          </div>
          <a
            className="maker"
            href="https://almistech.ru"
            target="_blank"
            rel="noopener noreferrer"
          >
            MADE BY ALMIS <Icon name="arrow" size={13} />
          </a>
        </div>
      </aside>

      <main id="main" className="main-content" tabIndex={-1}>
        <header className="topbar">
          <span className="workspace-label">
            Личное <span>/</span> Мой фокус
          </span>
          <div className="topbar-right">
            <time className="today">{date}</time>
            <span
              className={`save-status${model.status !== 'saved' ? ' save-status--warning' : ''}`}
            >
              <span />
              {model.isWorking
                ? 'Сохраняем'
                : model.status === 'saved'
                  ? 'Всё сохранено'
                  : 'Есть несохранённое'}
            </span>
          </div>
        </header>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> СВОЙ ТЕМП. ЧЁТКИЙ ФОКУС.
            </div>
            <h1 id="hero-title">
              Делай
              <br />
              <span>важное.</span>
            </h1>
            <p>
              Меньше шума в голове.
              <br />
              Больше места для твоих идей.
            </p>
            <button className="hero-action" type="button" onClick={focusComposer}>
              С чего начнём? <Icon name="arrow" size={18} />
            </button>
          </div>
          <img
            className="hero-art"
            src="/images/focus-orbit.webp"
            alt=""
            width="840"
            height="840"
            fetchPriority="high"
          />
          <div className="hero-stamp" aria-hidden="true">
            <Icon name="spark" size={17} />
            <span>
              ONE THING
              <br />
              AT A TIME.
            </span>
          </div>
          <span className="hero-index" aria-hidden="true">
            01 / FOCUS MODE
          </span>
        </section>

        <section className="tasks-section" aria-labelledby="tasks-title">
          <div className="section-heading">
            <div>
              <span className="section-caption">ОТ ПЛАНОВ К ДЕЛУ</span>
              <h2 id="tasks-title">
                Мой фокус <span className="active-pill">{active} в работе</span>
              </h2>
            </div>
            <span className="task-total">
              {model.tasks.length} {taskWord(model.tasks.length)}
            </span>
          </div>
          <form className="composer" onSubmit={add}>
            <span className="composer-plus" aria-hidden="true">
              <Icon name="plus" size={22} />
            </span>
            <label className="sr-only" htmlFor="new-task">
              Новая задача
            </label>
            <input
              id="new-task"
              ref={input}
              type="text"
              autoComplete="off"
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder="Что сделаем дальше?"
              aria-describedby="composer-hint"
            />
            <button
              className="primary-button"
              type="submit"
              disabled={!title.trim() || model.isWorking}
            >
              <span>Добавить</span>
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <div className="composer-hint" id="composer-hint">
            <span>
              <kbd>Enter</kbd> добавить задачу <span className="hint-separator">·</span>{' '}
              <kbd>N</kbd> быстрый ввод
            </span>
            <span>
              {title.length > 140 ? `${title.length}/${MAX_TITLE_LENGTH}` : 'Один шаг ближе.'}
            </span>
          </div>
          {error && (
            <p className="input-error" role="alert">
              {error}
            </p>
          )}

          {model.status !== 'saved' && (
            <div className="storage-warning" role="alert">
              <div>
                <strong>
                  {model.status === 'corrupt'
                    ? 'Сохранённый список не удалось прочитать.'
                    : model.status === 'conflict'
                      ? 'Объединённый список переполнен.'
                      : 'Сейчас задачи остаются только в этой вкладке.'}
                </strong>
                <p>
                  {model.status === 'corrupt'
                    ? 'Исходные данные не изменены. При восстановлении сначала сохраним резервную копию.'
                    : model.status === 'conflict'
                      ? 'Изменения другой вкладки сохранены. Удали ненужные задачи из текущего списка и повтори сохранение.'
                      : 'Проверь свободное место и настройки. Для безопасного сохранения нужен современный браузер с поддержкой Web Locks.'}
                </p>
              </div>
              <button
                type="button"
                disabled={model.isWorking}
                onClick={async () => {
                  const ok = await model.retrySave();
                  setNotice(
                    ok
                      ? 'Сохранение работает. Список сохранён.'
                      : 'Сохранить пока не получилось. Задачи остаются в этой вкладке.',
                  );
                }}
              >
                {model.status === 'corrupt' ? 'Восстановить сохранение' : 'Повторить'}
              </button>
            </div>
          )}

          <div className="list-toolbar">
            {filterButtons(true)}
            <div className="search-field">
              <Icon name="search" size={17} />
              <label className="sr-only" htmlFor="task-search">
                Поиск задач
              </label>
              <input
                id="task-search"
                ref={search}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти задачу"
                autoComplete="off"
              />
              {query && (
                <button
                  className="search-clear"
                  type="button"
                  aria-label="Очистить поиск"
                  onClick={() => {
                    setQuery('');
                    search.current?.focus();
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
              <kbd>/</kbd>
            </div>
            {completed > 0 && (
              <button type="button" className="clear-completed" onClick={clearCompleted}>
                <Icon name="trash" size={14} /> Убрать готовое
              </button>
            )}
          </div>

          <div id="task-list" className="task-list-container" ref={list}>
            {visible.length > 0 ? (
              <ul className="task-list" aria-label="Список задач">
                {visible.map((task) => (
                  <TaskItem key={task.id} task={task} onToggle={toggle} onDelete={remove} />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <div className="empty-orbit" aria-hidden="true">
                  <span />
                  <Icon name="spark" size={24} />
                </div>
                <h3>{emptyTitle}</h3>
                <p>{emptyText}</p>
                {isSearching ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    Сбросить поиск <Icon name="arrow" size={15} />
                  </button>
                ) : (
                  filter !== 'completed' && (
                    <button type="button" className="text-button" onClick={focusComposer}>
                      Добавить задачу <Icon name="plus" size={16} />
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </section>
        <footer className="app-footer">
          <span>
            <span className="footer-mark" /> Без спешки. По существу.
          </span>
          <a
            href="https://github.com/AlmisAlex/almis-focus-todo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="github" size={15} /> Исходный код
          </a>
        </footer>
      </main>
      {notice && (
        <div className="toast">
          <span role="status">{notice}</span>
          {undoTasks.length > 0 && (
            <button type="button" onClick={undo}>
              <Icon name="undo" size={15} /> Отменить
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="Закрыть уведомление"
            onClick={() => {
              setNotice('');
              setUndoTasks([]);
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
