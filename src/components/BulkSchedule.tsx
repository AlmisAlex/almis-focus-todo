import { useState } from 'react';
import { DateShortcuts } from './DateShortcuts.tsx';

export function BulkSchedule({
  today,
  disabled,
  onApply,
}: {
  today: string;
  disabled: boolean;
  onApply: (date: string) => void;
}) {
  const [date, setDate] = useState(today);
  return (
    <div className="bulk-schedule">
      <label>
        Новый срок выбранных
        <input
          type="date"
          min="1900-01-01"
          max="9999-12-31"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={disabled}
        />
      </label>
      <button
        type="button"
        className="secondary-button"
        disabled={disabled || !date}
        onClick={() => onApply(date)}
      >
        Перенести
      </button>
      <button type="button" className="text-button" disabled={disabled} onClick={() => onApply('')}>
        Убрать срок
      </button>
      <DateShortcuts today={today} value={date} onChange={setDate} disabled={disabled} />
    </div>
  );
}
