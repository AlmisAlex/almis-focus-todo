import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Viewport/focus feedback stays separate from saving and dialog draft state. */
export function useWorkspacePosition(
  viewKey: string,
  visibleIds: string,
  list: RefObject<HTMLDivElement | null>,
  creating: boolean,
  busy: boolean,
) {
  const previousView = useRef(viewKey);
  const frame = useRef<number | null>(null);
  const pendingTask = useRef<string | null>(null);
  const [revealedTaskId, setRevealedTaskId] = useState('');
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const navigateToTop = useCallback(() => {
    cancelFrame();
    frame.current = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      frame.current = null;
    });
  }, [cancelFrame]);
  const revealTask = useCallback((id: string) => {
    pendingTask.current = id;
  }, []);

  useLayoutEffect(() => {
    if (previousView.current === viewKey) return;
    previousView.current = viewKey;
    cancelFrame();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [viewKey, cancelFrame]);
  useLayoutEffect(() => {
    if (creating || busy || !pendingTask.current) return;
    const id = pendingTask.current;
    pendingTask.current = null;
    const row = Array.from(
      list.current?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [],
    ).find((element) => element.dataset.taskId === id);
    if (!row) return;
    cancelFrame();
    row.querySelector<HTMLButtonElement>('.task-open')?.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'center', behavior: 'instant' });
    setRevealedTaskId(id);
  }, [visibleIds, creating, busy, list, cancelFrame]);
  useEffect(() => {
    if (!revealedTaskId) return;
    const timer = window.setTimeout(() => setRevealedTaskId(''), 2400);
    return () => window.clearTimeout(timer);
  }, [revealedTaskId]);
  useEffect(() => cancelFrame, [cancelFrame]);
  return { navigateToTop, revealTask, revealedTaskId };
}
