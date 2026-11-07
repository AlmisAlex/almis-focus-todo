import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { MAX_TASKS, TaskInputError } from '../domain/tasks.ts';
import type { Task } from '../domain/tasks.ts';
import type { Project } from '../domain/projects.ts';
import { MAX_PROJECTS } from '../domain/projects.ts';
import type { Attachment } from '../domain/attachments.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { exportTasks } from '../storage/taskTransfer.ts';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  MAX_BACKUP_LENGTH,
} from '../storage/workspaceBackup.ts';
import { Icon } from './Icon.tsx';

export function TaskBackup({
  tasks,
  projects,
  attachments,
  today,
  busy,
  onRestore,
  onNotice,
  onError,
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
  ) => Promise<void>;
  onNotice: (text: string) => void;
  onError: (error: unknown) => void;
}) {
  const [imported, setImported] = useState<ReturnType<typeof importWorkspaceBackup> | null>(null);
  const [reading, setReading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
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
    if (unavailable) return;
    setExporting(true);
    try {
      const payload = attachments.error
        ? exportTasks(tasks, projects)
        : await exportWorkspaceBackup(tasks, projects, attachments.files);
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `focus-${today}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExportNotice(
        attachments.error
          ? 'Подготовлена копия задач и проектов без недоступных вложений.'
          : 'Полная копия задач, проектов и файлов подготовлена для скачивания.',
      );
    } catch {
      onError(
        new TaskInputError(
          'Не удалось подготовить копию. Проверь разрешения и свободную память браузера.',
        ),
      );
    } finally {
      setExporting(false);
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
      if (file.size > MAX_BACKUP_LENGTH)
        throw new TaskInputError('Копия слишком большая. Нужен JSON-файл FOCUS до 75 МБ.');
      setImported(importWorkspaceBackup(await file.text()));
    } catch (caught) {
      onError(caught);
    } finally {
      readingRef.current = false;
      setReading(false);
    }
  };
  const confirm = async () => {
    if (
      unavailable ||
      (!additions.length && !newProjects.length && !newFiles.length) ||
      tooManyTasks ||
      tooManyProjects
    )
      return;
    try {
      await onRestore(additions, newProjects, newFiles);
      restoreFocus.current = true;
      setImported(null);
      onNotice(
        `Добавлено задач: ${additions.length}, проектов: ${newProjects.length}, файлов: ${newFiles.length}. Совпавшие ID сохранены без замены.`,
      );
    } catch (caught) {
      // Separate browser stores: keep preview for an idempotent retry if files
      // fail after tasks were already merged. Existing IDs are never replaced.
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
            <small>
              Полная копия переносит проекты, задачи и все вложения, включая файлы удалённых задач.
            </small>
          </span>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void download()}
            disabled={
              unavailable ||
              attachments.loading ||
              (!tasks.length && !projects.length && !attachments.files.length)
            }
          >
            <Icon name="download" size={15} />
            {exporting ? 'Готовим копию…' : attachments.error ? 'Копия без файлов' : 'Полная копия'}
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
            accept=".json,application/json"
            onChange={read}
          />
        </div>
      </div>
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
      {imported && (
        <div
          className="import-preview"
          ref={preview}
          tabIndex={-1}
          role="region"
          aria-label="Подтверждение импорта"
        >
          <h3>Объединить с резервной копией?</h3>
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
                (!additions.length && !newProjects.length && !newFiles.length) ||
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
