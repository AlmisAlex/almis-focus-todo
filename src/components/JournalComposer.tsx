import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '../domain/attachments.ts';
import { safeFileName } from '../domain/attachments.ts';
import { MAX_ENTRY_TEXT } from '../domain/journal.ts';
import type { JournalEntry } from '../domain/journal.ts';
import { newId } from '../domain/ids.ts';
import type { JournalModel } from '../hooks/useJournal.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { DrawingPad } from './DrawingPad.tsx';
import { Icon } from './Icon.tsx';

export function JournalComposer({
  taskId,
  stepId,
  taskTitle,
  stepTitle,
  journal,
  attachments,
  onDirty,
  disabled = false,
}: {
  taskId: string;
  stepId: string;
  taskTitle: string;
  stepTitle: string;
  journal: JournalModel;
  attachments: AttachmentModel;
  onDirty: (dirty: boolean) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const prepared = useRef<JournalEntry[] | null>(null);
  const dirty = !!text.trim() || files.length > 0 || drawing;
  useEffect(() => {
    onDirty(dirty);
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, onDirty]);
  const stage = (incoming: readonly File[]) => {
    if (files.length + incoming.length > 10) {
      setError('За один раз можно добавить до 10 файлов.');
      return false;
    }
    prepared.current = null;
    setFiles((previous) => [
      ...previous,
      ...incoming.map((file) => ({
        id: newId(),
        taskId,
        name: safeFileName(file.name),
        type: file.type,
        size: file.size,
        createdAt: Date.now(),
        blob: file,
      })),
    ]);
    return true;
  };
  return (
    <form
      className="journal-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || disabled || !dirty) return;
        setBusy(true);
        setError('');
        try {
          if (!prepared.current) {
            const at = Date.now();
            const meta = { taskTitle, stepTitle };
            prepared.current = [
              ...(text.trim()
                ? [{ id: newId(), taskId, stepId, at, text: text.trim(), ...meta }]
                : []),
              ...files.map((file) => ({
                id: newId(),
                taskId,
                stepId,
                ...meta,
                at,
                text: file.name,
                fileId: file.id,
              })),
            ];
          }
          if (files.length) await attachments.import(files);
          if (!(await journal.dispatch({ type: 'append', entries: prepared.current })))
            throw Error(
              files.length
                ? 'Файлы уже сохранены. Запись журнала не сохранена — повтори отправку.'
                : 'Комментарий пока не сохранён. Повтори отправку.',
            );
          prepared.current = null;
          setText('');
          setFiles([]);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Не удалось добавить запись.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="work-comment" className="field-label">
        {stepId ? 'Комментарий к шагу' : 'Комментарий к задаче'}
      </label>
      <textarea
        id="work-comment"
        value={text}
        maxLength={MAX_ENTRY_TEXT}
        disabled={busy || disabled}
        onChange={(e) => {
          prepared.current = null;
          setText(e.target.value);
        }}
        placeholder="Что сделано, что осталось, важная мысль…"
        rows={4}
      />
      <div className="journal-tools">
        <label className="secondary-button">
          <Icon name="paperclip" size={16} />
          Файл
          <input
            type="file"
            multiple
            className="sr-only"
            aria-label="Файлы к комментарию"
            disabled={busy || disabled}
            onChange={(e) => {
              stage(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || disabled}
          onClick={() => {
            prepared.current = null;
            setText((value) =>
              (
                value +
                '\n\n| Пункт | Статус |\n| --- | --- |\n| Первый этап | В работе |\n| Следующий этап | Запланировано |\n'
              ).slice(0, MAX_ENTRY_TEXT),
            );
          }}
        >
          Таблица
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || disabled || files.length >= 10}
          onClick={() => setDrawing(true)}
        >
          Нарисовать
        </button>
        <span>
          {text.length}/{MAX_ENTRY_TEXT}
        </span>
      </div>
      {!!files.length && (
        <ul className="staged-work-files">
          {files.map((file) => (
            <li key={file.id}>
              <Icon name="file" size={16} />
              <span>{file.name}</span>
              <button
                type="button"
                disabled={busy || disabled}
                aria-label={'Убрать из комментария: ' + file.name}
                onClick={() => {
                  prepared.current = null;
                  setFiles((previous) => previous.filter((f) => f.id !== file.id));
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="input-error">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={busy || disabled || !dirty}>
        {busy ? 'Сохраняем…' : 'Добавить запись'}
      </button>
      {drawing && (
        <DrawingPad
          onClose={() => setDrawing(false)}
          onSave={(file) => {
            const added = stage([file]);
            if (added) setDrawing(false);
            return added;
          }}
        />
      )}
    </form>
  );
}
