import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_NOTES_LENGTH, MAX_TITLE_LENGTH, TaskInputError } from '../domain/tasks.ts';
import type { Priority, Task, TaskPatch, TaskStep } from '../domain/tasks.ts';
import { localDate } from '../domain/calendar.ts';
import { DateShortcuts } from './DateShortcuts.tsx';
import type { Project } from '../domain/projects.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { Icon } from './Icon.tsx';
import { TaskAttachments } from './TaskAttachments.tsx';
import type { AttachmentModel } from '../hooks/useAttachments.ts';

export function TaskEditor({
  task,
  projects,
  onSave,
  onClose,
  attachments,
}: {
  task: Task;
  projects: readonly Project[];
  onSave: (
    id: string,
    title: string | undefined,
    details: TaskPatch,
    baseSteps: readonly TaskStep[],
  ) => Promise<void>;
  onClose: () => void;
  attachments: AttachmentModel;
}) {
  const { dialog, trapTab } = useDialog();
  const [projectId, setProjectId] = useState(task.projectId ?? '');
  const [steps, setSteps] = useState<readonly TaskStep[]>(task.steps ?? []);
  const [focusDate, setFocusDate] = useState(task.focusDate ?? '');
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority ?? 'normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty =
    title !== task.title ||
    notes !== (task.notes ?? '') ||
    dueDate !== (task.dueDate ?? '') ||
    priority !== (task.priority ?? 'normal') ||
    projectId !== (task.projectId ?? '') ||
    JSON.stringify(steps) !== JSON.stringify(task.steps ?? []) ||
    focusDate !== (task.focusDate ?? '');
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [dirty]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave(
        task.id,
        title !== task.title ? title : undefined,
        {
          ...(notes !== (task.notes ?? '') ? { notes } : {}),
          ...(dueDate !== (task.dueDate ?? '') ? { dueDate } : {}),
          ...(priority !== (task.priority ?? 'normal') ? { priority } : {}),
          ...(projectId !== (task.projectId ?? '') ? { projectId } : {}),
          ...(JSON.stringify(steps) !== JSON.stringify(task.steps ?? []) ? { steps } : {}),
          ...(focusDate !== (task.focusDate ?? '') ? { focusDate } : {}),
        },
        task.steps ?? [],
      );
      onClose();
    } catch (caught) {
      setError(
        caught instanceof TaskInputError
          ? caught.message
          : 'Не удалось сохранить изменения. Попробуйте ещё раз.',
      );
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="task-dialog task-inspector"
      aria-labelledby="editor-title"
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit}>
        <header className="dialog-heading">
          <div>
            <span className="section-caption">ДЕТАЛИ ЗАДАЧИ</span>
            <h2 id="editor-title">Всё по полочкам</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={close}
            aria-label="Закрыть редактор"
            disabled={busy}
          >
            <Icon name="close" />
          </button>
        </header>
        <label className="field-label" htmlFor="edit-title">
          Что нужно сделать
        </label>
        <input
          data-dialog-autofocus
          id="edit-title"
          required
          maxLength={MAX_TITLE_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
        />
        <div className="inspector-context">
          <label className="field-label">
            Проект
            <select
              aria-label="Проект задачи"
              value={projects.some((project) => project.id === projectId) ? projectId : ''}
              disabled={busy}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Входящие</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label className="focus-switch">
            <input
              type="checkbox"
              checked={focusDate === localDate()}
              disabled={busy}
              onChange={(event) => setFocusDate(event.target.checked ? localDate() : '')}
            />
            В фокус на сегодня
          </label>
        </div>
        <label className="field-label" htmlFor="edit-notes">
          Заметка <span>необязательно</span>
        </label>
        <textarea
          id="edit-notes"
          rows={4}
          maxLength={MAX_NOTES_LENGTH}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Детали, ссылки или первый шаг…"
          disabled={busy}
        />
        <div className="editor-grid">
          <label className="field-label">
            Срок
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            Приоритет
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              disabled={busy}
            >
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="low">Низкий</option>
            </select>
          </label>
        </div>
        <DateShortcuts today={localDate()} value={dueDate} onChange={setDueDate} disabled={busy} />
        {dueDate && (
          <button
            className="text-button"
            type="button"
            onClick={() => setDueDate('')}
            disabled={busy}
          >
            Убрать срок
          </button>
        )}
        <ChecklistEditor steps={steps} onChange={setSteps} disabled={busy} />
        <TaskAttachments taskId={task.id} model={attachments} disabled={busy} />
        {error && (
          <p className="input-error" role="alert">
            {error}
          </p>
        )}
        {discard ? (
          <div className="discard-warning" role="alert">
            <p>Есть несохранённые изменения. Закрыть редактор?</p>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={() => setDiscard(false)}>
                Продолжить
              </button>
              <button type="button" className="danger-button" onClick={onClose}>
                Отбросить изменения
              </button>
            </div>
          </div>
        ) : (
          <footer className="dialog-footer">
            <button className="secondary-button" type="button" onClick={close} disabled={busy}>
              Отмена
            </button>
            <button className="primary-button" type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </footer>
        )}
      </form>
    </dialog>
  );
}
