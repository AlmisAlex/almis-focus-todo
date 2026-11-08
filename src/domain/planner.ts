import { TaskInputError } from './tasks.ts';

export const PLANNER_KEY = 'almis.focus.planner.v1';
export type Preferences = {
  theme: 'paper' | 'night' | 'grove' | 'system';
  density: 'comfortable' | 'compact';
  layout: 'list' | 'board' | 'cards';
  columns?: 1 | 2 | 3;
  focusMinutes: number;
  breakMinutes: number;
  dailyGoal: number;
};
export type FocusTimer = {
  id: string;
  taskId: string;
  title: string;
  kind: 'focus' | 'break';
  duration: number;
  elapsed: number;
  startedAt: number | null;
};
export type FocusRecord = {
  id: string;
  taskId: string;
  title: string;
  seconds: number;
  endedAt: number;
};
export type Planner = {
  version: 1;
  preferences: Preferences;
  timer: FocusTimer | null;
  history: FocusRecord[];
};
export const defaultPlanner = (): Planner => ({
  version: 1,
  preferences: {
    theme: 'paper',
    density: 'comfortable',
    layout: 'list',
    focusMinutes: 25,
    breakMinutes: 5,
    dailyGoal: 4,
  },
  timer: null,
  history: [],
});
const integer = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const text = (v: unknown, length: number): v is string =>
  typeof v === 'string' && v.length <= length;
export function decodePlanner(raw: string | null): Planner {
  if (raw === null) return defaultPlanner();
  try {
    if (raw.length > 500_000) throw Error();
    const d = JSON.parse(raw) as Planner;
    const p = d.preferences;
    if (
      d.version !== 1 ||
      !p ||
      !['paper', 'night', 'grove', 'system'].includes(p.theme) ||
      !['comfortable', 'compact'].includes(p.density) ||
      !['list', 'board', 'cards'].includes(p.layout) ||
      (p.columns !== undefined && p.columns !== 1 && p.columns !== 2 && p.columns !== 3) ||
      !integer(p.focusMinutes, 1, 120) ||
      !integer(p.breakMinutes, 1, 30) ||
      !integer(p.dailyGoal, 1, 12) ||
      !Array.isArray(d.history) ||
      d.history.length > 365
    )
      throw Error();
    if (
      !d.history.every(
        (r) =>
          r &&
          text(r.id, 100) &&
          r.id &&
          text(r.taskId, 100) &&
          text(r.title, 180) &&
          integer(r.seconds, 1, 86400) &&
          integer(r.endedAt, 1, 8_640_000_000_000_000),
      ) ||
      new Set(d.history.map((r) => r.id)).size !== d.history.length
    )
      throw Error();
    const t = d.timer;
    if (
      t !== null &&
      (!t ||
        !text(t.id, 100) ||
        !t.id ||
        !text(t.taskId, 100) ||
        !text(t.title, 180) ||
        !['focus', 'break'].includes(t.kind) ||
        !integer(t.duration, 60_000, 7_200_000) ||
        !integer(t.elapsed, 0, 86_400_000) ||
        !(t.startedAt === null || integer(t.startedAt, 1, 8_640_000_000_000_000)))
    )
      throw Error();
    return {
      version: 1,
      preferences: {
        theme: p.theme,
        density: p.density,
        layout: p.layout,
        ...(p.columns !== undefined ? { columns: p.columns } : {}),
        focusMinutes: p.focusMinutes,
        breakMinutes: p.breakMinutes,
        dailyGoal: p.dailyGoal,
      },
      timer: t
        ? {
            id: t.id,
            taskId: t.taskId,
            title: t.title,
            kind: t.kind,
            duration: t.duration,
            elapsed: t.elapsed,
            startedAt: t.startedAt,
          }
        : null,
      history: d.history.map((r) => ({
        id: r.id,
        taskId: r.taskId,
        title: r.title,
        seconds: r.seconds,
        endedAt: r.endedAt,
      })),
    };
  } catch {
    throw new TaskInputError(
      'Настройки и история фокуса не читаются. Исходные данные сохранены; восстановите копию. Задачи доступны отдельно.',
    );
  }
}
export function timerElapsed(timer: FocusTimer, now: number): number {
  return Math.min(
    86_400_000,
    timer.elapsed + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt)),
  );
}
export type PlannerAction =
  | { type: 'preferences'; patch: Partial<Preferences> }
  | {
      type: 'start';
      id: string;
      taskId: string;
      title: string;
      kind: 'focus' | 'break';
      now: number;
    }
  | { type: 'pause' | 'resume' | 'finish' | 'discard'; id: string; now: number }
  | { type: 'restore'; data: Planner };
export function updatePlanner(current: Planner, action: PlannerAction): Planner {
  if (action.type === 'restore') {
    const incoming = decodePlanner(JSON.stringify(action.data));
    const history = new Map(current.history.map((r) => [r.id, r]));
    for (const row of incoming.history) if (!history.has(row.id)) history.set(row.id, row);
    const timer =
      current.timer ??
      (incoming.timer && !history.has(incoming.timer.id)
        ? { ...incoming.timer, startedAt: null }
        : null);
    return {
      ...current,
      preferences: incoming.preferences,
      timer,
      history: [...history.values()].sort((a, b) => b.endedAt - a.endedAt).slice(0, 365),
    };
  }
  if (action.type === 'preferences')
    return decodePlanner(
      JSON.stringify({ ...current, preferences: { ...current.preferences, ...action.patch } }),
    );
  if (!integer(action.now, 1, 8_640_000_000_000_000))
    throw new TaskInputError('Проверьте время устройства.');
  if (action.type === 'start') {
    if (current.timer) throw new TaskInputError('Сначала завершите или сбросьте текущую сессию.');
    return decodePlanner(
      JSON.stringify({
        ...current,
        timer: {
          id: action.id,
          taskId: action.taskId,
          title: action.title,
          kind: action.kind,
          duration:
            60_000 *
            (action.kind === 'focus'
              ? current.preferences.focusMinutes
              : current.preferences.breakMinutes),
          elapsed: 0,
          startedAt: action.now,
        },
      }),
    );
  }
  const timer = current.timer;
  if (!timer || timer.id !== action.id) return current;
  if (action.type === 'pause')
    return {
      ...current,
      timer: { ...timer, elapsed: Math.floor(timerElapsed(timer, action.now)), startedAt: null },
    };
  if (action.type === 'resume')
    return timer.startedAt === null
      ? { ...current, timer: { ...timer, startedAt: action.now } }
      : current;
  const seconds = Math.floor(timerElapsed(timer, action.now) / 1000);
  const history =
    action.type === 'finish' &&
    timer.kind === 'focus' &&
    seconds > 0 &&
    !current.history.some((r) => r.id === timer.id)
      ? [
          { id: timer.id, taskId: timer.taskId, title: timer.title, seconds, endedAt: action.now },
          ...current.history,
        ].slice(0, 365)
      : current.history;
  return { ...current, timer: null, history };
}
