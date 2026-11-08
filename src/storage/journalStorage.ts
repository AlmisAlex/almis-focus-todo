import { applyJournal, decodeJournal, emptyJournal, JOURNAL_KEY } from '../domain/journal.ts';
import type { JournalAction } from '../domain/journal.ts';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
/** Corrupt bytes must be copied successfully before an explicit recovery or restore. */
export function commitJournal(storage: Store, action: JournalAction) {
  const raw = storage.getItem(JOURNAL_KEY);
  let data;
  try {
    data = decodeJournal(raw);
  } catch (error) {
    if (action.type !== 'recover' && action.type !== 'restore') throw error;
    if (raw !== null) storage.setItem('almis.focus.journal.recovery', raw);
    data = emptyJournal();
  }
  const next = applyJournal(data, action);
  storage.setItem(JOURNAL_KEY, JSON.stringify(next));
  return next;
}
