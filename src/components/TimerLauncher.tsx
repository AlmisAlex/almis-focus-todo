import type { Planner } from '../domain/planner.ts';
import { useTimerDisplay } from '../hooks/useTimerDisplay.ts';
import { TimerRing } from './TimerRing.tsx';
import { Icon } from './Icon.tsx';

export function TimerLauncher({ data, onOpen }: { data: Planner; onOpen: () => void }) {
  const { clock, fraction, remaining } = useTimerDisplay(data);
  return (
    <button
      type="button"
      className="timer-launcher"
      data-active={!!data.timer}
      onClick={onOpen}
      aria-label="Открыть фокус-таймер"
    >
      <span className="timer-launcher-clock">
        <TimerRing fraction={fraction} small />
        <strong>{clock}</strong>
      </span>
      <span>
        <strong>
          {data.timer
            ? remaining === 0
              ? 'Время вышло'
              : data.timer.startedAt === null
                ? 'Фокус на паузе'
                : 'Сессия идёт'
            : 'Время сосредоточиться'}
        </strong>
        <small>{data.timer?.title || 'Выбери задачу и начни фокус-сессию'}</small>
      </span>
      <span className="timer-launcher-action">
        {data.timer ? 'Открыть' : 'Начать'} <Icon name="arrow" size={16} />
      </span>
    </button>
  );
}
