import type { Ref } from 'react';
import type { PersistenceStatus } from '../storage/taskStorage.ts';
import { Icon } from './Icon.tsx';

export function WorkspaceTopbar({
  label,
  status,
  busy,
  createRef,
  onHome,
  onSearch,
  onCreate,
  onSettings,
}: {
  label: string;
  status: PersistenceStatus;
  busy: boolean;
  createRef: Ref<HTMLButtonElement>;
  onHome: () => void;
  onSearch: () => void;
  onCreate: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="topbar">
      <a
        href="#list"
        className="mobile-brand"
        onClick={(event) => {
          event.preventDefault();
          onHome();
        }}
      >
        <span>f.</span>FOCUS.
      </a>
      <span className="workspace-label">
        Пространство <span>/</span> {label}
      </span>
      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button settings-trigger"
          aria-label="Открыть настройки"
          onClick={onSettings}
        >
          <Icon name="settings" size={18} />
          <span>Настройки</span>
        </button>
        <button
          type="button"
          className="global-search-trigger"
          aria-label="Поиск по всему пространству"
          aria-keyshortcuts="Control+k Meta+k"
          onClick={onSearch}
        >
          <Icon name="search" size={17} />
          <span>Найти что-нибудь</span>
          <kbd>⌘ / Ctrl K</kbd>
        </button>
        <button
          type="button"
          className="quick-add-trigger"
          ref={createRef}
          onClick={onCreate}
          aria-label="Создать задачу"
          aria-keyshortcuts="Alt+n"
        >
          <Icon name="plus" size={17} />
          <span>Создать задачу</span>
        </button>
      </div>
      <span
        className={`save-status${status !== 'saved' ? ' save-status--warning' : ''}`}
        role="status"
        aria-label={
          busy ? 'Сохраняем' : status === 'saved' ? 'Всё сохранено' : 'Есть несохранённые изменения'
        }
      >
        <span />
        <span className="save-status-label">
          {busy ? 'Сохраняем…' : status === 'saved' ? 'Всё сохранено' : 'Есть несохранённое'}
        </span>
      </span>
    </header>
  );
}
