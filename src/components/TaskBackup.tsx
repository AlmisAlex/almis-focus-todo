import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { MAX_TASKS, TaskInputError } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import { exportTasks, importTasks } from '../storage/taskTransfer.ts';
import { MAX_PAYLOAD_LENGTH } from '../storage/taskStorage.ts';
import { Icon } from './Icon.tsx';

export function TaskBackup({
  tasks,
  today,
  busy,
  onRestore,
  onNotice,
  onError,
}: {
  tasks: readonly Task[];
  today: string;
  busy: boolean;
  onRestore: (tasks: readonly Task[]) => Promise<void>;
  onNotice: (text: string) => void;
  onError: (error: unknown) => void;
}) {
  const [imported, setImported] = useState<Task[] | null>(null);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const additions =
    imported?.filter((task) => !tasks.some((existing) => existing.id === task.id)) ?? [];
  useEffect(() => {
    if (imported) preview.current?.focus();
  }, [imported]);
  useLayoutEffect(() => {
    if (busy || reading || !restoreFocus.current) return;
    restoreFocus.current = false;
    trigger.current?.focus();
  }, [busy, reading, imported]);
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportTasks(tasks)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `focus-${today}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onNotice('Резервная копия подготовлена для скачивания.');
    } catch {
      onError(
        new TaskInputError('Не удалось подготовить копию. Проверь разрешения на скачивание.'),
      );
    }
  };
  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readingRef.current) return;
    readingRef.current = true;
    setReading(true);
    setImported(null);
    try {
      if (file.size > MAX_PAYLOAD_LENGTH * 4)
        throw new TaskInputError('Файл слишком большой. Нужна резервная копия FOCUS.');
      setImported(importTasks(await file.text()));
    } catch (caught) {
      onError(caught);
    } finally {
      readingRef.current = false;
      setReading(false);
    }
  };
  const cancel = () => {
    setImported(null);
    trigger.current?.focus();
  };
  const confirm = async () => {
    if (!additions.length || busy || reading) return;
    try {
      await onRestore(additions);
      restoreFocus.current = true;
      setImported(null);
      onNotice(`Добавлено из копии: ${additions.length}. Существующие задачи сохранены.`);
    } catch (caught) {
      onError(caught);
    }
  };
  return (
    <>
      <div className="backup-tools">
        <div>
          <Icon name="shield" size={17} />
          <span>
            Только в твоём браузере.
            <small>Копия поможет перенести задачи или сохранить их перед очисткой данных.</small>
          </span>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={download}
            disabled={!tasks.length || busy}
          >
            <Icon name="download" size={15} /> Экспорт
          </button>
          <button
            ref={trigger}
            type="button"
            className="secondary-button"
            disabled={busy || reading}
            onClick={() => fileInput.current?.click()}
          >
            {reading ? 'Читаем…' : 'Импорт'}
          </button>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            tabIndex={-1}
            aria-label="Файл резервной копии"
            accept=".json,application/json"
            onChange={read}
          />
        </div>
      </div>
      {imported && (
        <div
          className="import-preview"
          ref={preview}
          tabIndex={-1}
          role="region"
          aria-label="Подтверждение импорта"
        >
          <h3>Добавить задачи из копии?</h3>
          <p>
            В файле: {imported.length}. Новых задач: {additions.length}. Совпадающие ID будут
            пропущены, текущие задачи останутся.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={busy || !additions.length || tasks.length + additions.length > MAX_TASKS}
              onClick={confirm}
            >
              Добавить {additions.length}
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={cancel}>
              Отмена
            </button>
          </div>
          {tasks.length + additions.length > MAX_TASKS && (
            <p role="alert">Вместе больше {MAX_TASKS} задач. Сначала освободи место.</p>
          )}
        </div>
      )}
    </>
  );
}
