import { useState } from 'react';
import type { JournalEntry } from '../domain/journal.ts';
import type { TaskStep } from '../domain/tasks.ts';
import type { Attachment } from '../domain/attachments.ts';
import { NoteContent } from './NoteContent.tsx';
import { FilePreview } from './FilePreview.tsx';
import { Icon } from './Icon.tsx';

export function TaskActivity({
  entries,
  files,
  steps,
  onRemove,
}: {
  entries: readonly JournalEntry[];
  files: readonly Attachment[];
  steps: readonly TaskStep[];
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [removing, setRemoving] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="task-activity" aria-label="Записи работы">
      {!entries.length && (
        <p className="work-empty">Здесь будут заметки, решения и файлы по ходу работы.</p>
      )}
      {[...entries]
        .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
        .map((entry) => {
          const file = entry.fileId
            ? files.find((f) => f.id === entry.fileId && f.taskId === entry.taskId)
            : undefined;
          return (
            <article key={entry.id}>
              <header>
                <time dateTime={new Date(entry.at).toISOString()}>
                  {new Date(entry.at).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <span>
                  {entry.stepId
                    ? (steps.find((s) => s.id === entry.stepId)?.title ??
                      entry.stepTitle ??
                      'Прежний шаг')
                    : 'Задача'}
                </span>
              </header>
              {entry.fileId ? (
                file ? (
                  <button type="button" className="work-file" onClick={() => setPreview(file)}>
                    <Icon name="file" />
                    <span>{file.name}</span>
                    <small>Открыть</small>
                  </button>
                ) : (
                  <p>Файл недоступен в этой копии: {entry.text}</p>
                )
              ) : (
                <NoteContent text={entry.text} />
              )}
              {removing === entry.id ? (
                <div className="entry-delete-confirm">
                  <span>Удалить запись? Файл останется в библиотеке.</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        if (await onRemove(entry.id)) setRemoving('');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Удалить запись
                  </button>
                  <button type="button" disabled={busy} onClick={() => setRemoving('')}>
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  className="entry-delete"
                  type="button"
                  onClick={() => setRemoving(entry.id)}
                  aria-label="Удалить эту запись"
                >
                  <Icon name="trash" size={13} />
                  Удалить запись
                </button>
              )}
            </article>
          );
        })}
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
