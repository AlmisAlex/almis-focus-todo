import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { MAX_TASKS, TaskInputError } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import { MAX_PROJECTS } from '../domain/projects.ts';
import type { Attachment } from '../domain/attachments.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  MAX_BACKUP_LENGTH,
} from '../storage/workspaceBackup.ts';
import { Icon } from './Icon.tsx';
import type { Planner } from '../domain/planner.ts';
import type { Journal } from '../domain/journal.ts';

export function TaskBackup({
  tasks,
  projects,
  attachments,
  today,
  busy,
  onRestore,
  onNotice,
  planner,
  journal,
  journalUnavailable,
}: {
  tasks: readonly Task[];
  projects: readonly Project[];
  attachments: AttachmentModel;
  today: string;
  busy: boolean;
  onRestore: (
    tasks: readonly Task[],
    projects: readonly Project[],
    files: readonly Attachment[],
    planner?: Planner,
    journal?: Journal,
  ) => Promise<void>;
  onNotice: (text: string) => void;
  planner?: Planner;
  journal?: Journal;
  journalUnavailable: boolean;
}) {
  const [imported, setImported] = useState<ReturnType<typeof importWorkspaceBackup> | null>(null);
  const [reading, setReading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [error, setError] = useState('');
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  const errorElement = useRef<HTMLParagraphElement>(null);
  const reportError = (caught: unknown) =>
    setError(
      caught instanceof TaskInputError
        ? caught.message
        : 'Не удалось обработать копию. Попробуй ещё раз.',
    );
  useLayoutEffect(() => {
    if (!error) return;
    errorElement.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    errorElement.current?.focus({ preventScroll: true });
  }, [error]);
  useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => setExportNotice(''), 8000);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);
  const readingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const additions =
    imported?.tasks.filter((task) => !tasks.some((existing) => existing.id === task.id)) ?? [];
  const newProjects =
    imported?.projects.filter(
      (project) => !projects.some((existing) => existing.id === project.id),
    ) ?? [];
  const newFiles =
    imported?.attachments.filter(
      (file) => !attachments.files.some((existing) => existing.id === file.id),
    ) ?? [];
  const unavailable = busy || reading || exporting || attachments.busy || attachments.loading;
  const tooManyTasks = tasks.length + additions.length > MAX_TASKS;
  const tooManyProjects = projects.length + newProjects.length > MAX_PROJECTS;
  useEffect(() => {
    if (imported) preview.current?.focus();
  }, [imported]);
  useLayoutEffect(() => {
    if (unavailable || !restoreFocus.current) return;
    restoreFocus.current = false;
    trigger.current?.focus();
  }, [unavailable, imported]);
  const download = async () => {
    if (unavailable || transfer.current) return;
    setError('');
    setExporting(true);
    const controller = new AbortController();
    transfer.current = controller;
    try {
      const files = attachments.error ? [] : attachments.files;
      const zipped =
        files.some((file) => file.size > 10 * 1024 * 1024) ||
        files.reduce((sum, file) => sum + file.size, 0) > 40 * 1024 * 1024;
      const payload = zipped
        ? await (
            await import('../storage/workspaceArchive.ts')
          ).exportWorkspaceArchive(tasks, projects, files, planner, journal, controller.signal)
        : new Blob([await exportWorkspaceBackup(tasks, projects, files, planner, journal)], {
            type: 'application/json',
          });
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(payload);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `focus-${today}.${zipped ? 'zip' : 'json'}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExportNotice(
        attachments.error
          ? 'Подготовлена копия задач и проектов без недоступных вложений.'
          : journalUnavailable
            ? 'Копия подготовлена без недоступного журнала комментариев.'
            : 'Полная копия задач, проектов, файлов и журнала подготовлена для скачивания.',
      );
    } catch {
      if (!controller.signal.aborted)
        reportError(
          new TaskInputError(
            'Не удалось подготовить копию. Проверь разрешения и свободную память браузера.',
          ),
        );
    } finally {
      if (transfer.current === controller) {
        transfer.current = null;
        setExporting(false);
      }
    }
  };
  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readingRef.current || transfer.current) return;
    readingRef.current = true;
    setReading(true);
    setError('');
    setImported(null);
    const controller = new AbortController();
    transfer.current = controller;
    try {
      const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (signature[0] === 0x50 && signature[1] === 0x4b) {
        const value = await (
          await import('../storage/workspaceArchive.ts')
        ).importWorkspaceArchive(file, controller.signal);
        controller.signal.throwIfAborted();
        setImported(value);
      } else {
        if (file.size > MAX_BACKUP_LENGTH)
          throw new TaskInputError('Копия слишком большая. Нужен JSON-файл FOCUS до 75 МБ.');
        const value = importWorkspaceBackup(await file.text());
        controller.signal.throwIfAborted();
        setImported(value);
      }
    } catch (caught) {
      if (!controller.signal.aborted) reportError(caught);
    } finally {
      if (transfer.current === controller) {
        transfer.current = null;
        readingRef.current = false;
        setReading(false);
      }
    }
  };
  const confirm = async () => {
    if (
      unavailable ||
      (!additions.length &&
        !newProjects.length &&
        !newFiles.length &&
        !imported?.planner &&
        !imported?.journal) ||
      tooManyTasks ||
      tooManyProjects
    )
      return;
    setError('');
    try {
      await onRestore(additions, newProjects, newFiles, imported?.planner, imported?.journal);
      restoreFocus.current = true;
      setImported(null);
      onNotice(
        `Добавлено задач: ${additions.length}, проектов: ${newProjects.length}, файлов: ${newFiles.length}. ${imported?.journal ? 'Журнал объединён. ' : ''}Совпавшие ID сохранены без замены.`,
      );
    } catch (caught) {
      // Separate browser stores: keep preview for an idempotent retry if files
      // fail after tasks were already merged. Existing IDs are never replaced.
      reportError(caught);
    }
  };
  return (
    <>
      <div className="backup-tools">
        <div>
          <Icon name="shield" size={17} />
          <span>
            Только в твоём браузере.
            <small>
              Копия переносит задачи, проекты, файлы, журнал и доступные настройки. Большие файлы —
              в ZIP, небольшая копия — в JSON.
            </small>
          </span>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void download()}
            disabled={unavailable || attachments.loading}
          >
            <Icon name="download" size={15} />
            {exporting
              ? 'Готовим копию…'
              : attachments.error
                ? 'Копия без файлов'
                : journalUnavailable
                  ? 'Копия без журнала'
                  : 'Полная копия'}
          </button>
          <button
            ref={trigger}
            type="button"
            className="secondary-button"
            disabled={unavailable}
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
            accept=".json,.zip,application/json,application/zip"
            onChange={read}
          />
          {(reading || exporting) && (
            <button type="button" className="text-button" onClick={() => transfer.current?.abort()}>
              Отменить подготовку
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="input-error backup-error" role="alert" tabIndex={-1} ref={errorElement}>
          {error}
        </p>
      )}
      {exportNotice && (
        <p className="backup-notice" role="status">
          {exportNotice}
        </p>
      )}
      {attachments.error && (
        <p className="input-error">
          Файлы сейчас недоступны: экспорт включает только задачи и проекты. {attachments.error}
        </p>
      )}
      {journalUnavailable && (
        <p className="input-error">
          Журнал комментариев недоступен: эта копия не включает его. Восстанови журнал в рабочем
          окне задачи, сохранив исходные данные.
        </p>
      )}
      {imported && (
        <div
          className="import-preview"
          ref={preview}
          tabIndex={-1}
          role="region"
          aria-label="Подтверждение импорта"
        >
          <h3>Объединить с резервной копией?</h3>
          {imported.planner && (
            <p>
              Оформление и настройки заменятся значениями из копии, история объединится. Текущий
              таймер сохранится; таймер из копии восстановится на паузе, если текущего нет.
            </p>
          )}
          {imported.journal && (
            <p>
              Записей в журнале: {imported.journal.entries.length}. Они объединятся по ID без замены
              существующих записей.
            </p>
          )}
          <p>
            Задач в файле: {imported.tasks.length}, новых: {additions.length}. Проектов:{' '}
            {imported.projects.length}, новых: {newProjects.length}. Файлов:{' '}
            {imported.attachments.length}, новых: {newFiles.length}. Совпадающие ID будут пропущены,
            текущие данные останутся.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={
                unavailable ||
                (!additions.length &&
                  !newProjects.length &&
                  !newFiles.length &&
                  !imported.planner &&
                  !imported.journal) ||
                tooManyTasks ||
                tooManyProjects
              }
              onClick={() => void confirm()}
            >
              Импортировать
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={unavailable}
              onClick={() => {
                setImported(null);
                trigger.current?.focus();
              }}
            >
              Отмена
            </button>
          </div>
          {tooManyTasks && (
            <p role="alert">Вместе больше {MAX_TASKS} задач. Сначала освободи место.</p>
          )}
          {tooManyProjects && (
            <p role="alert">Вместе больше {MAX_PROJECTS} проектов. Сначала освободи место.</p>
          )}
        </div>
      )}
    </>
  );
}
