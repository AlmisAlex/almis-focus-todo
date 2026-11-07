import { useLayoutEffect, useRef } from 'react';

/** Presentation only: animations never delay a write or remove a keyboard target. */
export function useWorkspaceMotion(view: string, listKey: string) {
  const surface = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const previousView = useRef(view);

  useLayoutEffect(() => {
    const element = surface.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || reduced.matches || previousView.current === view) {
      previousView.current = view;
      return;
    }
    previousView.current = view;
    positions.current.clear();
    const animation = element.animate(
      [
        { opacity: 0.45, transform: 'translateY(7px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
    const stop = () => {
      if (reduced.matches) animation.cancel();
    };
    reduced.addEventListener('change', stop);
    return () => {
      animation.cancel();
      reduced.removeEventListener('change', stop);
    };
  }, [view]);

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const items = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-task-id]') ?? []);
    const origin = list.current?.getBoundingClientRect().top ?? 0;
    const next = new Map<string, number>();
    const animations: Animation[] = [];
    for (const item of items) {
      const id = item.dataset.taskId!;
      const top = item.getBoundingClientRect().top - origin;
      next.set(id, top);
      if (reduced.matches || items.length > 60) continue;
      const old = positions.current.get(id);
      if (old !== undefined && old !== top) {
        animations.push(
          item.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'none' }], {
            duration: 230,
            easing: 'cubic-bezier(.2,.7,.3,1)',
          }),
        );
      } else if (old === undefined) {
        animations.push(
          item.animate(
            [
              { opacity: 0, transform: 'translateY(6px)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 200, easing: 'ease-out' },
          ),
        );
      }
    }
    positions.current = next;
    const stop = () => {
      if (reduced.matches) animations.forEach((animation) => animation.cancel());
    };
    reduced.addEventListener('change', stop);
    return () => {
      animations.forEach((animation) => animation.cancel());
      reduced.removeEventListener('change', stop);
    };
  }, [listKey]);
  useLayoutEffect(() => {
    const reset = () => positions.current.clear();
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  return { surface, list };
}
