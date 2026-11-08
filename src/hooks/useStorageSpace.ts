import { useEffect, useState } from 'react';
export function useStorageSpace(revision: number) {
  const [space, setSpace] = useState<{ quota?: number; usage?: number; persisted: boolean }>({
    persisted: false,
  });
  const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const estimate = await navigator.storage?.estimate?.();
        const persisted = (await navigator.storage?.persisted?.()) ?? false;
        if (alive) setSpace({ ...estimate, persisted });
      } catch {
        if (alive) setSpace({ persisted: false });
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      window.removeEventListener('focus', refresh);
    };
  }, [revision]);
  const persist = async () => {
    try {
      const allowed = (await navigator.storage?.persist?.()) ?? false;
      setSpace((old) => ({ ...old, persisted: allowed }));
      setMessage(
        allowed
          ? 'Браузер защитил данные от автоматической очистки.'
          : 'Браузер не предоставил защиту. Сохраняй резервные копии.',
      );
    } catch {
      setMessage('Защита недоступна. Сохраняй резервные копии.');
    }
  };
  return {
    ...space,
    message,
    persist,
    available:
      space.quota !== undefined && space.usage !== undefined
        ? Math.max(0, space.quota - space.usage)
        : undefined,
  };
}
