import { useEffect } from 'react';

type Shortcuts = {
  onCommands: () => void;
  onCreate: () => void;
  onSearch: () => void;
  onHelp: () => void;
};

/** Never intercept ordinary typing, composition, or keys inside an open modal. */
export function useWorkspaceShortcuts({ onCommands, onCreate, onSearch, onHelp }: Shortcuts) {
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || document.querySelector('dialog[open]')) return;
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.code === 'KeyK' || event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault();
        onCommands();
        return;
      }
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
      )
        return;
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        onHelp();
        return;
      }
      if (event.ctrlKey || event.metaKey || !event.altKey) return;
      if (event.code === 'KeyN' || event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onCreate();
      } else if (event.code === 'Slash' || event.key === '/') {
        event.preventDefault();
        onSearch();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [onCommands, onCreate, onSearch, onHelp]);
}
