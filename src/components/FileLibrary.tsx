import { useState } from 'react';
import type { Task } from '../domain/tasks.ts';
import { fileSize } from '../domain/attachments.ts';
import { useStorageSpace } from '../hooks/useStorageSpace.ts';
import type { Attachment } from '../domain/attachments.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { FilePreview } from './FilePreview.tsx';
import { Icon } from './Icon.tsx';
import { FileExamples } from './FileExamples.tsx';

export function FileLibrary({
  model,
  tasks,
  onClose,
}: {
  model: AttachmentModel;
  tasks: readonly Task[];
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const files = model.files.filter((file) =>
    file.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')),
  );
  const used = model.files.reduce((sum, file) => sum + file.size, 0);
  const space = useStorageSpace(used);
  return (
    <dialog
      ref={dialog}
      className="file-library-dialog"
      aria-labelledby="files-title"
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="section-caption">ЛОКАЛЬНАЯ БИБЛИОТЕКА</span>
          <h2 id="files-title">Файлы под рукой</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть библиотеку файлов"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <p className="files-privacy">
        Вложения остаются здесь даже после удаления задачи. Сохраняй полную резервную копию перед
        очисткой браузера.
      </p>
      <div className="file-capacity">
        <span>
          {model.files.length} файлов · {fileSize(used)} вложений
        </span>
        {space.quota !== undefined && space.usage !== undefined && (
          <progress value={space.usage} max={space.quota} aria-label="Место в браузере" />
        )}
        <small>
          {space.available !== undefined
            ? 'По оценке браузера доступно ' + fileSize(space.available)
            : 'Размер ограничен свободным местом и возможностями браузера'}
        </small>
        {!space.persisted && (
          <button type="button" className="text-button" onClick={() => void space.persist()}>
            Защитить локальные данные
          </button>
        )}
        {space.message && <p role="status">{space.message}</p>}
      </div>
      <input
        data-dialog-autofocus
        type="search"
        aria-label="Найти файл"
        placeholder="Название файла…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {(error || model.error) && (
        <p role="alert" className="input-error">
          {error || model.error}
        </p>
      )}
      {model.error && (
        <button type="button" className="secondary-button" onClick={() => void model.refresh()}>
          Повторить чтение файлов
        </button>
      )}
      <div className="file-library-body">
        {model.loading ? (
          <p role="status">Читаем файлы…</p>
        ) : !files.length ? (
          <p className="files-empty">
            {query
              ? 'Файлы с таким названием не найдены.'
              : 'Прикрепи первый файл в деталях задачи.'}
          </p>
        ) : (
          <ul className="attachment-list library-files">
            {files.map((file) => (
              <li key={file.id}>
                <button type="button" className="attachment-open" onClick={() => setPreview(file)}>
                  <Icon name="file" size={23} />
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {fileSize(file.size)} ·{' '}
                      {tasks.find((task) => task.id === file.taskId)?.title ??
                        'Задача удалена · файл сохранён'}
                    </small>
                  </span>
                </button>
                {removing === file.id ? (
                  <div className="file-remove-confirm">
                    <span>Без возможности отмены</span>
                    <button
                      type="button"
                      disabled={model.busy}
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
                      Удалить навсегда
                    </button>
                    <button type="button" onClick={() => setRemoving(null)}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Удалить файл навсегда: ${file.name}`}
                    disabled={model.busy}
                    onClick={() => setRemoving(file.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!query && <FileExamples />}
      </div>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </dialog>
  );
}
