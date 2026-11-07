import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_NOTES_LENGTH, MAX_TITLE_LENGTH, TaskInputError } from '../domain/tasks.ts';
import type { Priority, Task, TaskDetails } from '../domain/tasks.ts';
import { localDate } from '../domain/calendar.ts';
import { DateShortcuts } from './DateShortcuts.tsx';
import { Icon } from './Icon.tsx';

export function TaskEditor({
  task,
  onSave,
  onClose,
}: {
  task: Task;
  onSave: (id: string, title: string, details: TaskDetails) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
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
    priority !== (task.priority ?? 'normal');
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    titleInput.current?.focus();
    return () => element?.close();
  }, []);
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
      await onSave(task.id, title, { notes, dueDate, priority });
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
      className="task-dialog"
      aria-labelledby="editor-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])',
          ) ?? [],
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
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
          ref={titleInput}
          id="edit-title"
          required
          maxLength={MAX_TITLE_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
        />
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
