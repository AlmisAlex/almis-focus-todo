import { useDialog } from '../hooks/useDialog.ts';
import { useState } from 'react';
import type { Preferences } from '../domain/planner.ts';
import { Icon } from './Icon.tsx';
import { TimerDurations } from './TimerDurations.tsx';

export function PreferencesDialog({
  preferences,
  onChange,
  onClose,
  onHelp,
  error,
  onRecover,
  onJournal,
  onFiles,
  onBackup,
}: {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => Promise<boolean>;
  onClose: () => void;
  onHelp: () => void;
  error: string;
  onRecover?: () => Promise<boolean>;
  onJournal: () => void;
  onFiles: () => void;
  onBackup: () => void;
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
        <fieldset className="appearance-options">
          <legend>Оформление</legend>
          <div className="theme-grid">
            {(
              [
                ['paper', 'Бумага', 'Тёплая и светлая'],
                ['night', 'Чернила', 'Спокойная тёмная'],
                ['grove', 'Сад', 'Мягкие зелёные тона'],
                ['system', 'Система', 'Как на устройстве'],
              ] as const
            ).map(([value, title, description]) => (
              <button
                type="button"
                key={value}
                data-appearance={value}
                aria-pressed={p.theme === value}
                onClick={() => void onChange({ theme: value })}
              >
                <span className="theme-thumbnail">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{title}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="appearance-options">
          <legend>Размер карточек</legend>
          <div className="density-options">
            {(
              [
                ['comfortable', 'Просторно'],
                ['compact', 'Компактно'],
              ] as const
            ).map(([value, title]) => (
              <button
                type="button"
                key={value}
                aria-pressed={p.density === value}
                onClick={() => void onChange({ density: value })}
              >
                {title}
              </button>
            ))}
          </div>
        </fieldset>
        <TimerDurations preferences={p} onChange={onChange} />
        <fieldset className="appearance-options">
          <legend>Записи и данные</legend>
          <div className="settings-data-actions">
            <button type="button" className="secondary-button" onClick={onJournal}>
              Журнал и удалённые задачи
            </button>
            <button type="button" className="secondary-button" onClick={onFiles}>
              Файлы и примеры
            </button>
            <button type="button" className="secondary-button" onClick={onBackup}>
              Резервная копия
            </button>
          </div>
        </fieldset>
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
        <p>Оформление сохраняется сразу. Для своей длительности нажми «Сохранить время».</p>
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
