import type { ReactNode } from 'react';
import type { TaskDraft } from '../domain/taskDraft.ts';
import { draftWithStatus } from '../domain/taskDraft.ts';
import type { Project } from '../domain/projects.ts';
import type { Priority, TaskStatus, Recurrence } from '../domain/tasks.ts';
import { MAX_TITLE_LENGTH, MAX_NOTES_LENGTH } from '../domain/tasks.ts';
import { localDate } from '../domain/calendar.ts';
import { ChecklistEditor } from './ChecklistEditor.tsx';
import { DateShortcuts } from './DateShortcuts.tsx';
import { Icon } from './Icon.tsx';

export function TaskFields({
  draft,
  onChange,
  projects,
  disabled,
  prefix,
  children,
}: {
  draft: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  projects: readonly Project[];
  disabled: boolean;
  prefix: 'edit' | 'create';
  children?: ReactNode;
}) {
  return (
    <>
      <div className="task-edit-main">
        <label className="field-label" htmlFor={`${prefix}-title`}>
          Что нужно сделать
        </label>
        <textarea
          data-dialog-autofocus
          id={`${prefix}-title`}
          className="task-title-input"
          required
          rows={2}
          maxLength={MAX_TITLE_LENGTH}
          value={draft.title}
          disabled={disabled}
          placeholder="Например, подготовить презентацию проекта"
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <div className="field-hint">
          <span>Одна задача — один понятный результат</span>
          <span>
            {draft.title.length}/{MAX_TITLE_LENGTH}
          </span>
        </div>
        <label className="field-label" htmlFor={`${prefix}-notes`}>
          Описание <span>необязательно</span>
        </label>
        <textarea
          id={`${prefix}-notes`}
          rows={5}
          maxLength={MAX_NOTES_LENGTH}
          value={draft.notes}
          disabled={disabled}
          placeholder="Детали, идеи, ссылки — всё, что поможет вернуться к делу."
          onChange={(event) => onChange({ notes: event.target.value })}
        />
        <ChecklistEditor
          steps={draft.steps}
          onChange={(steps) =>
            onChange({
              steps,
              ...(draft.status === 'done' &&
              steps.some(
                (step) =>
                  !step.completed &&
                  !draft.steps.some((before) => before.id === step.id && !before.completed),
              )
                ? { status: draft.workState }
                : {}),
            })
          }
          disabled={disabled}
          title={draft.stepDraft}
          onTitleChange={(stepDraft) =>
            onChange({
              stepDraft,
              ...(stepDraft.trim() && draft.status === 'done' ? { status: draft.workState } : {}),
            })
          }
        />
      </div>
      <aside className="task-edit-context" aria-label="Параметры задачи">
        <div className="context-heading">
          <Icon name="layers" size={16} /> Организация
        </div>
        <label className="field-label">
          Статус
          <select
            aria-label="Статус задачи"
            value={draft.status}
            disabled={disabled}
            onChange={(event) => onChange(draftWithStatus(draft, event.target.value as TaskStatus))}
          >
            <option value="todo">Запланировано</option>
            <option value="doing">В процессе</option>
            {prefix === 'edit' && <option value="done">Готово</option>}
          </select>
        </label>
        {prefix === 'edit' && draft.status === 'done' && (
          <p className="field-hint">При сохранении задачи все её шаги будут завершены.</p>
        )}
        <label className="field-label">
          Проект
          <select
            aria-label="Проект задачи"
            value={projects.some((p) => p.id === draft.projectId) ? draft.projectId : ''}
            disabled={disabled}
            onChange={(event) => onChange({ projectId: event.target.value })}
          >
            <option value="">Входящие</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Срок
          <input
            type="date"
            aria-label="Срок задачи"
            min="1900-01-01"
            max="9999-12-31"
            value={draft.dueDate}
            disabled={disabled}
            onChange={(event) => onChange({ dueDate: event.target.value })}
          />
        </label>
        <DateShortcuts
          today={localDate()}
          value={draft.dueDate}
          onChange={(dueDate) => onChange({ dueDate })}
          disabled={disabled}
        />
        <label className="field-label">
          Повторять
          <select
            aria-label="Повторение задачи"
            value={draft.recurrence}
            disabled={disabled}
            onChange={(event) => onChange({ recurrence: event.target.value as Recurrence })}
          >
            <option value="">Не повторять</option>
            <option value="daily">Каждый день</option>
            <option value="weekly">Каждую неделю</option>
          </select>
        </label>
        {draft.recurrence && (
          <p className="field-hint">
            Выберите первый срок. После выполнения появится следующая задача; файлы останутся у
            выполненной.
          </p>
        )}
        <label className="field-label" htmlFor={`${prefix}-tags`}>
          Метки
        </label>
        <input
          id={`${prefix}-tags`}
          value={draft.tagsText}
          maxLength={220}
          disabled={disabled}
          placeholder="Работа, звонок, идея"
          onChange={(event) => onChange({ tagsText: event.target.value })}
        />
        <p className="field-hint">До 8 меток через запятую</p>
        <label className="field-label">
          Приоритет
          <select
            aria-label="Приоритет задачи"
            value={draft.priority}
            disabled={disabled}
            onChange={(event) => onChange({ priority: event.target.value as Priority })}
          >
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
            <option value="low">Низкий</option>
          </select>
        </label>
        <label className="focus-switch">
          <input
            type="checkbox"
            aria-label="В мой день"
            aria-describedby={`${prefix}-focus-hint`}
            checked={draft.focusDate === localDate()}
            disabled={disabled}
            onChange={(event) => onChange({ focusDate: event.target.checked ? localDate() : '' })}
          />
          <span>
            В мой день <small id={`${prefix}-focus-hint`}>Настоящий срок не изменится</small>
          </span>
        </label>
        {children}
      </aside>
    </>
  );
}
