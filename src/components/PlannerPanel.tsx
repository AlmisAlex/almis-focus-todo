import { useEffect, useState } from 'react';
import type { Task } from '../domain/tasks.ts';
import type { Planner, PlannerAction, Preferences } from '../domain/planner.ts';
import { useTimerDisplay } from '../hooks/useTimerDisplay.ts';
import { TimerRing } from './TimerRing.tsx';
import { TimerDurations } from './TimerDurations.tsx';
import { localDate, addDays } from '../domain/calendar.ts';
import { newId } from '../domain/ids.ts';
import { Icon } from './Icon.tsx';

export function PlannerPanel({
  data,
  tasks,
  today,
  onAction,
  error,
  onPreferences,
}: {
  data: Planner;
  tasks: readonly Task[];
  today: string;
  onAction: (action: PlannerAction) => Promise<boolean>;
  error: string;
  onPreferences: (patch: Partial<Preferences>) => Promise<boolean>;
}) {
  const [chosen, setChosen] = useState('');
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = data.timer;
  useEffect(() => setResetting(false), [timer?.id]);
  const { remaining, clock, fraction } = useTimerDisplay(data);
  const daily = data.history.filter((row) => localDate(new Date(row.endedAt)) === today);
  const weekStart = addDays(today, -6);
  const week = data.history.filter((row) => {
    const day = localDate(new Date(row.endedAt));
    return day >= weekStart && day <= today;
  });
  const completed = tasks.filter(
    (task) => task.completed && task.completedAt && localDate(new Date(task.completedAt)) === today,
  ).length;
  const act = async (action: PlannerAction) => {
    setBusy(true);
    try {
      await onAction(action);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="planner-panel" aria-labelledby="focus-session-title">
      <div className="planner-intro">
        <span className="section-caption">ОДНО ДЕЛО ЗА РАЗ</span>
        <h2 id="focus-session-title">
          Время для главного<span>.</span>
        </h2>
        <p>Выбери задачу и дай ей немного тишины.</p>
      </div>
      <div className="focus-clock">
        <TimerRing fraction={fraction} />
        <div className="focus-clock-copy">
          <span className="clock-label">
            {timer
              ? timer.kind === 'break'
                ? 'ПЕРЕРЫВ'
                : timer.startedAt === null
                  ? 'ПАУЗА'
                  : remaining
                    ? 'СЕССИЯ ИДЁТ'
                    : 'ВРЕМЯ ВЫШЛО'
              : 'ФОКУС-СЕССИЯ'}
          </span>
          <output
            aria-label={`Осталось ${Math.floor(remaining / 60)} минут ${remaining % 60} секунд`}
          >
            {clock}
          </output>
          <span className="timer-task">{timer?.title || 'Без привязки к задаче'}</span>
        </div>
      </div>
      <div className="focus-controls">
        {!timer ? (
          <>
            <TimerDurations preferences={data.preferences} onChange={onPreferences} />
            <label className="sr-only" htmlFor="focus-task">
              Задача для фокуса
            </label>
            <select
              id="focus-task"
              value={tasks.some((t) => t.id === chosen && !t.completed) ? chosen : ''}
              onChange={(event) => setChosen(event.target.value)}
            >
              <option value="">Свободная сессия</option>
              {tasks
                .filter((t) => !t.completed)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  const task = tasks.find((t) => t.id === chosen && !t.completed);
                  void act({
                    type: 'start',
                    id: newId(),
                    taskId: task?.id ?? '',
                    title: task?.title ?? '',
                    kind: 'focus',
                    now: Date.now(),
                  });
                }}
              >
                <Icon name="arrow" size={15} />
                Начать
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void act({
                    type: 'start',
                    id: newId(),
                    taskId: '',
                    title: 'Перерыв',
                    kind: 'break',
                    now: Date.now(),
                  })
                }
              >
                Перерыв {data.preferences.breakMinutes} мин
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  void act({
                    type: timer.startedAt === null ? 'resume' : 'pause',
                    id: timer.id,
                    now: Date.now(),
                  })
                }
              >
                {timer.startedAt === null ? 'Продолжить' : 'Пауза'}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => void act({ type: 'finish', id: timer.id, now: Date.now() })}
              >
                Завершить
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => setResetting(true)}
              >
                Сбросить
              </button>
            </div>
            {resetting && (
              <div className="timer-confirm" role="group" aria-label="Сброс сессии">
                <p>Сбросить без записи в историю?</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ type: 'discard', id: timer.id, now: Date.now() })}
                >
                  Да, сбросить
                </button>
                <button type="button" onClick={() => setResetting(false)}>
                  Продолжить сессию
                </button>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="input-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <details className="focus-insight">
        <summary>
          Твой ритм{' '}
          <span>
            {daily.length} / {data.preferences.dailyGoal} сессий сегодня
          </span>
        </summary>
        <div>
          <p>
            <strong>{completed}</strong> задач завершено сегодня
          </p>
          <p>
            <strong>{Math.round(daily.reduce((sum, row) => sum + row.seconds, 0) / 60)}</strong>{' '}
            минут фокуса сегодня
          </p>
          <p>
            <strong>{Math.round(week.reduce((sum, row) => sum + row.seconds, 0) / 60)}</strong>{' '}
            минут за 7 дней
          </p>
        </div>
        <small>
          Только записанные сессии и новые завершения. История: последние 365 сессий. Таймер
          продолжается после закрытия вкладки; завершение записывается вручную.
        </small>
      </details>
    </section>
  );
}
