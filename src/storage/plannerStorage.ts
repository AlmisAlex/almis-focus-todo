import { PLANNER_KEY, decodePlanner, defaultPlanner, updatePlanner } from '../domain/planner.ts';
import type { PlannerAction } from '../domain/planner.ts';

export const PLANNER_RECOVERY_KEY = 'almis.focus.planner.recovery';
export type PlannerCommand = PlannerAction | { type: 'recover' };
type PlannerPort = Pick<Storage, 'getItem' | 'setItem'>;

/** Caller holds the planner Web Lock. Never replace unreadable data before its raw copy succeeds. */
export function commitPlannerCommand(storage: PlannerPort, action: PlannerCommand) {
  const raw = storage.getItem(PLANNER_KEY);
  let current;
  try {
    current = decodePlanner(raw);
    if (action.type === 'recover') return current;
  } catch (error) {
    if (action.type !== 'recover' && action.type !== 'restore') throw error;
    if (raw !== null) storage.setItem(PLANNER_RECOVERY_KEY, raw);
    current = defaultPlanner();
  }
  const next = action.type === 'recover' ? current : updatePlanner(current, action);
  const payload = JSON.stringify(next);
  const validated = decodePlanner(payload);
  storage.setItem(PLANNER_KEY, payload);
  return validated;
}
