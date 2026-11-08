let depth = 0;
let restore: (() => void) | undefined;

/** Nested dialogs share one background lock. Acquire before showModal can scroll a field. */
export function lockDialogBackground() {
  if (depth++ === 0) {
    const body = document.body;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const names = ['position', 'top', 'left', 'right', 'width', 'overflow'] as const;
    const before = names.map(
      (name) =>
        [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)] as const,
    );
    body.style.position = 'fixed';
    body.style.top = `-${scroll.y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    restore = () => {
      for (const [name, value, priority] of before) {
        if (value) body.style.setProperty(name, value, priority);
        else body.style.removeProperty(name);
      }
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--depth === 0) {
      restore?.();
      restore = undefined;
    }
  };
}
