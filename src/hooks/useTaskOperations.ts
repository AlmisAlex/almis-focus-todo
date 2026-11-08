import { useEffect, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { useTasks } from './useTasks.ts';
import type { Task, DateChange, TaskStatus } from '../domain/tasks.ts';
import { TaskInputError } from '../domain/tasks.ts';
import { formatDay } from '../domain/calendar.ts';
import type { TaskView } from '../domain/taskQueries.ts';
import type { ProjectChange } from '../domain/workspace.ts';

type Options = {
  model: ReturnType<typeof useTasks>;
  visible: readonly Task[];
  selectedTasks: readonly Task[];
  busy: boolean;
  today: string;
  mode: 'list' | 'calendar';
  input: RefObject<HTMLButtonElement | null>;
  pendingFocus: RefObject<number | null>;
  pendingStepFocus: RefObject<{ id: string; stepId: string } | null>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  setSelecting: Dispatch<SetStateAction<boolean>>;
  setSelectedDay: Dispatch<SetStateAction<string>>;
  setMode: Dispatch<SetStateAction<'list' | 'calendar'>>;
  setFilter: Dispatch<SetStateAction<TaskView>>;
};

/** Mutation feedback and undo. Persistence stays in useTasks; layout stays in App. */
export function useTaskOperations({
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
}: Options) {
  const [scheduleUndo, setScheduleUndo] = useState<readonly DateChange[]>([]);
  const [projectUndo, setProjectUndo] = useState<readonly ProjectChange[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticePaused, setNoticePaused] = useState(false);
  const [undoTasks, setUndoTasks] = useState<readonly Task[]>([]);
  useEffect(() => {
    if (!notice || noticePaused || undoTasks.length || scheduleUndo.length || projectUndo.length)
      return;
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice, noticePaused, undoTasks, scheduleUndo, projectUndo]);
  const reportError = (caught: unknown) =>
    setError(
      caught instanceof TaskInputError
        ? caught.message
        : 'Не удалось изменить список. Попробуйте ещё раз.',
    );
  const clearUndo = () => {
    setUndoTasks([]);
    setScheduleUndo([]);
    setProjectUndo([]);
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
      setProjectUndo([]);
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
      else if (projectUndo.length) await model.changeProjects(projectUndo);
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
        projectUndo.length
          ? 'Прежние проекты возвращены там, где их не меняли позже.'
          : scheduleUndo.length
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
  const moveSelected = async (projectId: string) => {
    if (busy || !selectedTasks.length) return;
    const previous = selectedTasks.map((task) => ({
      id: task.id,
      projectId: task.projectId ?? '',
      expectedProjectId: projectId,
    }));
    try {
      await model.changeProjects(selectedTasks.map((task) => ({ id: task.id, projectId })));
      clearUndo();
      setProjectUndo(previous);
      setSelected(new Set());
      setSelecting(false);
      setNotice('Выбранные задачи перенесены. Можно отменить.');
      setError('');
      input.current?.focus();
    } catch (caught) {
      reportError(caught);
    }
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
  const changeStep = async (id: string, stepId: string, value: boolean) => {
    if (busy) return;
    try {
      pendingStepFocus.current = { id, stepId };
      await model.setStep(id, stepId, value);
      setError('');
    } catch (caught) {
      reportError(caught);
    }
  };
  const changeStatus = async (id: string, status: TaskStatus) => {
    if (busy) return false;
    try {
      pendingFocus.current = Math.max(
        0,
        visible.findIndex((task) => task.id === id),
      );
      await model.setStatus(id, status);
      setError('');
      clearUndo();
      setNotice('Статус изменён.');
      return true;
    } catch (caught) {
      pendingFocus.current = null;
      reportError(caught);
      return false;
    }
  };
  return {
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
  };
}
