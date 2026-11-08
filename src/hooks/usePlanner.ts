import { useEffect, useState } from 'react';
import { PLANNER_KEY, decodePlanner, defaultPlanner } from '../domain/planner.ts';
import { commitPlannerCommand } from '../storage/plannerStorage.ts';
import type { PlannerCommand } from '../storage/plannerStorage.ts';

export function usePlanner() {
  const [state, setState] = useState(() => {
    try {
      return decodePlanner(localStorage.getItem(PLANNER_KEY));
    } catch {
      return defaultPlanner();
    }
  });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const [corrupt, setCorrupt] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try {
        setState(decodePlanner(localStorage.getItem(PLANNER_KEY)));
        setError('');
        setCorrupt(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Не удалось прочитать настройки.');
        setCorrupt(true);
      }
    };
    const sync = (event: StorageEvent) => {
      if (event.key === PLANNER_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const dispatch = async (action: PlannerCommand) => {
    setPending((count) => count + 1);
    try {
      if (!navigator.locks)
        throw Error('Для безопасного сохранения нужен современный браузер с Web Locks.');
      await navigator.locks.request(`${PLANNER_KEY}.write`, () => {
        const next = commitPlannerCommand(localStorage, action);
        setState(next);
        setError('');
        setCorrupt(false);
      });
      return true;
    } catch (caught) {
      // A competing tab may have committed a timer before this locked command.
      // Refresh the canonical state without hiding the failed action's message.
      try {
        setState(decodePlanner(localStorage.getItem(PLANNER_KEY)));
      } catch {
        /* Keep the last readable state. */
      }
      setError(
        caught instanceof Error
          ? `Не сохранено: ${caught.message}`
          : 'Не удалось сохранить настройки.',
      );
      return false;
    } finally {
      setPending((count) => count - 1);
    }
  };
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        state.preferences.theme === 'system'
          ? media.matches
            ? 'night'
            : 'paper'
          : state.preferences.theme;
      document.documentElement.dataset.density = state.preferences.density;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [state.preferences.theme, state.preferences.density]);
  return { state, error, dispatch, corrupt, isWorking: pending > 0 };
}
