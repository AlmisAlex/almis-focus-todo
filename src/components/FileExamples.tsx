import { useEffect, useState } from 'react';
import { exampleFiles } from '../domain/demoFiles.ts';
import type { Attachment } from '../domain/attachments.ts';
import { FilePreview } from './FilePreview.tsx';
import { Icon } from './Icon.tsx';
const descriptions: Record<string, string> = {
  txt: 'План проекта: результат, шаги и заметки. Текст читается прямо здесь.',
  csv: 'Таблица этапов и статусов с просмотром ячеек.',
  json: 'Структурированная заметка с примером списка шагов.',
  pdf: 'Документ со страницами, масштабом и извлечением текста.',
  png: 'Иллюстрация с просмотром прямо в окне.',
  wav: 'Короткий звуковой пример с плеером.',
};

/** Examples are viewable immediately and never write to the user's workspace. */
export function FileExamples() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void exampleFiles()
      .then((groups) => {
        if (alive)
          setFiles(
            Object.values(groups)
              .flat()
              .map((file, index) => ({
                id: `preview-example-${index}`,
                taskId: 'preview-example',
                name: file.name,
                type: file.type,
                size: file.size,
                createdAt: Date.now(),
                blob: file,
              })),
          );
      })
      .catch(() => {
        if (alive) setError('Не удалось подготовить примеры. Закрой и открой библиотеку ещё раз.');
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="file-examples" aria-label="Примеры файлов">
      <h3>Посмотри, как это работает</h3>
      <p>Готовые примеры — открой любой файл.</p>
      {error && (
        <p role="alert" className="input-error">
          {error}
        </p>
      )}
      {!files.length && !error && <p role="status">Подготавливаем примеры…</p>}
      <div className="file-example-grid">
        {files.map((file) => (
          <button type="button" key={file.id} onClick={() => setPreview(file)}>
            <span className="file-example-type">
              {file.name.split('.').at(-1)?.toUpperCase()}
              <Icon name="file" size={22} />
            </span>
            <strong>{file.name}</strong>
            <span>{descriptions[file.name.split('.').at(-1)?.toLowerCase() ?? '']}</span>
            <small>Открыть пример →</small>
          </button>
        ))}
      </div>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
