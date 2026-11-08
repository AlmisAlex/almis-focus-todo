import { useEffect, useState } from 'react';
import { timerElapsed } from '../domain/planner.ts';
import type { Planner } from '../domain/planner.ts';

/** Presentation ticks never write storage or rerender the task list. */
export function useTimerDisplay(data: Planner) {
  const [now, setNow] = useState(Date.now);
  const timer = data.timer;
  useEffect(() => {
    setNow(Date.now());
    if (timer?.startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer]);
  const duration = timer?.duration ?? data.preferences.focusMinutes * 60_000;
  const elapsed = timer ? timerElapsed(timer, now) : 0;
  const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return { remaining, clock, fraction: Math.max(0, Math.min(1, 1 - elapsed / duration)) };
}
