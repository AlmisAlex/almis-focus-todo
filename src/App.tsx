import { useLocalDay } from './hooks/useLocalDay.ts';
import { useCaptureFlow } from './hooks/useCaptureFlow.ts';
import { useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts.ts';
import { MobileScopePicker } from './components/MobileScopePicker.tsx';
import { useDemoWorkspace } from './hooks/useDemoWorkspace.ts';
import { DemoFilesNotice } from './components/DemoFilesNotice.tsx';
import { useTaskOperations } from './hooks/useTaskOperations.ts';
import { WorkspaceTopbar } from './components/WorkspaceTopbar.tsx';
import { WorkspaceMobileNavigation } from './components/WorkspaceMobileNavigation.tsx';
import { LegacyWorkspaceNotice } from './components/LegacyWorkspaceNotice.tsx';
import { WorkspaceViewBar } from './components/WorkspaceViewBar.tsx';
import { TaskFilters } from './components/TaskFilters.tsx';
import { TaskSelectionBar } from './components/TaskSelectionBar.tsx';
import { TaskEmptyState } from './components/TaskEmptyState.tsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MAX_TASKS, TaskInputError, taskStatus } from './domain/tasks.ts';
import { usePlanner } from './hooks/usePlanner.ts';
import { PlannerPanel } from './components/PlannerPanel.tsx';
import { PreferencesDialog } from './components/PreferencesDialog.tsx';
import { ShortcutHelp } from './components/ShortcutHelp.tsx';
import { QuickCapture } from './components/QuickCapture.tsx';
import { TaskBoard } from './components/TaskBoard.tsx';
import { OfflineStatus } from './components/OfflineStatus.tsx';
import type { Task, TaskDetails } from './domain/tasks.ts';
import { formatDay } from './domain/calendar.ts';
import { localDate, matchesView, queryTasks, queryWorkspaceTasks } from './domain/taskQueries.ts';
import type { TaskSort, TaskView } from './domain/taskQueries.ts';
import { useTasks } from './hooks/useTasks.ts';
import { useWorkspacePosition } from './hooks/useWorkspacePosition.ts';
import { useWorkspaceMotion } from './hooks/useWorkspaceMotion.ts';
import { Icon } from './components/Icon.tsx';
import { TaskItem } from './components/TaskItem.tsx';
import { TaskEditor } from './components/TaskEditor.tsx';
import { TaskComposer } from './components/TaskComposer.tsx';
import { TaskBackup } from './components/TaskBackup.tsx';
import { TaskCalendar } from './components/TaskCalendar.tsx';
import { WeekOverview } from './components/WeekOverview.tsx';
import { WorkspaceSidebar } from './components/WorkspaceSidebar.tsx';
import { DayOverview } from './components/DayOverview.tsx';
import { ProjectDialog } from './components/ProjectDialog.tsx';
import type { Project } from './domain/projects.ts';
import { CommandPalette } from './components/CommandPalette.tsx';
import type { CommandResult } from './domain/commandSearch.ts';
import { useAttachments } from './hooks/useAttachments.ts';
import { FileLibrary } from './components/FileLibrary.tsx';
import {
  readWorkspaceRoute,
  writeWorkspaceRoute,
  routeAfterCreate,
} from './domain/workspaceRoute.ts';

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
  const planner = usePlanner();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const attachments = useAttachments();
  const [filesOpen, setFilesOpen] = useState(false);
  const capture = useCaptureFlow();
  const { creating } = capture;
  const [initialRoute] = useState(() => readWorkspaceRoute(window.location.hash));
  const [mode, setMode] = useState<'list' | 'calendar'>(initialRoute.mode);
  const [selectedDay, setSelectedDay] = useState(localDate);
  const [filter, setFilter] = useState<TaskView>(initialRoute.filter);
  const [projectScope, setProjectScope] = useState<string | null>(initialRoute.projectId);
  const [projectDialog, setProjectDialog] = useState<{ project: Project | null } | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
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
      setQuery('');
      setTagFilter('');
      setStatusFilter('');
      setSelected(new Set());
      setSelecting(false);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TaskSort>(
    initialRoute.filter === 'focus' ? 'priority' : 'newest',
  );
  const [editing, setEditing] = useState<Task | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const today = useLocalDay();
  const input = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const pendingStepFocus = useRef<{
    id: string;
    stepId: string;
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
  const organizedTasks = useMemo(
    () =>
      model.tasks.filter(
        (task) =>
          (!tagFilter || task.tags?.some((tag) => tag.toLocaleLowerCase('ru') === tagFilter)) &&
          (!statusFilter || taskStatus(task) === statusFilter),
      ),
    [model.tasks, tagFilter, statusFilter],
  );
  const allTags = useMemo(
    () =>
      [
        ...new Set(
          model.tasks.flatMap((task) => task.tags ?? []).map((tag) => tag.toLocaleLowerCase('ru')),
        ),
      ].sort((a, b) => a.localeCompare(b, 'ru')),
    [model.tasks],
  );
  useEffect(() => {
    if (tagFilter && !allTags.includes(tagFilter)) {
      setTagFilter('');
      setSelected(new Set());
    }
  }, [allTags, tagFilter]);
  const scopedTasks = useMemo(
    () => organizedTasks.filter((task) => !projectScope || task.projectId === projectScope),
    [organizedTasks, projectScope],
  );
  const activeProject = model.projects.find((project) => project.id === projectScope);
  const isHome = mode === 'list' && filter === 'focus' && !projectScope;
  const visible = useMemo(
    () =>
      queryWorkspaceTasks(organizedTasks, {
        view: filter,
        query,
        sort,
        today,
        projectId: projectScope,
        calendarDay: mode === 'calendar' ? selectedDay : '',
      }),
    [organizedTasks, filter, query, sort, today, projectScope, mode, selectedDay],
  );
  const { surface, list } = useWorkspaceMotion(
    `${mode}:${filter}:${projectScope ?? ''}:${planner.state.preferences.layout}`,
    visible.map((task) => `${task.id}:${task.completed}`).join('|'),
  );
  const counts = Object.fromEntries(
    filters.map((item) => [
      item.id,
      model.tasks.filter((task) => matchesView(task, item.id, today)).length,
    ]),
  );
  const selectedTasks = visible.filter((task) => selected.has(task.id));
  const allSelected = visible.length > 0 && visible.every((task) => selected.has(task.id));
  const demo = useDemoWorkspace({
    model,
    attachments,
    today,
    onError: (caught) => reportError(caught),
    onLoaded: () => {
      openView('focus');
      setNotice(
        'Добавлен пример: 6 задач, 3 проекта и 4 тестовых файла. Всё можно изменить или удалить.',
      );
      setError('');
    },
  });
  const busy = model.isWorking || demo.busy;
  const { navigateToTop, revealTask, revealedTaskId } = useWorkspacePosition(
    `${mode}:${filter}:${projectScope ?? ''}`,
    JSON.stringify(visible.map((task) => task.id)),
    list,
    creating,
    busy,
  );
  const {
    error,
    setError,
    notice,
    setNotice,
    setNoticePaused,
    undoTasks,
    scheduleUndo,
    projectUndo,
    clearUndo,
    reportError,
    toggle,
    removeTasks,
    undo,
    bulkComplete,
    scheduleSelected,
    moveSelected,
    focusTask,
    changeStep,
    changeStatus,
  } = useTaskOperations({
    model,
    visible,
    selectedTasks,
    busy,
    today,
    mode,
    input,
    pendingFocus,
    pendingStepFocus,
    setSelected,
    setSelecting,
    setSelectedDay,
    setMode,
    setFilter,
  });
  const clearableCompleted = visible.filter((task) => task.completed);
  useLayoutEffect(() => {
    if (!error || document.querySelector('dialog[open]')) return;
    errorMessage.current?.focus({ preventScroll: true });
    errorMessage.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [error]);
  useLayoutEffect(() => {
    if (busy) return;
    if (pendingStepFocus.current) {
      const { id, stepId } = pendingStepFocus.current;
      const target = Array.from(
        list.current?.querySelectorAll<HTMLInputElement>('input[data-step-id]') ?? [],
      ).find((element) => element.dataset.stepTask === id && element.dataset.stepId === stepId);
      (target ?? input.current)?.focus({ preventScroll: true });
      pendingStepFocus.current = null;
    }
    if (pendingFocus.current === null) return;
    const choices = list.current?.querySelectorAll<HTMLInputElement>('.task-check input');
    const target = choices?.[Math.min(pendingFocus.current, (choices?.length ?? 1) - 1)];
    (target ?? input.current)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [visible, busy]);
  useWorkspaceShortcuts({
    onCommands: () => setCommandOpen(true),
    onCreate: () => capture.open(),
    onSearch: () => {
      const panel = search.current?.closest('details');
      if (panel) panel.open = true;
      search.current?.focus();
    },
    onHelp: () => setHelpOpen(true),
  });

  const add = async (title: string, details: TaskDetails) => {
    const createdTask = await model.add(title, details);
    capture.consume();
    const id = createdTask.id;
    const destination = routeAfterCreate(
      createdTask,
      { mode, filter, projectId: projectScope },
      today,
    );
    revealTask(id);
    setTagFilter('');
    setStatusFilter('');
    setError('');
    setMode(destination.mode);
    setFilter(destination.filter);
    setProjectScope(destination.projectId);
    if (destination.mode === 'calendar' && createdTask.dueDate) setSelectedDay(createdTask.dueDate);
    setQuery('');
    clearUndo();
    setNotice('Задача добавлена.');
    return id;
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
    setTagFilter('');
    setStatusFilter('');
    navigateToTop();
    setProjectScope(null);
    setFilter(view);
    setMode('list');
    setSelected(new Set());
    setSelecting(false);
    setQuery('');
    if (view === 'upcoming') setSort('due');
    if (view === 'focus') setSort('priority');
  };
  const openProject = (id: string) => {
    setTagFilter('');
    setStatusFilter('');
    navigateToTop();
    setProjectScope(id);
    setFilter('all');
    setMode('list');
    setSelected(new Set());
    setSelecting(false);
    setQuery('');
  };
  const quickAdd = () => {
    capture.open();
  };
  const openCalendar = () => {
    setTagFilter('');
    setStatusFilter('');
    navigateToTop();
    setProjectScope(null);
    setMode('calendar');
    setFilter('all');
    setQuery('');
    setSelected(new Set());
    setSelecting(false);
  };
  const pickCommand = (result: CommandResult) => {
    setCommandOpen(false);
    window.requestAnimationFrame(() => {
      if (result.kind === 'create') quickAdd();
      else if (result.kind === 'project') openProject(result.project.id);
      else if (result.kind === 'view') openView(result.view);
      else if (result.kind === 'files') setFilesOpen(true);
      else if (result.kind === 'calendar') openCalendar();
      else if (result.kind === 'task') {
        if (result.task.projectId) openProject(result.task.projectId);
        else openView('all');
        setEditing(result.task);
      }
    });
  };
  const renderTask = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      attachmentCount={attachments.files.filter((file) => file.taskId === task.id).length}
      projects={model.projects}
      onFocusTask={focusTask}
      onStep={changeStep}
      onProject={openProject}
      today={today}
      selecting={selecting}
      selected={selected.has(task.id)}
      revealed={revealedTaskId === task.id}
      busy={busy}
      onSelect={selectOne}
      onToggle={toggle}
      onDelete={(task) => removeTasks([task])}
      onEdit={(task) => setEditing(task)}
      onStatus={changeStatus}
      draggable={planner.state.preferences.layout === 'board' && mode === 'list'}
    />
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
        onCalendar={openCalendar}
        onProject={openProject}
        onManageProject={(project) => setProjectDialog({ project })}
        onFiles={() => setFilesOpen(true)}
        fileCount={attachments.files.length}
      />
      <main id="main" className="main-content" tabIndex={-1}>
        <WorkspaceTopbar
          label={
            activeProject?.title ??
            (mode === 'calendar'
              ? 'Календарь'
              : (filters.find((item) => item.id === filter)?.label ?? 'Мой день'))
          }
          status={model.status}
          busy={busy}
          createRef={input}
          onHome={() => openView('focus')}
          onSearch={() => setCommandOpen(true)}
          onCreate={quickAdd}
          onSettings={() => setSettingsOpen(true)}
        />
        <WorkspaceMobileNavigation
          mode={mode}
          filter={filter}
          projectId={projectScope}
          isHome={isHome}
          projects={model.projects}
          onView={openView}
          onCalendar={openCalendar}
          onProject={openProject}
          onFiles={() => setFilesOpen(true)}
          onAddProject={() => setProjectDialog({ project: null })}
        />
        <LegacyWorkspaceNotice revision={model.tasks} today={today} />
        {isHome ? (
          <DayOverview tasks={model.tasks} today={today} onView={openView} />
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
        {isHome && (
          <PlannerPanel
            data={planner.state}
            tasks={model.tasks}
            today={today}
            onAction={planner.dispatch}
            error={planner.error}
          />
        )}
        <section className="tasks-section" aria-labelledby="tasks-title" ref={surface}>
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
            {model.tasks.length >= 450 && (
              <span className="task-total">
                {model.tasks.length} / {MAX_TASKS}
              </span>
            )}
          </div>
          <WorkspaceViewBar
            mode={mode}
            layout={planner.state.preferences.layout}
            filter={filter}
            onChange={async (nextMode, layout) => {
              if (layout && !(await planner.dispatch({ type: 'preferences', patch: { layout } }))) {
                setError(
                  'Не удалось сохранить вид задач. Проверь свободное место и настройки браузера.',
                );
                return;
              }
              setMode(nextMode);
              setSelected(new Set());
              setSelecting(false);
              navigateToTop();
            }}
          >
            <MobileScopePicker
              view={filter}
              options={filters}
              counts={counts}
              onChange={openView}
            />
          </WorkspaceViewBar>
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
              onCreate={quickAdd}
            />
          )}
          {mode === 'calendar' && (
            <div className="day-agenda-heading">
              <h3>{formatDay(selectedDay)}</h3>
              <span>Задачи выбранного дня · включая выполненные</span>
            </div>
          )}
          {error && (
            <p ref={errorMessage} className="input-error" role="alert" tabIndex={-1}>
              {error}
              <button type="button" className="text-button" onClick={() => setError('')}>
                Закрыть
              </button>
            </p>
          )}
          {demo.pendingFiles && <DemoFilesNotice busy={busy} onRetry={demo.retry} />}
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
          <QuickCapture
            title={capture.title}
            onTitleChange={capture.setTitle}
            disabled={busy}
            onDetails={capture.openDetails}
            onCreate={(title) =>
              add(title, {
                notes: '',
                priority: 'normal',
                dueDate: mode === 'calendar' ? selectedDay : '',
                projectId: projectScope ?? '',
                focusDate: isHome ? today : '',
              })
            }
          />
          <TaskFilters
            query={query}
            sort={sort}
            tag={tagFilter}
            status={statusFilter}
            tags={allTags}
            searchRef={search}
            onQuery={(value) => {
              setQuery(value);
              setSelected(new Set());
            }}
            onSort={setSort}
            onTag={(value) => {
              setTagFilter(value);
              setSelected(new Set());
            }}
            onStatus={(value) => {
              setStatusFilter(value);
              setSelected(new Set());
            }}
            onReset={() => {
              setTagFilter('');
              setStatusFilter('');
              setSelected(new Set());
            }}
          />
          <TaskSelectionBar
            visibleCount={visible.length}
            taskCount={model.tasks.length}
            clearableCount={clearableCompleted.length}
            selectedCount={selectedTasks.length}
            allSelected={allSelected}
            selecting={selecting}
            busy={busy}
            projects={model.projects}
            today={today}
            onSelectMode={() => {
              setSelecting(!selecting);
              setSelected(new Set());
            }}
            onSelectAll={() =>
              setSelected((previous) => {
                const next = new Set(previous);
                visible.forEach((task) => {
                  if (allSelected) next.delete(task.id);
                  else next.add(task.id);
                });
                return next;
              })
            }
            onClearCompleted={() => removeTasks(clearableCompleted)}
            onComplete={bulkComplete}
            onRemove={() => removeTasks(selectedTasks)}
            onSchedule={scheduleSelected}
            onMove={moveSelected}
          />
          <div id="task-list" className="task-list-container" ref={list} aria-busy={busy}>
            {visible.length && mode === 'list' && planner.state.preferences.layout === 'board' ? (
              <TaskBoard
                tasks={visible}
                renderTask={renderTask}
                onStatus={changeStatus}
                busy={busy}
              />
            ) : visible.length ? (
              <ul className="task-list" aria-label="Список задач">
                {visible.map(renderTask)}
              </ul>
            ) : (
              <TaskEmptyState
                query={query}
                hasTasks={model.tasks.length > 0}
                filter={filter}
                mode={mode}
                projectId={projectScope}
                filtered={!!tagFilter || !!statusFilter}
                busy={busy}
                onCreate={quickAdd}
                onExamples={demo.create}
                onShowAll={() => openView('all')}
              />
            )}
          </div>
          {visible.length > 0 && (
            <button type="button" className="list-add-task" onClick={quickAdd}>
              <span>
                <Icon name="plus" size={17} />
              </span>{' '}
              Добавить задачу
              <kbd>Alt N</kbd>
            </button>
          )}
          <TaskBackup
            tasks={model.tasks}
            projects={model.projects}
            today={today}
            busy={busy}
            attachments={attachments}
            {...(!planner.corrupt ? { planner: planner.state } : {})}
            onNotice={setNotice}
            onRestore={async (tasks, projects, files, preferences) => {
              if (tasks.length || projects.length) await model.importWorkspace(tasks, projects);
              if (files.length) {
                try {
                  await attachments.import(files);
                } catch (caught) {
                  throw new TaskInputError(
                    `${tasks.length || projects.length ? 'Задачи и проекты уже добавлены в пространство. ' : ''}Вложения не восстановлены. ${caught instanceof Error ? caught.message : 'Проверь место в браузере.'} Повтори импорт: существующие ID будут пропущены.`,
                  );
                }
              }
              if (preferences && !(await planner.dispatch({ type: 'restore', data: preferences })))
                throw new TaskInputError(
                  'Задачи и файлы добавлены. Настройки не сохранены; повторите импорт.',
                );
              setTagFilter('');
              setStatusFilter('');
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
        <OfflineStatus
          blocked={busy || model.hasUnsavedChanges || attachments.busy || planner.isWorking}
        />
      </main>
      {settingsOpen && (
        <PreferencesDialog
          preferences={planner.state.preferences}
          error={planner.error}
          {...(planner.corrupt ? { onRecover: () => planner.dispatch({ type: 'recover' }) } : {})}
          onChange={(patch) => {
            void planner.dispatch({ type: 'preferences', patch });
          }}
          onClose={() => setSettingsOpen(false)}
          onHelp={() => {
            setSettingsOpen(false);
            requestAnimationFrame(() => setHelpOpen(true));
          }}
        />
      )}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
      {creating && (
        <TaskComposer
          initialTitle={capture.initialTitle}
          projects={model.projects}
          tasks={model.tasks}
          attachments={attachments}
          defaultDate={mode === 'calendar' ? selectedDay : ''}
          defaultProjectId={projectScope ?? ''}
          defaultFocus={isHome ? today : ''}
          onAdd={add}
          onClose={capture.close}
        />
      )}
      {filesOpen && (
        <FileLibrary model={attachments} tasks={model.tasks} onClose={() => setFilesOpen(false)} />
      )}
      {commandOpen && (
        <CommandPalette
          tasks={model.tasks}
          projects={model.projects}
          today={today}
          onPick={pickCommand}
          onClose={() => setCommandOpen(false)}
        />
      )}
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
            clearUndo();
            openProject(project.id);
            setNotice(
              projectDialog.project ? 'Проект обновлён.' : 'Проект создан. Добавь первое дело.',
            );
          }}
          onRemove={async (id) => {
            await model.removeProject(id);
            clearUndo();
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
          attachments={attachments}
          onClose={closeTaskEditor}
          onSave={async (id, title, details, baseSteps, status) => {
            await model.edit(id, title, details, baseSteps, status);
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
          {(undoTasks.length > 0 || scheduleUndo.length > 0 || projectUndo.length > 0) && (
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
