import { useMemo, useState } from 'react';
import type { Task } from '../domain/tasks.ts';
import type { JournalModel } from '../hooks/useJournal.ts';
import type { AttachmentModel } from '../hooks/useAttachments.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { TaskActivity } from './TaskActivity.tsx';
import { JournalRecovery } from './JournalRecovery.tsx';
import { Icon } from './Icon.tsx';

export function JournalLibrary({
  journal,
  tasks,
  attachments,
  onClose,
}: {
  journal: JournalModel;
  tasks: readonly Task[];
  attachments: AttachmentModel;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const [query, setQuery] = useState(''),
    [orphans, setOrphans] = useState(false);
  const groups = useMemo(() => {
    const result = new Map<string, typeof journal.data.entries>();
    for (const entry of journal.data.entries) {
      const task = tasks.find((t) => t.id === entry.taskId);
      if (orphans && task) continue;
      if (
        query &&
        !((task?.title ?? entry.taskTitle ?? '') + ' ' + entry.text)
          .toLocaleLowerCase('ru')
          .includes(query.toLocaleLowerCase('ru'))
      )
        continue;
      const items = result.get(entry.taskId) ?? [];
      items.push(entry);
      result.set(entry.taskId, items);
    }
    return [...result];
  }, [journal.data.entries, tasks, query, orphans]);
  return (
    <dialog
      ref={dialog}
      className="journal-library-dialog"
      aria-labelledby="journal-title"
      onKeyDown={trapTab}
      onCancel={(e) => {
        e.preventDefault();
        if (!journal.isWorking) onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="section-caption">МАТЕРИАЛЫ РАБОТЫ</span>
          <h2 id="journal-title">Журнал задач</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          disabled={journal.isWorking}
          onClick={onClose}
          aria-label="Закрыть журнал"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="journal-library-controls">
        <input
          type="search"
          aria-label="Поиск по журналу"
          placeholder="Найти заметку или задачу…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          <input type="checkbox" checked={orphans} onChange={(e) => setOrphans(e.target.checked)} />
          Только удалённые задачи
        </label>
        <small>
          {journal.data.entries.length} / 500 записей · файлы хранятся отдельно в библиотеке
        </small>
      </div>
      <div className="journal-library-body">
        {journal.error && (
          <p role="alert" className="input-error">
            {journal.error}
          </p>
        )}
        <JournalRecovery journal={journal} />
        {!groups.length && (
          <p className="work-empty">
            {query
              ? 'Совпадений нет.'
              : 'Записей пока нет. Комментарии добавляются в рабочем окне задачи.'}
          </p>
        )}
        {groups.map(([id, entries]) => {
          const task = tasks.find((t) => t.id === id);
          return (
            <section className="journal-task-group" key={id}>
              <h3>
                {task?.title ??
                  entries.find((entry) => entry.taskTitle)?.taskTitle ??
                  'Удалённая задача'}
                {!task && <small>Задача удалена · записи сохранены</small>}
              </h3>
              <TaskActivity
                entries={entries}
                files={attachments.files}
                steps={task?.steps ?? []}
                onRemove={(entryId) => journal.dispatch({ type: 'remove', id: entryId })}
              />
            </section>
          );
        })}
      </div>
    </dialog>
  );
}
