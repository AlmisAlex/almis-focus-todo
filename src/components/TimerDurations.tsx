import { useEffect, useState } from 'react';
import type { Preferences } from '../domain/planner.ts';

export function TimerDurations({
  preferences,
  onChange,
}: {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => Promise<boolean>;
}) {
  const [focus, setFocus] = useState(String(preferences.focusMinutes)),
    [rest, setRest] = useState(String(preferences.breakMinutes));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    setFocus(String(preferences.focusMinutes));
    setRest(String(preferences.breakMinutes));
  }, [preferences.focusMinutes, preferences.breakMinutes]);
  const valid =
    Number.isInteger(Number(focus)) &&
    Number(focus) >= 1 &&
    Number(focus) <= 120 &&
    Number.isInteger(Number(rest)) &&
    Number(rest) >= 1 &&
    Number(rest) <= 30;
  return (
    <fieldset className="timer-durations">
      <legend>Время под твой ритм</legend>
      <div className="timer-presets" role="group" aria-label="Быстрый выбор фокуса">
        {[15, 25, 45, 60].map((n) => (
          <button
            type="button"
            key={n}
            aria-pressed={focus === String(n)}
            disabled={busy}
            onClick={() => {
              setFocus(String(n));
              setMessage('');
            }}
          >
            {n} мин
          </button>
        ))}
      </div>
      <div className="preferences-grid">
        <label>
          Фокус, минут
          <input
            type="number"
            inputMode="numeric"
            aria-label="Свои минуты фокуса"
            min={1}
            max={120}
            step={1}
            value={focus}
            disabled={busy}
            onChange={(e) => {
              setFocus(e.target.value);
              setMessage('');
            }}
          />
        </label>
        <label>
          Перерыв, минут
          <input
            type="number"
            inputMode="numeric"
            aria-label="Свои минуты перерыва"
            min={1}
            max={30}
            step={1}
            value={rest}
            disabled={busy}
            onChange={(e) => {
              setRest(e.target.value);
              setMessage('');
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={
          !valid ||
          busy ||
          (Number(focus) === preferences.focusMinutes && Number(rest) === preferences.breakMinutes)
        }
        onClick={async () => {
          setBusy(true);
          try {
            setMessage(
              (await onChange({ focusMinutes: Number(focus), breakMinutes: Number(rest) }))
                ? 'Время сохранено.'
                : 'Не удалось сохранить время.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Сохраняем…' : 'Сохранить время'}
      </button>
      <small>Фокус: 1–120 минут. Перерыв: 1–30. Новое время применяется к следующей сессии.</small>
      {message && <p role="status">{message}</p>}
    </fieldset>
  );
}
