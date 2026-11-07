import { useEffect, useRef, useState } from 'react';
import type { Task, TaskPatch, TaskStep, TaskStatus } from '../domain/tasks.ts';
import { TaskInputError } from '../domain/tasks.ts';
import { taskDraft, draftChanges, materializeDraft } from '../domain/taskDraft.ts';
import type { Project } from '../domain/projects.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { TaskFields } from './TaskFields.tsx';
import { TaskAttachments } from './TaskAttachments.tsx';
import { Icon } from './Icon.tsx';

export function TaskEditor({
  task,
  projects,
  attachments,
  onSave,
  onClose,
}: {
  task: Task;
  projects: readonly Project[];
  attachments: AttachmentModel;
  onSave: (
    id: string,
    title: string | undefined,
    details: TaskPatch,
    baseSteps: readonly TaskStep[],
    status?: TaskStatus,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const working = useRef(false);
  const [baseline] = useState(() => taskDraft(task));
  const [draft, setDraft] = useState(baseline);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const close = () => {
    if (busy || attachments.busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  return (
    <dialog
      ref={dialog}
      className="task-dialog task-editor-dialog"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={trapTab}
    >
      <form
        className="task-form"
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (working.current || attachments.busy) return;
          working.current = true;
          setBusy(true);
          setError('');
          try {
            const changes = draftChanges(baseline, materializeDraft(draft));
            await onSave(task.id, changes.title, changes.details, baseline.steps, changes.status);
            onClose();
          } catch (caught) {
            setError(
              caught instanceof TaskInputError
                ? caught.message
                : 'Не удалось сохранить задачу. Попробуй ещё раз.',
            );
            setBusy(false);
            working.current = false;
          }
        }}
      >
        <header className="dialog-heading">
          <div>
            <span className="section-caption">ЗАДАЧА</span>
            <h2 id="editor-title">Детали задачи</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Закрыть редактор"
            onClick={close}
            disabled={busy || attachments.busy}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="task-dialog-body">
          <TaskFields
            draft={draft}
            onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))}
            projects={projects}
            disabled={busy}
            prefix="edit"
          >
            <TaskAttachments taskId={task.id} model={attachments} disabled={busy} />
          </TaskFields>
        </div>
        <footer className="dialog-footer">
          {error && (
            <p className="input-error" role="alert">
              {error}
            </p>
          )}
          {discard ? (
            <div className="discard-warning" role="alert">
              <p>Закрыть без сохранения изменений?</p>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDiscard(false)}
                >
                  Продолжить
                </button>
                <button type="button" className="danger-button" onClick={onClose}>
                  Отбросить изменения
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="save-keyboard-hint">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> сохранить
              </span>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || attachments.busy}
                  onClick={close}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy || attachments.busy || !draft.title.trim()}
                >
                  {busy ? 'Сохраняем…' : 'Сохранить изменения'}
                </button>
              </div>
            </>
          )}
        </footer>
      </form>
    </dialog>
  );
}
