import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';
import { MAX_TITLE_LENGTH } from '../domain/tasks.ts';

export function QuickCapture({
  onCreate,
  onDetails,
  disabled,
  title,
  onTitleChange,
}: {
  onCreate: (title: string) => Promise<unknown>;
  onDetails: () => void;
  disabled: boolean;
  title: string;
  onTitleChange: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!title.trim()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [title]);
  return (
    <form
      className="quick-capture"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving.current || disabled || !title.trim()) return;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
          await onCreate(title);
          onTitleChange('');
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Не удалось добавить задачу.');
        } finally {
          saving.current = false;
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="quick-capture">
        Быстро добавить задачу
      </label>
      <Icon name="plus" />
      <input
        id="quick-capture"
        placeholder="Новое дело…"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        disabled={busy || disabled}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <button
        type="submit"
        className="capture-submit"
        disabled={busy || disabled || !title.trim()}
        aria-label="Добавить быстро"
      >
        <Icon name="arrow" />
      </button>
      <button
        type="button"
        className="text-button capture-details"
        aria-label="С деталями"
        title="Добавить с деталями"
        disabled={busy}
        onClick={onDetails}
      >
        <Icon name="edit" size={16} />
        <span className="capture-details-label">С деталями</span>
      </button>
      {error && (
        <p role="alert" className="input-error">
          {error}
        </p>
      )}
    </form>
  );
}
