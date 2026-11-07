export function DemoFilesNotice({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <div className="storage-warning">
      <p>Пример задач уже добавлен. Некоторые тестовые файлы ещё не сохранены.</p>
      <button type="button" disabled={busy} onClick={onRetry}>
        Добавить недостающие файлы
      </button>
    </div>
  );
}
