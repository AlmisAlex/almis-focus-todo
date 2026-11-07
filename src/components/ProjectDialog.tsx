import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_PROJECT_TITLE, PROJECT_COLORS } from '../domain/projects.ts';
import type { Project, ProjectColor } from '../domain/projects.ts';
import { TaskInputError } from '../domain/tasks.ts';
import { newId } from '../domain/ids.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { Icon } from './Icon.tsx';

export function ProjectDialog({
  project,
  taskCount,
  onSave,
  onRemove,
  onClose,
}: {
  project: Project | null;
  taskCount: number;
  onSave: (project: Project) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const [title, setTitle] = useState(project?.title ?? '');
  const [color, setColor] = useState<ProjectColor>(project?.color ?? 'violet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const [remove, setRemove] = useState(false);
  const dirty = title !== (project?.title ?? '') || color !== (project?.color ?? 'violet');
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof TaskInputError
          ? caught.message
          : 'Не удалось сохранить проект. Попробуй ещё раз.',
      );
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) void run(() => onSave({ id: project?.id ?? newId(), title, color }));
  };
  return (
    <dialog
      ref={dialog}
      className="task-dialog project-dialog"
      aria-labelledby="project-title"
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit}>
        <header className="dialog-heading">
          <div>
            <span className="section-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <h2 id="project-title">{project ? 'Настроить проект' : 'Новый проект'}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            onClick={close}
            aria-label="Закрыть проект"
          >
            <Icon name="close" />
          </button>
        </header>
        <p className="project-dialog-copy">
          Объедини связанные дела — рабочие, личные или для одной большой цели.
        </p>
        <label className="field-label" htmlFor="project-name">
          Название проекта
        </label>
        <input
          data-dialog-autofocus
          id="project-name"
          value={title}
          maxLength={MAX_PROJECT_TITLE}
          required
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например, запуск нового проекта"
        />
        <div className="project-color-picker" role="group" aria-label="Цвет проекта">
          {PROJECT_COLORS.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`project-color project-color--${item}`}
              aria-label={`Цвет ${['лавандовый', 'синий', 'зелёный', 'янтарный', 'розовый'][index]}`}
              aria-pressed={color === item}
              disabled={busy}
              onClick={() => setColor(item)}
            >
              <span />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="input-error">
            {error}
          </p>
        )}
        {remove && project ? (
          <div className="discard-warning" role="alert">
            <p>
              Удалить проект «{project.title}»? Его задачи ({taskCount}) останутся во «Входящих».
            </p>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setRemove(false)}
              >
                Оставить проект
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => void run(() => onRemove(project.id))}
              >
                Сохранить задачи и удалить
              </button>
            </div>
          </div>
        ) : discard ? (
          <div className="discard-warning" role="alert">
            <p>Закрыть без сохранения изменений?</p>
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
            {project && (
              <button
                type="button"
                className="text-button project-delete"
                disabled={busy}
                onClick={() => setRemove(true)}
              >
                Удалить проект
              </button>
            )}
            <button type="button" className="secondary-button" disabled={busy} onClick={close}>
              Отмена
            </button>
            <button type="submit" className="primary-button" disabled={busy || !title.trim()}>
              {busy ? 'Сохраняем…' : project ? 'Сохранить проект' : 'Создать проект'}
            </button>
          </footer>
        )}
      </form>
    </dialog>
  );
}
