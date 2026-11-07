import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MAX_TASKS, TaskInputError, taskWord } from './domain/tasks.ts';
import type { Task, TaskDetails } from './domain/tasks.ts';
import { localDate, matchesView, queryTasks } from './domain/taskQueries.ts';
import type { TaskSort, TaskView } from './domain/taskQueries.ts';
import { useTasks } from './hooks/useTasks.ts';
import { Icon } from './components/Icon.tsx';
import { TaskItem } from './components/TaskItem.tsx';
import { TaskEditor } from './components/TaskEditor.tsx';
import { TaskComposer } from './components/TaskComposer.tsx';
import { TaskBackup } from './components/TaskBackup.tsx';

const filters: { id: TaskView; label: string; icon: 'layers' | 'circle' | 'check' | 'calendar' }[] =
  [
    { id: 'all', label: 'Все задачи', icon: 'layers' },
    { id: 'active', label: 'В работе', icon: 'circle' },
    { id: 'today', label: 'Сегодня', icon: 'calendar' },
    { id: 'overdue', label: 'Просрочено', icon: 'calendar' },
    { id: 'completed', label: 'Готово', icon: 'check' },
  ];

export default function App() {
  const model = useTasks();
  const [filter, setFilter] = useState<TaskView>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TaskSort>('newest');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [undoTasks, setUndoTasks] = useState<readonly Task[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [today, setToday] = useState(localDate);
  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const completed = model.tasks.filter((task) => task.completed).length;
  const active = model.tasks.length - completed;
  const visible = useMemo(
    () => queryTasks(model.tasks, filter, query, sort, today),
    [model.tasks, filter, query, sort, today],
  );
  const counts = Object.fromEntries(
    filters.map((item) => [
      item.id,
      model.tasks.filter((task) => matchesView(task, item.id, today)).length,
    ]),
  );
  const progress = model.tasks.length ? Math.round((completed / model.tasks.length) * 100) : 0;
  const selectedTasks = model.tasks.filter((task) => selected.has(task.id));
  const allSelected = visible.length > 0 && visible.every((task) => selected.has(task.id));
  const busy = model.isWorking;

  useLayoutEffect(() => {
    if (pendingFocus.current === null || busy) return;
    const choices = list.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]:not(.selection-check)',
    );
    const target = choices?.[Math.min(pendingFocus.current, (choices?.length ?? 1) - 1)];
    (target ?? input.current)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [visible, busy]);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const element = event.target;
      if (
        editing ||
        (element instanceof HTMLElement &&
          (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)))
      )
        return;
      if (event.ctrlKey || event.metaKey || !event.altKey || event.isComposing) return;
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
  }, [editing]);

  const reportError = (caught: unknown) =>
    setError(
      caught instanceof TaskInputError
        ? caught.message
        : 'Не удалось изменить список. Попробуйте ещё раз.',
    );
  const clearUndo = () => setUndoTasks([]);
  const add = async (title: string, details: TaskDetails) => {
    try {
      await model.add(title, details);
      setError('');
      setFilter('all');
      setQuery('');
      clearUndo();
      setNotice('Задача добавлена.');
      return true;
    } catch (caught) {
      reportError(caught);
      return false;
    }
  };
  const toggle = async (id: string) => {
    if (busy) return;
    try {
      const task = model.tasks.find((item) => item.id === id);
      pendingFocus.current = Math.max(
        0,
        visible.findIndex((item) => item.id === id),
      );
      await model.toggle(id);
      setError('');
      clearUndo();
      setNotice(task?.completed ? 'Задача снова в работе.' : 'Задача выполнена.');
    } catch (caught) {
      pendingFocus.current = null;
      reportError(caught);
    }
  };
  const removeTasks = async (tasks: readonly Task[]) => {
    if (busy || !tasks.length) return;
    try {
      await model.removeMany(tasks.map((task) => task.id));
      setUndoTasks(tasks);
      setSelected(new Set());
      setNotice(`Удалено: ${tasks.length}. Можно отменить.`);
      setError('');
      input.current?.focus();
    } catch (caught) {
      reportError(caught);
    }
  };
  const undo = async () => {
    try {
      await model.restore(undoTasks);
      clearUndo();
      setNotice('Задачи восстановлены.');
      setError('');
    } catch (caught) {
      reportError(caught);
    }
  };
  const bulkComplete = async (value: boolean) => {
    try {
      await model.setManyCompleted(
        selectedTasks.map((task) => task.id),
        value,
      );
      clearUndo();
      setSelected(new Set());
      setSelecting(false);
      setNotice(value ? 'Выбранные задачи выполнены.' : 'Выбранные задачи возвращены в работу.');
      setError('');
      input.current?.focus();
    } catch (caught) {
      reportError(caught);
    }
  };
  const examples = async () => {
    if (model.tasks.length || busy) return;
    try {
      // One explicit transaction; StrictMode never populates the list automatically.
      await model.addExamples(today);
      setNotice('Добавлены три примера. Их можно изменить или удалить.');
      setError('');
    } catch (caught) {
      reportError(caught);
    }
  };
  const selectOne = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const filterButtons = (mobile = false) => (
    <div
      className={mobile ? 'mobile-filters' : 'sidebar-filters'}
      role="group"
      aria-label="Фильтр задач"
    >
      {filters.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`filter-button${filter === item.id ? ' is-selected' : ''}`}
          aria-pressed={filter === item.id}
          aria-controls="task-list"
          onClick={() => {
            setFilter(item.id);
            setSelected(new Set());
          }}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
          <span className="filter-count">{counts[item.id]}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-shell workspace">
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
              <Icon name="spark" size={14} /> Твой ритм
            </span>
            <strong>
              {progress}
              <span>%</span>
            </strong>
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
                ? 'Всё готово. Можно выдохнуть.'
                : 'Один понятный шаг за другим.'}
            </p>
          </div>
          <div className="local-note">
            <Icon name="shield" size={16} />
            <span>
              Задачи в этом браузере.
              <br />
              Сохраняй резервную копию.
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
            Личное <span>/</span> Мои задачи
          </span>
          <span
            className={`save-status${model.status !== 'saved' ? ' save-status--warning' : ''}`}
            role="status"
          >
            <span />
            {busy
              ? 'Сохраняем…'
              : model.status === 'saved'
                ? 'Всё сохранено'
                : 'Есть несохранённое'}
          </span>
        </header>
        <section className="workspace-intro" aria-labelledby="hero-title">
          <div className="intro-copy">
            <span className="eyebrow">СВОЙ ТЕМП. ЧЁТКИЙ ФОКУС.</span>
            <h1 id="hero-title">
              Твой день.
              <br />
              <span>Твой фокус.</span>
            </h1>
            <p>Собери задачи, расставь приоритеты и начни с главного.</p>
          </div>
          <img
            src="/images/focus-orbit.webp"
            width="840"
            height="840"
            alt=""
            className="intro-art"
          />
          <div className="intro-stat">
            <strong>{active}</strong>
            <span>{taskWord(active)} в работе</span>
          </div>
        </section>
        <section className="tasks-section" aria-labelledby="tasks-title">
          <div className="section-heading">
            <div>
              <span className="section-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
              <h2 id="tasks-title">
                {filters.find((item) => item.id === filter)?.label}{' '}
                <span className="active-pill">{visible.length}</span>
              </h2>
            </div>
            <span className="task-total">
              {model.tasks.length} / {MAX_TASKS}
            </span>
          </div>
          <TaskComposer inputRef={input} busy={busy} onAdd={add} />
          {error && (
            <p className="input-error" role="alert">
              {error}
              <button type="button" className="text-button" onClick={() => setError('')}>
                Закрыть
              </button>
            </p>
          )}
          {model.status !== 'saved' && (
            <div className="storage-warning" role="alert">
              <div>
                <strong>
                  {model.status === 'corrupt'
                    ? 'Сохранённый список не удалось прочитать.'
                    : model.status === 'conflict'
                      ? 'Не удалось объединить изменения.'
                      : 'Изменения пока только в этой вкладке.'}
                </strong>
                <p>
                  {model.status === 'corrupt'
                    ? 'Исходные данные не изменены. Восстановление сохранит полную резервную копию перед заменой.'
                    : model.status === 'conflict'
                      ? 'В другой вкладке список изменился. Освободи место или проверь, не удалена ли редактируемая задача. Текущую работу можно экспортировать.'
                      : 'Не закрывай вкладку. Проверь свободное место и разрешения браузера. Можно скачать копию задач.'}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await model.retrySave();
                  setNotice(
                    ok
                      ? 'Список сохранён.'
                      : 'Сохранить пока не получилось. Экспортируй копию перед закрытием вкладки.',
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
                aria-keyshortcuts="Alt+/"
                ref={search}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(new Set());
                }}
                placeholder="Поиск по задачам и заметкам"
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
            </div>
            <label className="sort-control">
              <span className="sr-only">Порядок задач</span>
              <select
                aria-label="Порядок задач"
                value={sort}
                onChange={(event) => setSort(event.target.value as TaskSort)}
              >
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="priority">По приоритету</option>
                <option value="due">По сроку</option>
              </select>
            </label>
          </div>
          <div className="list-actions">
            <span aria-live="polite">
              {visible.length} {taskWord(visible.length)}
            </span>
            <div className="button-row">
              <button
                type="button"
                className="text-button"
                disabled={!model.tasks.length || busy}
                aria-pressed={selecting}
                onClick={() => {
                  setSelecting(!selecting);
                  setSelected(new Set());
                }}
              >
                {selecting ? 'Закончить выбор' : 'Выбрать задачи'}
              </button>
              {completed > 0 && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => removeTasks(model.tasks.filter((task) => task.completed))}
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
                  disabled={busy || !visible.length}
                  onChange={() =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      visible.forEach((task) => {
                        if (allSelected) next.delete(task.id);
                        else next.add(task.id);
                      });
                      return next;
                    })
                  }
                />{' '}
                Все видимые
              </label>
              <span>Выбрано: {selectedTasks.length}</span>
              <div className="button-row">
                <button
                  type="button"
                  disabled={busy || !selectedTasks.length}
                  onClick={() => bulkComplete(true)}
                >
                  Выполнить
                </button>
                <button
                  type="button"
                  disabled={busy || !selectedTasks.length}
                  onClick={() => bulkComplete(false)}
                >
                  В работу
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={busy || !selectedTasks.length}
                  onClick={() => removeTasks(selectedTasks)}
                >
                  Удалить
                </button>
              </div>
            </div>
          )}
          <div id="task-list" className="task-list-container" ref={list} aria-busy={busy}>
            {visible.length ? (
              <ul className="task-list" aria-label="Список задач">
                {visible.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    today={today}
                    selecting={selecting}
                    selected={selected.has(task.id)}
                    busy={busy}
                    onSelect={selectOne}
                    onToggle={toggle}
                    onDelete={(task) => removeTasks([task])}
                    onEdit={(task) => setEditing(task)}
                  />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <div className="empty-orbit" aria-hidden="true">
                  <Icon name={query ? 'search' : 'spark'} size={24} />
                </div>
                <h3>
                  {query
                    ? 'Ничего не нашлось'
                    : model.tasks.length
                      ? filter === 'overdue'
                        ? 'Ничего не просрочено'
                        : filter === 'today'
                          ? 'На сегодня задач нет'
                          : filter === 'completed'
                            ? 'Первые победы впереди'
                            : 'Всё сделано'
                      : 'С чего начнём?'}
                </h3>
                <p>
                  {query
                    ? 'Попробуй другое слово или посмотри все задачи.'
                    : model.tasks.length
                      ? 'Добавь новую задачу или выбери другой раздел.'
                      : 'Добавь своё дело выше или попробуй три задачи-примера.'}
                </p>
                <div className="empty-actions">
                  {!model.tasks.length && !query ? (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => input.current?.focus()}
                      >
                        Добавить первую задачу
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={examples}
                      >
                        Попробовать примеры
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                      }}
                    >
                      Показать все задачи
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <TaskBackup
            tasks={model.tasks}
            today={today}
            busy={busy}
            onNotice={setNotice}
            onError={reportError}
            onRestore={async (tasks) => {
              await model.restore(tasks);
              clearUndo();
              setQuery('');
              setFilter('all');
              setError('');
            }}
          />
        </section>
        <footer className="app-footer">
          <span>
            <span className="footer-mark" /> Свой темп. Ощутимый результат.
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
      {editing && (
        <TaskEditor
          key={editing.id}
          task={editing}
          onClose={() => setEditing(null)}
          onSave={async (id, title, details) => {
            await model.edit(id, title, details);
            clearUndo();
            setNotice('Задача обновлена.');
            setError('');
          }}
        />
      )}
      {notice && (
        <div className="toast">
          <span role="status">{notice}</span>
          {undoTasks.length > 0 && (
            <button type="button" onClick={undo} disabled={busy}>
              <Icon name="undo" size={15} /> Отменить
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="Закрыть уведомление"
            onClick={() => {
              setNotice('');
              clearUndo();
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
