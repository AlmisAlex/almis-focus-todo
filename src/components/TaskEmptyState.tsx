import type { TaskView } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function TaskEmptyState({
  query,
  hasTasks,
  filter,
  mode,
  projectId,
  filtered,
  busy,
  onCreate,
  onExamples,
  onShowAll,
}: {
  query: string;
  hasTasks: boolean;
  filter: TaskView;
  mode: 'list' | 'calendar';
  projectId: string | null;
  filtered: boolean;
  busy: boolean;
  onCreate: () => void;
  onExamples: () => void;
  onShowAll: () => void;
}) {
  const titles: Partial<Record<TaskView, string>> = {
    focus: 'Выбери фокус на сегодня',
    inbox: 'Входящие разобраны',
    upcoming: 'Ближайшая неделя свободна',
    undated: 'У всех задач выбран срок',
    overdue: 'Ничего не просрочено',
    today: 'На сегодня задач нет',
    completed: 'Первые победы впереди',
  };
  const title = query
    ? 'Ничего не нашлось'
    : !hasTasks
      ? 'Начни с одного маленького дела'
      : filtered
        ? 'Нет задач с этими фильтрами'
        : mode === 'calendar'
          ? 'В этот день пока нет задач'
          : projectId
            ? 'В проекте пока нет задач'
            : (titles[filter] ?? 'Здесь пока пусто');
  return (
    <div className="empty-state">
      <div className="empty-orbit" aria-hidden="true">
        <Icon name={query ? 'search' : 'spark'} size={24} />
      </div>
      <h3>{title}</h3>
      <p>
        {query
          ? 'Попробуй другое слово или посмотри все задачи.'
          : hasTasks
            ? 'Добавь новую задачу или выбери другой раздел.'
            : 'Начни с чистого листа или открой готовый пример с проектами, шагами и файлами.'}
      </p>
      {!hasTasks && !query && (
        <div className="example-preview" aria-label="Пример пространства">
          <div>
            <span>01</span>
            <strong>Подготовить план проекта</strong>
            <small>3 шага · PDF и текст</small>
          </div>
          <div>
            <span>02</span>
            <strong>Записать новую идею</strong>
            <small>Файл JSON</small>
          </div>
          <div>
            <span>03</span>
            <strong>Найти время для себя</strong>
            <small>Пример изображения</small>
          </div>
          <p>Только вымышленные примеры. Добавятся в список по твоему выбору.</p>
        </div>
      )}
      <div className="empty-actions">
        {!hasTasks && !query ? (
          <>
            <button type="button" className="primary-button" onClick={onCreate}>
              Добавить первую задачу
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={onExamples}>
              Попробовать примеры
            </button>
          </>
        ) : (
          <button type="button" className="text-button" onClick={onShowAll}>
            Показать все задачи
          </button>
        )}
      </div>
    </div>
  );
}
