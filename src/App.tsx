import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MAX_TASKS, TaskInputError, taskWord } from './domain/tasks.ts';
import type { Task, TaskDetails, DateChange } from './domain/tasks.ts';
import { formatDay } from './domain/calendar.ts';
import { localDate, matchesView, queryTasks, queryWorkspaceTasks } from './domain/taskQueries.ts';
import type { TaskSort, TaskView } from './domain/taskQueries.ts';
import { useTasks } from './hooks/useTasks.ts';
import { Icon } from './components/Icon.tsx';
import { TaskItem } from './components/TaskItem.tsx';
import { TaskEditor } from './components/TaskEditor.tsx';
import { TaskComposer } from './components/TaskComposer.tsx';
import { TaskBackup } from './components/TaskBackup.tsx';
import { TaskCalendar } from './components/TaskCalendar.tsx';
import { BulkSchedule } from './components/BulkSchedule.tsx';
import { WeekOverview } from './components/WeekOverview.tsx';
import { WorkspaceSidebar } from './components/WorkspaceSidebar.tsx';
import { DayOverview } from './components/DayOverview.tsx';
import { ProjectDialog } from './components/ProjectDialog.tsx';
import type { Project } from './domain/projects.ts';
import { readWorkspaceRoute, writeWorkspaceRoute } from './domain/workspaceRoute.ts';

const filters: { id: TaskView; label: string; icon: 'layers' | 'circle' | 'check' | 'calendar' }[] =
  [
    { id: 'focus', label: 'Мой день', icon: 'circle' },
    { id: 'inbox', label: 'Входящие', icon: 'layers' },
    { id: 'all', label: 'Все задачи', icon: 'layers' },
    { id: 'active', label: 'В работе', icon: 'circle' },
    { id: 'today', label: 'Сегодня', icon: 'calendar' },
    { id: 'overdue', label: 'Просрочено', icon: 'calendar' },
    { id: 'upcoming', label: 'Ближайшие 7 дней', icon: 'calendar' },
    { id: 'undated', label: 'Без срока', icon: 'circle' },
    { id: 'completed', label: 'Готово', icon: 'check' },
  ];

export default function App() {
  const model = useTasks();
  const [initialRoute] = useState(() => readWorkspaceRoute(window.location.hash));
  const [mode, setMode] = useState<'list' | 'calendar'>(initialRoute.mode);
  const [selectedDay, setSelectedDay] = useState(localDate);
  const [scheduleUndo, setScheduleUndo] = useState<readonly DateChange[]>([]);
  const [filter, setFilter] = useState<TaskView>(initialRoute.filter);
  const [projectScope, setProjectScope] = useState<string | null>(initialRoute.projectId);
  const [projectDialog, setProjectDialog] = useState<{ project: Project | null } | null>(null);
  useEffect(() => {
    const hash = writeWorkspaceRoute({ mode, filter, projectId: projectScope });
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [mode, filter, projectScope]);
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === '#main') return;
      const route = readWorkspaceRoute(window.location.hash);
      setMode(route.mode);
      setFilter(route.filter);
      setProjectScope(route.projectId);
      setSelected(new Set());
      setSelecting(false);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TaskSort>('newest');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticePaused, setNoticePaused] = useState(false);
  const [undoTasks, setUndoTasks] = useState<readonly Task[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [today, setToday] = useState(localDate);
  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const pendingHomeFocus = useRef(false);
  const pendingStepFocus = useRef<{
    id: string;
    stepId: string;
    area?: 'list' | 'overview';
  } | null>(null);
  useEffect(() => {
    if (projectScope && !model.projects.some((project) => project.id === projectScope)) {
      setProjectScope(null);
      setFilter('inbox');
      setMode('list');
      setSelected(new Set());
      setSelecting(false);
    }
  }, [model.projects, projectScope, setMode]);
  const scopedTasks = useMemo(
    () => model.tasks.filter((task) => !projectScope || task.projectId === projectScope),
    [model.tasks, projectScope],
  );
  const activeProject = model.projects.find((project) => project.id === projectScope);
  const isHome = mode === 'list' && filter === 'focus' && !projectScope;
  const visible = useMemo(
    () =>
      queryWorkspaceTasks(model.tasks, {
        view: filter,
        query,
        sort,
        today,
        projectId: projectScope,
        calendarDay: mode === 'calendar' ? selectedDay : '',
      }),
    [model.tasks, filter, query, sort, today, projectScope, mode, selectedDay],
  );
  const counts = Object.fromEntries(
    filters.map((item) => [
      item.id,
      model.tasks.filter((task) => matchesView(task, item.id, today)).length,
    ]),
  );
  const selectedTasks = model.tasks.filter((task) => selected.has(task.id));
  const allSelected = visible.length > 0 && visible.every((task) => selected.has(task.id));
  const busy = model.isWorking;
  useEffect(() => {
    if (!notice || noticePaused || undoTasks.length || scheduleUndo.length) return;
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice, noticePaused, undoTasks, scheduleUndo]);
  const clearableCompleted = visible.filter((task) => task.completed);
  useLayoutEffect(() => {
    if (busy) return;
    if (pendingHomeFocus.current) {
      document
        .querySelector<HTMLButtonElement>('.next-action-card button')
        ?.focus({ preventScroll: true });
      pendingHomeFocus.current = false;
    }
    if (pendingStepFocus.current) {
      const { id, stepId, area } = pendingStepFocus.current;
      const target = Array.from(
        (area === 'overview'
          ? document.querySelector('.next-action-card')
          : list.current
        )?.querySelectorAll<HTMLInputElement>('input[data-step-id]') ?? [],
      ).find((element) => element.dataset.stepTask === id && element.dataset.stepId === stepId);
      const overviewNext =
        area === 'overview'
          ? document.querySelector<HTMLInputElement>('.next-action-card input[data-step-id]')
          : null;
      (target ?? overviewNext ?? input.current)?.focus({ preventScroll: true });
      pendingStepFocus.current = null;
    }
    if (pendingFocus.current === null) return;
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
  const clearUndo = () => {
    setUndoTasks([]);
    setScheduleUndo([]);
  };
  const add = async (title: string, details: TaskDetails) => {
    try {
      await model.add(title, {
        ...details,
        ...(filter === 'focus' && !projectScope && mode === 'list' ? { focusDate: today } : {}),
      });
      setError('');
      if (mode === 'calendar') {
        if (details.dueDate) setSelectedDay(details.dueDate);
        else {
          setMode('list');
          setFilter('undated');
        }
      } else if (details.projectId && details.projectId !== projectScope) {
        setProjectScope(details.projectId);
        setFilter('all');
      } else if (projectScope && !details.projectId) {
        setProjectScope(null);
        setFilter('inbox');
      } else if (filter !== 'focus') setFilter('all');
      setQuery('');
      clearUndo();
      setNotice('Задача добавлена.');
      return true;
    } catch (caught) {
      reportError(caught);
      return false;
    }
  };
  const toggle = async (id: string, area: 'list' | 'overview' = 'list') => {
    if (busy) return;
    try {
      const task = model.tasks.find((item) => item.id === id);
      if (area === 'overview') pendingHomeFocus.current = true;
      else
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
      setScheduleUndo([]);
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
      if (undoTasks.length) await model.restore(undoTasks);
      else {
        await model.changeDates(scheduleUndo);
        if (mode === 'calendar') {
          const dates = [...new Set(scheduleUndo.map((change) => change.dueDate))];
          if (dates.length === 1 && dates[0]) setSelectedDay(dates[0]);
          else {
            setMode('list');
            setFilter(dates.length === 1 ? 'undated' : 'all');
          }
        }
      }
      clearUndo();
      setNotice(
        scheduleUndo.length
          ? 'Прежние сроки возвращены там, где их не меняли позже.'
          : 'Задачи восстановлены.',
      );
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
  const scheduleSelected = async (dueDate: string) => {
    if (busy || !selectedTasks.length) return;
    const previous: DateChange[] = selectedTasks.map((task) => ({
      id: task.id,
      dueDate: task.dueDate ?? '',
      expectedDate: dueDate,
    }));
    try {
      await model.changeDates(selectedTasks.map((task) => ({ id: task.id, dueDate })));
      clearUndo();
      setScheduleUndo(previous);
      setSelected(new Set());
      setSelecting(false);
      setError('');
      if (mode === 'calendar') {
        if (dueDate) setSelectedDay(dueDate);
        else {
          setMode('list');
          setFilter('undated');
        }
      }
      setNotice(
        dueDate
          ? `Срок перенесён: ${formatDay(dueDate)}. Можно отменить.`
          : 'Срок убран. Можно отменить.',
      );
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
      setMode('list');
      setProjectScope(null);
      setFilter('focus');
      setQuery('');
      setNotice(
        'Добавлен пример пространства: проекты, задачи и шаги. Всё можно изменить или удалить.',
      );
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
  const closeTaskEditor = () => {
    setEditing(null);
    window.requestAnimationFrame(() => {
      if (document.activeElement === document.body) input.current?.focus({ preventScroll: true });
    });
  };
  const closeProjectDialog = () => {
    setProjectDialog(null);
    window.requestAnimationFrame(() => {
      if (document.activeElement === document.body) input.current?.focus({ preventScroll: true });
    });
  };
  const openView = (view: TaskView) => {
    setProjectScope(null);
    setFilter(view);
    setMode('list');
    setSelected(new Set());
    setSelecting(false);
    if (view === 'upcoming') setSort('due');
  };
  const openProject = (id: string) => {
    setProjectScope(id);
    setFilter('all');
    setMode('list');
    setSelected(new Set());
    setSelecting(false);
    setQuery('');
  };
  const focusTask = async (task: Task) => {
    if (busy) return;
    try {
      pendingFocus.current = Math.max(
        0,
        visible.findIndex((item) => item.id === task.id),
      );
      await model.setFocus(task.id, task.focusDate === today ? '' : today);
      clearUndo();
      setNotice(
        task.focusDate === today
          ? 'Задача убрана из фокуса. Срок остался прежним.'
          : 'Задача добавлена в фокус на сегодня.',
      );
    } catch (caught) {
      reportError(caught);
    }
  };
  const changeStep = async (
    id: string,
    stepId: string,
    value: boolean,
    area: 'list' | 'overview' = 'list',
  ) => {
    if (busy) return;
    try {
      pendingStepFocus.current = { id, stepId, area };
      await model.setStep(id, stepId, value);
      setError('');
    } catch (caught) {
      reportError(caught);
    }
  };
  const filterButtons = () => (
    <div className="mobile-filters mobile-scope-picker">
      <label>
        <span>Раздел</span>
        <select
          aria-label="Раздел задач"
          value={filter}
          onChange={(event) => openView(event.target.value as TaskView)}
        >
          {filters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {counts[item.id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div
      className={`app-shell workspace workspace-v3${mode === 'calendar' ? ' workspace--calendar' : filter === 'upcoming' ? ' workspace--upcoming' : ''}`}
    >
      <a className="skip-link" href="#main">
        К задачам
      </a>
      <WorkspaceSidebar
        tasks={model.tasks}
        projects={model.projects}
        today={today}
        mode={mode}
        filter={filter}
        projectId={projectScope}
        onView={openView}
        onCalendar={() => {
          setProjectScope(null);
          setMode('calendar');
          setSelected(new Set());
          setSelecting(false);
        }}
        onProject={openProject}
        onManageProject={(project) => setProjectDialog({ project })}
      />
      <main id="main" className="main-content" tabIndex={-1}>
        <header className="topbar">
          <a href="#list" className="mobile-brand" onClick={() => openView('focus')}>
            <span>f.</span>FOCUS.
          </a>
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
        <nav className="mobile-workspace-nav" aria-label="Мобильное рабочее пространство">
          <button type="button" aria-pressed={isHome} onClick={() => openView('focus')}>
            <Icon name="sun" size={17} />
            Мой день
          </button>
          <button
            type="button"
            aria-pressed={mode === 'list' && filter === 'inbox' && !projectScope}
            onClick={() => openView('inbox')}
          >
            <Icon name="inbox" size={17} />
            Входящие
          </button>
          <button
            type="button"
            aria-pressed={mode === 'calendar'}
            onClick={() => {
              setProjectScope(null);
              setMode('calendar');
            }}
          >
            <Icon name="calendar" size={17} />
            Календарь
          </button>
          <button type="button" onClick={() => setProjectDialog({ project: null })}>
            <Icon name="plus" size={17} />
            Проект
          </button>
        </nav>
        {model.projects.length > 0 && (
          <label className="mobile-project-picker">
            <Icon name="folder" size={15} />
            <span className="sr-only">Открыть проект</span>
            <select
              aria-label="Открыть проект"
              value={projectScope ?? ''}
              onChange={(event) =>
                event.target.value ? openProject(event.target.value) : openView('focus')
              }
            >
              <option value="">Моё пространство</option>
              {model.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {isHome ? (
          <DayOverview
            tasks={model.tasks}
            projects={model.projects}
            today={today}
            onTask={setEditing}
            onView={openView}
            onProject={openProject}
            onCreate={() => input.current?.focus()}
            onExamples={examples}
            onStep={(id, stepId, value) => changeStep(id, stepId, value, 'overview')}
            busy={busy}
            onComplete={(id) => toggle(id, 'overview')}
          />
        ) : (
          <header className="workspace-page-title">
            <div>
              <span className="section-caption">
                {activeProject ? 'МОЙ ПРОЕКТ' : 'РАБОЧЕЕ ПРОСТРАНСТВО'}
              </span>
              <h1>
                {activeProject?.title ??
                  (mode === 'calendar'
                    ? 'Календарь'
                    : filters.find((item) => item.id === filter)?.label)}
              </h1>
              <p>
                {activeProject
                  ? 'Каждое большое дело начинается с одного понятного шага.'
                  : mode === 'calendar'
                    ? 'Распредели нагрузку и найди время для главного.'
                    : 'Все связанные дела — в одном понятном месте.'}
              </p>
            </div>
            {activeProject && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setProjectDialog({ project: activeProject })}
              >
                <Icon name="edit" size={15} />
                Настроить проект
              </button>
            )}
          </header>
        )}
        <section className="tasks-section" aria-labelledby="tasks-title">
          <div className="section-heading">
            <div>
              <span className="section-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
              <h2 id="tasks-title">
                {mode === 'calendar'
                  ? 'Задачи по дням'
                  : isHome
                    ? 'В фокусе сегодня'
                    : activeProject
                      ? 'Задачи проекта'
                      : 'Твои задачи'}{' '}
                <span className="active-pill">{visible.length}</span>
              </h2>
            </div>
            <span className="task-total">
              {model.tasks.length} / {MAX_TASKS}
            </span>
          </div>
          <div className="workspace-viewbar">
            <div className="view-switch" role="group" aria-label="Отображение задач">
              <button
                type="button"
                aria-pressed={mode === 'list'}
                onClick={() => {
                  setMode('list');
                  setSelected(new Set());
                  setSelecting(false);
                }}
              >
                Список
              </button>
              <button
                type="button"
                aria-pressed={mode === 'calendar'}
                onClick={() => {
                  setMode('calendar');
                  setSelected(new Set());
                  setSelecting(false);
                }}
              >
                Календарь
              </button>
            </div>
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
          {mode === 'list' && filter === 'upcoming' && (
            <WeekOverview
              tasks={visible}
              today={today}
              onSelect={(date) => {
                setSelectedDay(date);
                setMode('calendar');
                setSelected(new Set());
              }}
            />
          )}
          {mode === 'calendar' && (
            <TaskCalendar
              tasks={queryTasks(scopedTasks, 'all', query, sort, today)}
              today={today}
              selected={selectedDay}
              onSelect={(date) => {
                setSelectedDay(date);
                setSelected(new Set());
              }}
              onUndated={() => {
                setMode('list');
                setFilter('undated');
                setSelected(new Set());
              }}
              onOpenDay={() => {
                input.current?.scrollIntoView({ block: 'center' });
                input.current?.focus();
              }}
            />
          )}
          {mode === 'calendar' && (
            <div className="day-agenda-heading">
              <h3>{formatDay(selectedDay)}</h3>
              <span>Задачи выбранного дня · включая выполненные</span>
            </div>
          )}
          <TaskComposer
            inputRef={input}
            busy={busy}
            onAdd={add}
            defaultDate={mode === 'calendar' ? selectedDay : ''}
            projects={model.projects}
            defaultProjectId={projectScope ?? ''}
          />
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
            {filterButtons()}
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
              {clearableCompleted.length > 0 && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => removeTasks(clearableCompleted)}
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
              <BulkSchedule
                today={today}
                disabled={busy || !selectedTasks.length}
                onApply={scheduleSelected}
              />
            </div>
          )}
          <div id="task-list" className="task-list-container" ref={list} aria-busy={busy}>
            {visible.length ? (
              <ul className="task-list" aria-label="Список задач">
                {visible.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    projects={model.projects}
                    onFocusTask={focusTask}
                    onStep={changeStep}
                    onProject={openProject}
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
                    : filter === 'focus' && !projectScope && mode === 'list'
                      ? 'Выбери фокус на сегодня'
                      : filter === 'inbox' && mode === 'list'
                        ? 'Входящие разобраны'
                        : projectScope && mode === 'list'
                          ? 'В проекте пока нет задач'
                          : mode === 'calendar'
                            ? 'В этот день пока нет задач'
                            : filter === 'upcoming'
                              ? 'Ближайшая неделя свободна'
                              : filter === 'undated'
                                ? 'У всех задач выбран срок'
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
                        setMode('list');
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
            projects={model.projects}
            today={today}
            busy={busy}
            onNotice={setNotice}
            onError={reportError}
            onRestore={async (tasks, projects) => {
              await model.importWorkspace(tasks, projects);
              setProjectScope(null);
              setMode('list');
              setSelected(new Set());
              setSelecting(false);
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
      {projectDialog && (
        <ProjectDialog
          project={projectDialog.project}
          taskCount={
            model.tasks.filter((task) => task.projectId === projectDialog.project?.id).length
          }
          onClose={closeProjectDialog}
          onSave={async (project) => {
            if (projectDialog.project) await model.renameProject(project);
            else await model.addProject(project);
            openProject(project.id);
            setNotice(
              projectDialog.project ? 'Проект обновлён.' : 'Проект создан. Добавь первое дело.',
            );
          }}
          onRemove={async (id) => {
            await model.removeProject(id);
            openView('inbox');
            setNotice('Проект удалён. Все его задачи сохранены во входящих.');
          }}
        />
      )}
      {editing && (
        <TaskEditor
          key={editing.id}
          task={editing}
          projects={model.projects}
          onClose={closeTaskEditor}
          onSave={async (id, title, details) => {
            await model.edit(id, title, details);
            if (
              projectScope &&
              details.projectId !== undefined &&
              details.projectId !== projectScope
            ) {
              if (details.projectId) openProject(details.projectId);
              else openView('inbox');
            }
            clearUndo();
            setNotice('Задача обновлена.');
            setError('');
          }}
        />
      )}
      {notice && (
        <div
          className="toast"
          onMouseEnter={() => setNoticePaused(true)}
          onMouseLeave={() => setNoticePaused(false)}
          onFocus={() => setNoticePaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setNoticePaused(false);
          }}
        >
          <span role="status">{notice}</span>
          {(undoTasks.length > 0 || scheduleUndo.length > 0) && (
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
              setNoticePaused(false);
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
