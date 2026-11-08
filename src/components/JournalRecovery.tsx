import { useState } from 'react';
import type { JournalModel } from '../hooks/useJournal.ts';
export function JournalRecovery({ journal }: { journal: JournalModel }) {
  const [confirm, setConfirm] = useState(false);
  if (!journal.corrupt) return null;
  return confirm ? (
    <div className="journal-recovery" role="group" aria-label="Восстановление журнала">
      <p>Сохранить полную копию исходных данных и восстановить журнал?</p>
      <button
        type="button"
        className="secondary-button"
        disabled={journal.isWorking}
        onClick={async () => {
          if (await journal.dispatch({ type: 'recover' })) setConfirm(false);
        }}
      >
        Сохранить копию и восстановить журнал
      </button>
      <button
        type="button"
        className="text-button"
        disabled={journal.isWorking}
        onClick={() => setConfirm(false)}
      >
        Отмена
      </button>
    </div>
  ) : (
    <button type="button" className="secondary-button" onClick={() => setConfirm(true)}>
      Восстановить журнал
    </button>
  );
}
