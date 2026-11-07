import { useEffect, useRef, useState } from 'react';
import {
  taskDraft,
  draftDetails,
  validatePendingFiles,
  materializeDraft,
} from '../domain/taskDraft.ts';
import type { Task, TaskDetails } from '../domain/tasks.ts';
import { TaskInputError } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import { fileSize, safeFileName } from '../domain/attachments.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { TaskFields } from './TaskFields.tsx';
import { Icon } from './Icon.tsx';
import { FilePreview } from './FilePreview.tsx';
import type { Attachment } from '../domain/attachments.ts';

export function TaskComposer({
  projects,
  tasks,
  attachments,
  defaultDate = '',
  defaultProjectId = '',
  defaultFocus = '',
  onAdd,
  onClose,
}: {
  projects: readonly Project[];
  tasks: readonly Task[];
  attachments: AttachmentModel;
  defaultDate?: string;
  defaultProjectId?: string;
  defaultFocus?: string;
  onAdd: (title: string, details: TaskDetails) => Promise<string>;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [baseline] = useState(() =>
    taskDraft(undefined, {
      dueDate: defaultDate,
      projectId: defaultProjectId,
      focusDate: defaultFocus,
    }),
  );
  const [draft, setDraft] = useState(baseline),
    [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [discard, setDiscard] = useState(false),
    [savedId, setSavedId] = useState<string | null>(null);
  const working = useRef(false),
    input = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || files.length > 0;
  const savedTaskExists = !savedId || tasks.some((task) => task.id === savedId);
  const close = () => {
    if (busy) return;
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
      className="task-dialog task-create-dialog"
      aria-labelledby="create-title-heading"
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
          if (working.current) return;
          working.current = true;
          setBusy(true);
          setError('');
          try {
            if (!savedTaskExists)
              throw new TaskInputError(
                'Созданная задача удалена в другой вкладке. Закрой окно; неприкреплённые файлы остались у тебя на устройстве.',
              );
            validatePendingFiles(files, [...attachments.files]);
            const id = savedId ?? (await onAdd(draft.title, draftDetails(materializeDraft(draft))));
            setSavedId(id);
            if (files.length) await attachments.add(id, files);
            onClose();
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : 'Не удалось создать задачу. Попробуй ещё раз.',
            );
          } finally {
            working.current = false;
            setBusy(false);
          }
        }}
      >
        <header className="dialog-heading">
          <div>
            <span className="section-caption">СОЗДАНИЕ</span>
            <h2 id="create-title-heading">Новая задача</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Закрыть создание задачи"
            disabled={busy}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="task-dialog-body">
          <TaskFields
            prefix="create"
            draft={draft}
            onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))}
            projects={projects}
            disabled={busy || !!savedId}
          >
            <section className="task-attachments">
              <header>
                <h3>
                  <Icon name="paperclip" size={16} /> Вложения
                </h3>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  Прикрепить
                </button>
              </header>
              <p>Добавятся вместе с задачей. До 10 МБ на файл.</p>
              <input
                ref={input}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-label="Файлы новой задачи"
                disabled={busy}
                onChange={(event) => {
                  const incoming = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  try {
                    const next = [...files, ...incoming];
                    validatePendingFiles(next, [...attachments.files]);
                    setFiles(next);
                    setError('');
                  } catch (caught) {
                    setError(
                      caught instanceof TaskInputError
                        ? caught.message
                        : 'Не удалось добавить файлы.',
                    );
                  }
                }}
              />
              {!!files.length && (
                <ul className="pending-files">
                  {files.map((file, index) => (
                    <li key={index}>
                      <Icon name="file" size={16} />
                      <span>
                        <button
                          type="button"
                          className="pending-file-open"
                          disabled={busy}
                          onClick={() =>
                            setPreview({
                              id: `pending-${index}`,
                              taskId: 'pending',
                              name: safeFileName(file.name),
                              type: file.type,
                              size: file.size,
                              createdAt: Date.now(),
                              blob: file,
                            })
                          }
                        >
                          <strong>{safeFileName(file.name)}</strong>
                        </button>
                        <small>{fileSize(file.size)}</small>
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Убрать вложение: ${file.name}`}
                        disabled={busy}
                        onClick={() => setFiles((value) => value.filter((_, i) => i !== index))}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </TaskFields>
        </div>
        <footer className="dialog-footer">
          {savedId && error && (
            <p className="partial-create-warning" role="status">
              {savedTaskExists
                ? 'Задача уже создана. Повторная попытка прикрепит файлы к ней без дубликата.'
                : 'Задача удалена в другой вкладке. Черновик файлов не будет создавать её заново.'}
            </p>
          )}
          {!savedTaskExists && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSavedId(null);
                setError('');
              }}
            >
              Вернуться к черновику
            </button>
          )}
          {error && (
            <p className="input-error" role="alert">
              {error}
            </p>
          )}
          {discard ? (
            <div className="discard-warning" role="alert">
              <p>
                {savedId
                  ? savedTaskExists
                    ? 'Задача останется. Закрыть окно без неприкреплённых файлов?'
                    : 'Задача уже удалена. Закрыть окно без неприкреплённых файлов?'
                  : 'Закрыть окно и отбросить черновик задачи?'}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDiscard(false)}
                >
                  Продолжить
                </button>
                <button type="button" className="danger-button" onClick={onClose}>
                  {savedId ? 'Закрыть без файлов' : 'Отбросить черновик'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="save-keyboard-hint">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> создать
              </span>
              <div className="button-row">
                <button type="button" className="secondary-button" disabled={busy} onClick={close}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy || !draft.title.trim() || !savedTaskExists}
                >
                  <Icon name="plus" size={16} />
                  {busy ? 'Сохраняем…' : savedId ? 'Прикрепить и завершить' : 'Создать задачу'}
                </button>
              </div>
            </>
          )}
        </footer>
      </form>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </dialog>
  );
}
