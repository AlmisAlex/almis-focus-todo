import { useEffect, useRef, useState } from 'react';
import { decodeJournal, emptyJournal, JOURNAL_KEY } from '../domain/journal.ts';
import type { JournalAction } from '../domain/journal.ts';
import { commitJournal } from '../storage/journalStorage.ts';

export function useJournal() {
  const [data, setData] = useState(() => {
    try {
      return decodeJournal(localStorage.getItem(JOURNAL_KEY));
    } catch {
      return emptyJournal();
    }
  });
  const [error, setError] = useState('');
  const [corrupt, setCorrupt] = useState(false);
  const [pending, setPending] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      try {
        setData(decodeJournal(localStorage.getItem(JOURNAL_KEY)));
        setCorrupt(false);
        setError('');
      } catch (caught) {
        setCorrupt(true);
        setError(caught instanceof Error ? caught.message : 'Журнал недоступен.');
      }
    };
    const sync = (event: StorageEvent) => {
      if (event.key === JOURNAL_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', refresh);
    return () => {
      mounted.current = false;
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const dispatch = async (action: JournalAction) => {
    setPending((n) => n + 1);
    try {
      if (!navigator.locks) throw Error('Для безопасной записи нужен браузер с Web Locks.');
      const next = await navigator.locks.request(JOURNAL_KEY + '.write', () =>
        commitJournal(localStorage, action),
      );
      if (mounted.current) {
        setData(next);
        setError('');
        setCorrupt(false);
      }
      return true;
    } catch (caught) {
      if (mounted.current)
        setError(
          caught instanceof Error
            ? 'Не сохранено: ' + caught.message
            : 'Журнал не сохранён. Проверь место в браузере.',
        );
      return false;
    } finally {
      if (mounted.current) setPending((n) => n - 1);
    }
  };
  return { data, error, corrupt, isWorking: pending > 0, dispatch };
}
export type JournalModel = ReturnType<typeof useJournal>;
