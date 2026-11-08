import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { lockDialogBackground } from './dialogEnvironment.ts';

export function useDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockDialogBackground();
    element?.showModal();
    const mobile = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    const target = element?.querySelector<HTMLElement>(
      mobile ? '.dialog-heading button' : '[data-dialog-autofocus]',
    );
    target?.focus({ preventScroll: true });
    return () => {
      // Close before React removes the dialog so the native focus target survives.
      element?.close();
      unlock();
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
      else
        document.querySelector<HTMLElement>('.quick-add-trigger')?.focus({ preventScroll: true });
    };
  }, []);
  const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return { dialog, trapTab };
}
