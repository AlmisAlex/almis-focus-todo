import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

export function useDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus();
    return () => element?.close();
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
