import { useEffect, useState } from 'react';
import { browserStorage, legacyWorkspaceChanged, LEGACY_KEY } from '../storage/taskStorage.ts';

export function LegacyWorkspaceNotice({ revision, today }: { revision: unknown; today: string }) {
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const check = () => setChanged(legacyWorkspaceChanged(browserStorage()));
    check();
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, [revision]);
  if (!changed) return null;
  return (
    <div className="storage-warning" role="alert">
      <div>
        <strong>В другой вкладке осталась прежняя версия.</strong>
        <p>
          Обновите её. Её изменения сохранены отдельно и не заменяют новое пространство. Скачайте их
          копию перед закрытием.
        </p>
        {error && <p>{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            const raw = browserStorage()?.getItem(LEGACY_KEY);
            if (!raw) return;
            const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `focus-previous-version-${today}.json`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } catch {
            setError('Не удалось подготовить копию. Не закрывайте прежнюю вкладку.');
          }
        }}
      >
        Копия прежней вкладки
      </button>
    </div>
  );
}
