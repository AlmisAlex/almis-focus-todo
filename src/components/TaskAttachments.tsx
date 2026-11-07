import { useRef, useState } from 'react';
import type { Attachment } from '../domain/attachments.ts';
import { fileSize } from '../domain/attachments.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { FilePreview } from './FilePreview.tsx';
import { Icon } from './Icon.tsx';

export function TaskAttachments({
  taskId,
  model,
  disabled,
}: {
  taskId: string;
  model: AttachmentModel;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const files = model.files.filter((file) => file.taskId === taskId);
  const busy = disabled || model.busy || model.loading;
  return (
    <section className="task-attachments" aria-label="Вложения задачи">
      <header>
        <h3>
          <Icon name="paperclip" size={16} /> Вложения <span>{files.length}</span>
        </h3>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Прикрепить файл
        </button>
      </header>
      <p>
        Любой формат · до 10 МБ на файл. Вложения сохраняются сразу, отдельно от черновика задачи.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Прикрепить файлы к задаче"
        disabled={busy}
        onChange={async (event) => {
          const incoming = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (!incoming.length) return;
          try {
            setError('');
            await model.add(taskId, incoming);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Не удалось прикрепить файл.');
          }
        }}
      />
      {!!files.length && (
        <ul className="attachment-list">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className="attachment-open"
                disabled={busy}
                onClick={() => setPreview(file)}
              >
                <Icon name="file" size={19} />
                <span>
                  <strong>{file.name}</strong>
                  <small>{fileSize(file.size)}</small>
                </span>
              </button>
              {removing === file.id ? (
                <div className="file-remove-confirm">
                  <span>Удалить навсегда?</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        await model.remove(file.id);
                        setRemoving(null);
                      } catch (caught) {
                        setError(
                          caught instanceof Error ? caught.message : 'Не удалось удалить файл.',
                        );
                      }
                    }}
                  >
                    Удалить
                  </button>
                  <button type="button" onClick={() => setRemoving(null)}>
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="icon-button"
                  disabled={busy}
                  aria-label={`Удалить файл: ${file.name}`}
                  onClick={() => setRemoving(file.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(error || model.error) && (
        <p role="alert" className="input-error">
          {error || model.error}
        </p>
      )}
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
