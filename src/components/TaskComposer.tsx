import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject, FormEvent } from 'react';
import { MAX_TITLE_LENGTH } from '../domain/tasks.ts';
import type { Priority, TaskDetails } from '../domain/tasks.ts';
import { localDate, formatDay } from '../domain/calendar.ts';
import { DateShortcuts } from './DateShortcuts.tsx';
import type { Project } from '../domain/projects.ts';
import { Icon } from './Icon.tsx';

export function TaskComposer({
  inputRef,
  busy,
  onAdd,
  defaultDate = '',
  projects = [],
  defaultProjectId = '',
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  defaultDate?: string;
  projects?: readonly Project[];
  defaultProjectId?: string;
  onAdd: (title: string, details: TaskDetails) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const projectTouched = useRef(false);
  useEffect(() => {
    if (!title && !projectTouched.current) setProjectId(defaultProjectId);
  }, [defaultProjectId, title]);
  const [expanded, setExpanded] = useState(false);
  const [dueDate, setDueDate] = useState(defaultDate);
  const dateTouched = useRef(false);
  const [priority, setPriority] = useState<Priority>('normal');
  const [submitting, setSubmitting] = useState(false);
  const focusAfterSubmit = useRef(false);
  const disabled = busy || submitting;
  useLayoutEffect(() => {
    if (disabled || !focusAfterSubmit.current) return;
    focusAfterSubmit.current = false;
    inputRef.current?.focus();
  }, [disabled, inputRef]);
  useEffect(() => {
    if (!title && !dateTouched.current) setDueDate(defaultDate);
  }, [defaultDate, title]);
  const chooseDate = (value: string) => {
    dateTouched.current = true;
    setDueDate(value);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !title.trim()) return;
    setSubmitting(true);
    try {
      if (await onAdd(title, { notes: '', dueDate, priority, projectId })) {
        setTitle('');
        projectTouched.current = false;
        setProjectId(defaultProjectId);
        dateTouched.current = false;
        setDueDate(defaultDate);
        setPriority('normal');
        focusAfterSubmit.current = true;
      }
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="composer-card">
      <form onSubmit={submit}>
        <div className="composer">
          <span className="composer-plus" aria-hidden="true">
            <Icon name="plus" size={22} />
          </span>
          <label className="sr-only" htmlFor="new-task">
            Новая задача
          </label>
          <input
            id="new-task"
            aria-keyshortcuts="Alt+N"
            ref={inputRef}
            type="text"
            autoComplete="off"
            maxLength={MAX_TITLE_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Что нужно сделать?"
            aria-describedby="composer-hint"
            disabled={disabled}
          />
          <button className="primary-button" type="submit" disabled={disabled || !title.trim()}>
            <span>Добавить</span>
            <Icon name="arrow" size={18} />
          </button>
        </div>
        <div className="composer-hint" id="composer-hint">
          <span>
            <kbd>Enter</kbd> добавить <span className="hint-separator">·</span> <kbd>Alt N</kbd>{' '}
            новая задача
          </span>
          <button
            type="button"
            className="details-toggle"
            aria-expanded={expanded}
            aria-controls="composer-options"
            onClick={() => setExpanded(!expanded)}
          >
            Срок и приоритет <span aria-hidden="true">{expanded ? '−' : '+'}</span>
          </button>
        </div>
        <label className="composer-project">
          <Icon name="folder" size={14} />
          <span className="sr-only">Проект новой задачи</span>
          <select
            aria-label="Проект новой задачи"
            value={projects.some((project) => project.id === projectId) ? projectId : ''}
            disabled={disabled}
            onChange={(event) => {
              projectTouched.current = true;
              setProjectId(event.target.value);
            }}
          >
            <option value="">Входящие</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        {dueDate && (
          <p className="composer-schedule">
            Срок новой задачи: <strong>{formatDay(dueDate)}</strong>
          </p>
        )}
        {expanded && (
          <div className="composer-options" id="composer-options">
            <label>
              Срок
              <input
                type="date"
                min="1900-01-01"
                max="9999-12-31"
                value={dueDate}
                onChange={(event) => chooseDate(event.target.value)}
                disabled={disabled}
              />
            </label>
            <label>
              Приоритет
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                disabled={disabled}
              >
                <option value="normal">Обычный</option>
                <option value="high">Высокий</option>
                <option value="low">Низкий</option>
              </select>
            </label>
            <DateShortcuts
              today={localDate()}
              value={dueDate}
              onChange={chooseDate}
              disabled={disabled}
            />
          </div>
        )}
      </form>
    </div>
  );
}
