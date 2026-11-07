import { useDialog } from '../hooks/useDialog.ts';
import { useState } from 'react';
import type { Preferences } from '../domain/planner.ts';
import { Icon } from './Icon.tsx';

export function PreferencesDialog({
  preferences,
  onChange,
  onClose,
  onHelp,
  error,
  onRecover,
}: {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onClose: () => void;
  onHelp: () => void;
  error: string;
  onRecover?: () => Promise<boolean>;
}) {
  const { dialog, trapTab } = useDialog();
  const p = preferences;
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const [repairing, setRepairing] = useState(false);
  return (
    <dialog
      ref={dialog}
      className="task-dialog preferences-dialog"
      aria-labelledby="preferences-title"
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="section-caption">ПОД ТВОЙ РИТМ</span>
          <h2 id="preferences-title">Настройки</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть настройки"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="preferences-body">
        <label className="field-label">
          Оформление
          <select
            aria-label="Оформление"
            value={p.theme}
            onChange={(event) => onChange({ theme: event.target.value as Preferences['theme'] })}
          >
            <option value="paper">Бумага · светлая</option>
            <option value="night">Чернила · тёмная</option>
            <option value="grove">Сад · зелёная</option>
            <option value="system">Как в системе</option>
          </select>
        </label>
        <label className="field-label">
          Плотность
          <select
            aria-label="Плотность"
            value={p.density}
            onChange={(event) =>
              onChange({ density: event.target.value as Preferences['density'] })
            }
          >
            <option value="comfortable">Просторно</option>
            <option value="compact">Компактно</option>
          </select>
        </label>
        <div className="preferences-grid">
          <label className="field-label">
            Фокус, минут
            <select
              aria-label="Длительность фокуса"
              value={p.focusMinutes}
              onChange={(event) => onChange({ focusMinutes: Number(event.target.value) })}
            >
              {[5, 15, 25, 45, 60, 90, 120].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Перерыв, минут
            <select
              aria-label="Длительность перерыва"
              value={p.breakMinutes}
              onChange={(event) => onChange({ breakMinutes: Number(event.target.value) })}
            >
              {[1, 5, 10, 15, 30].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field-label">
          Цель: сессий в день
          <select
            aria-label="Дневная цель"
            value={p.dailyGoal}
            onChange={(event) => onChange({ dailyGoal: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <p>
          Изменения сохраняются в этом браузере. Настройки таймера применяются к следующей сессии.
        </p>
        <button type="button" className="secondary-button" onClick={onHelp}>
          Горячие клавиши
        </button>
        {error && (
          <p className="input-error" role="alert">
            {error}
          </p>
        )}
        {onRecover &&
          (confirmRecovery ? (
            <div className="storage-warning" role="group" aria-label="Восстановление настроек">
              <p>
                Сохранить полную копию повреждённых данных и восстановить стандартные настройки?
                Задачи и файлы останутся на месте.
              </p>
              <button
                type="button"
                disabled={repairing}
                onClick={async () => {
                  setRepairing(true);
                  try {
                    if (await onRecover()) setConfirmRecovery(false);
                  } finally {
                    setRepairing(false);
                  }
                }}
              >
                Сохранить копию и восстановить
              </button>
              <button type="button" disabled={repairing} onClick={() => setConfirmRecovery(false)}>
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmRecovery(true)}
            >
              Восстановить настройки
            </button>
          ))}
      </div>
    </dialog>
  );
}
