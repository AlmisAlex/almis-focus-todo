import { useLayoutEffect } from 'react';

/** CSS follows the visible screen when a mobile keyboard pans or resizes it. */
export function useVisualViewport() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let baseHeight = window.innerHeight;
    let width = window.innerWidth;
    const update = () => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement &&
          !['checkbox', 'radio', 'button', 'file', 'range'].includes(active.type));
      if (!typing || width !== window.innerWidth) baseHeight = window.innerHeight;
      width = window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty('--visible-height', `${Math.max(1, height)}px`);
      root.style.setProperty('--visible-top', `${Math.max(0, viewport?.offsetTop ?? 0)}px`);
      root.dataset.keyboard = String(typing && baseHeight - height > 120);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      root.style.removeProperty('--visible-height');
      root.style.removeProperty('--visible-top');
      delete root.dataset.keyboard;
    };
  }, []);
}
