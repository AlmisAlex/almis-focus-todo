import { useEffect, useState } from 'react';
import type { Task, TaskStatus } from '../domain/tasks.ts';
import { taskStatus } from '../domain/tasks.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import type { JournalModel } from '../hooks/useJournal.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { TaskActivity } from './TaskActivity.tsx';
import { JournalComposer } from './JournalComposer.tsx';
import { TaskAttachments } from './TaskAttachments.tsx';
import { NoteContent } from './NoteContent.tsx';
import { JournalRecovery } from './JournalRecovery.tsx';
import { Icon } from './Icon.tsx';

export function TaskWorkspace({
  task,
  journal,
  attachments,
  busy,
  error,
  missing = false,
  focusBusy,
  onStep,
  onStatus,
  onEdit,
  onFocus,
  onClose,
}: {
  task: Task;
  journal: JournalModel;
  attachments: AttachmentModel;
  busy: boolean;
  error: string;
  missing?: boolean;
  focusBusy: boolean;
  onStep: (id: string, stepId: string, done: boolean) => void;
  onStatus: (id: string, status: TaskStatus) => void;
  onEdit: () => void;
  onFocus: () => void;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const [selected, setSelected] = useState('');
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState<{ step: string } | { close: true } | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  useEffect(() => {
    if (!dirty) setDiscard(null);
  }, [dirty]);
  const steps = task.steps ?? [];
  const done = steps.filter((s) => s.completed).length;
  const choose = (id: string) => {
    if (journal.isWorking || attachments.busy || id === selected) return;
    if (dirty) setDiscard({ step: id });
    else setSelected(id);
  };
  const close = () => {
    if (journal.isWorking || attachments.busy) return;
    if (dirty) setDiscard({ close: true });
    else onClose();
  };
  const entries = journal.data.entries.filter(
    (e) => e.taskId === task.id && (!selected || e.stepId === selected),
  );
  return (
    <dialog
      ref={dialog}
      className="task-workspace-dialog"
      aria-labelledby="work-title"
      onKeyDown={trapTab}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="section-caption">РАБОТА НАД ЗАДАЧЕЙ</span>
          <h2 id="work-title">{task.title}</h2>
          <div className="work-header-meta">
            <select
              aria-label="Статус открытой задачи"
              value={taskStatus(task)}
              disabled={busy || missing}
              onChange={(e) => onStatus(task.id, e.target.value as TaskStatus)}
            >
              <option value="todo">Запланировано</option>
              <option value="doing">В процессе</option>
              <option value="done">Готово</option>
            </select>
            <span>
              {done} / {steps.length} шагов
            </span>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть рабочее окно"
          disabled={journal.isWorking || attachments.busy}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="work-action-bar">
        <button
          type="button"
          className="secondary-button"
          disabled={busy || missing}
          onClick={onEdit}
        >
          <Icon name="edit" size={16} />
          Редактировать
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={missing || task.completed || focusBusy}
          onClick={onFocus}
        >
          <Icon name="timer" size={16} />
          {focusBusy ? 'Запускаем…' : 'Фокус на задаче'}
        </button>
        {!!steps.length && (
          <button
            type="button"
            className="text-button"
            disabled={!steps.some((s) => !s.completed)}
            onClick={() => {
              const next = steps.find((s) => !s.completed);
              if (next) choose(next.id);
            }}
          >
            Следующий шаг <Icon name="arrow" size={14} />
          </button>
        )}
      </div>
      {discard && (
        <div className="work-discard" role="alert">
          <p>В комментарии есть несохранённый текст или файлы.</p>
          <button type="button" className="secondary-button" onClick={() => setDiscard(null)}>
            Продолжить запись
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              setDirty(false);
              setComposerKey((n) => n + 1);
              if ('close' in discard) onClose();
              else setSelected(discard.step);
              setDiscard(null);
            }}
          >
            Отбросить черновик
          </button>
        </div>
      )}
      {missing && (
        <p role="alert" className="input-error">
          Задача удалена в другой вкладке. Черновик оставлен здесь: новые записи можно сохранить в
          журнале удалённых задач.
        </p>
      )}
      <div className="task-workspace-body">
        <aside className="work-outline">
          <button
            type="button"
            className="work-scope-button"
            aria-pressed={!selected}
            onClick={() => choose('')}
          >
            Вся задача{' '}
            <span>{journal.data.entries.filter((e) => e.taskId === task.id).length}</span>
          </button>
          {!!steps.length && (
            <>
              <h3>Шаги</h3>
              <progress value={done} max={steps.length} aria-label="Готовность шагов" />
              <ul className="work-steps">
                {steps.map((step, index) => (
                  <li key={step.id} data-active={selected === step.id}>
                    <input
                      type="checkbox"
                      checked={step.completed}
                      disabled={busy || missing}
                      aria-label={'Выполнить шаг: ' + step.title}
                      onChange={(e) => onStep(task.id, step.id, e.target.checked)}
                    />
                    <button
                      type="button"
                      aria-pressed={selected === step.id}
                      onClick={() => choose(step.id)}
                    >
                      <small>{String(index + 1).padStart(2, '0')}</small>
                      <span>{step.title}</span>
                      <em>
                        {
                          journal.data.entries.filter(
                            (e) => e.taskId === task.id && e.stepId === step.id,
                          ).length
                        }
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!!task.notes && (
            <details className="work-description" open>
              <summary>Описание</summary>
              <NoteContent text={task.notes} />
            </details>
          )}
          <details className="work-files">
            <summary>
              Все файлы задачи · {attachments.files.filter((f) => f.taskId === task.id).length}
            </summary>
            <TaskAttachments taskId={task.id} model={attachments} disabled={busy || missing} />
          </details>
        </aside>
        <section className="work-journal">
          <header>
            <span className="section-caption">
              {selected ? 'ВЫБРАННЫЙ ШАГ' : 'ЗАМЕТКИ И МАТЕРИАЛЫ'}
            </span>
            <h3>
              {selected
                ? (steps.find((s) => s.id === selected)?.title ?? 'Прежний шаг')
                : 'Ход работы'}
            </h3>
          </header>
          {(error || journal.error) && (
            <p role="alert" className="input-error">
              {error || journal.error}
            </p>
          )}
          <JournalRecovery journal={journal} />
          <JournalComposer
            key={composerKey}
            taskId={task.id}
            stepId={selected}
            taskTitle={task.title}
            stepTitle={steps.find((step) => step.id === selected)?.title ?? ''}
            journal={journal}
            attachments={attachments}
            onDirty={setDirty}
          />
          <TaskActivity
            entries={entries}
            files={attachments.files}
            steps={steps}
            onRemove={(id) => journal.dispatch({ type: 'remove', id })}
          />
        </section>
      </div>
    </dialog>
  );
}
