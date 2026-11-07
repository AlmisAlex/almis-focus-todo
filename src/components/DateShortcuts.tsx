import { addDays } from '../domain/calendar.ts';

export function DateShortcuts({
  today,
  value,
  onChange,
  disabled = false,
}: {
  today: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const options = [
    { label: 'Сегодня', date: today },
    { label: 'Завтра', date: addDays(today, 1) },
    { label: 'Через неделю', date: addDays(today, 7) },
    { label: 'Без срока', date: '' },
  ];
  return (
    <div className="date-shortcuts" role="group" aria-label="Быстрый выбор срока">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.date}
          disabled={disabled}
          onClick={() => onChange(option.date)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
