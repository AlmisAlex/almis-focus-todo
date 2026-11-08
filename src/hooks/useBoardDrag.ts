import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { TaskStatus } from '../domain/tasks.ts';

type Drag = {
  id: string;
  pointer: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
};
export function useBoardDrag(
  board: RefObject<HTMLDivElement | null>,
  busy: boolean,
  onDrop: (id: string, status: TaskStatus) => void,
  onTap: (id: string) => void,
) {
  const overlay = useRef<HTMLDivElement>(null);
  const gesture = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [activeId, setActiveId] = useState('');
  const [over, setOver] = useState<TaskStatus | ''>('');
  const latestDrop = useRef(onDrop);
  const latestTap = useRef(onTap);
  latestTap.current = onTap;
  latestDrop.current = onDrop;
  const targetAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-board-status]');
    return element && board.current?.contains(element)
      ? (element.dataset.boardStatus as TaskStatus)
      : '';
  };
  const cancel = () => {
    const drag = gesture.current;
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (drag && board.current?.hasPointerCapture(drag.pointer))
      board.current.releasePointerCapture(drag.pointer);
    setActiveId('');
    setOver('');
  };
  const tick = () => {
    const drag = gesture.current,
      element = board.current;
    if (!drag?.active || !element) return;
    if (overlay.current)
      overlay.current.style.transform = `translate3d(${drag.x + 14}px, ${drag.y + 14}px, 0)`;
    const rect = element.getBoundingClientRect();
    if (drag.x < rect.left + 40) element.scrollLeft -= 9;
    if (drag.x > rect.right - 40) element.scrollLeft += 9;
    if (drag.y < 100) window.scrollBy(0, -9);
    if (drag.y > window.innerHeight - 90) window.scrollBy(0, 9);
    setOver(targetAt(drag.x, drag.y));
    frame.current = requestAnimationFrame(tick);
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    const handle = (event.target as HTMLElement).closest('[data-task-drag-handle]');
    const id = handle?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    if (busy || !id || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    (handle as HTMLElement).focus({ preventScroll: true });
    gesture.current = {
      id,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    board.current?.setPointerCapture(event.pointerId);
    suppressClick.current = false;
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointer) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 7) {
      drag.active = true;
      setActiveId(drag.id);
      frame.current = requestAnimationFrame(tick);
    }
    if (drag.active) event.preventDefault();
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const target = drag.active ? targetAt(event.clientX, event.clientY) : '';
    suppressClick.current = true;
    cancel();
    if (target) latestDrop.current(drag.id, target);
    else if (!drag.active) latestTap.current(drag.id);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault();
        suppressClick.current = true;
        cancel();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const drag = gesture.current;
      if (drag && board.current?.hasPointerCapture(drag.pointer))
        board.current.releasePointerCapture(drag.pointer);
      gesture.current = null;
    };
  }, [board]);
  useEffect(() => {
    if (busy) cancel();
  }, [busy]);
  return { activeId, over, overlay, suppressClick, down, move, up, cancel };
}
