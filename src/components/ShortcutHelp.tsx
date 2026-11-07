import { useDialog } from '../hooks/useDialog.ts';
import { Icon } from './Icon.tsx';

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const { dialog, trapTab } = useDialog();
  return (
    <dialog
      ref={dialog}
      className="task-dialog shortcut-dialog"
      aria-labelledby="shortcuts-title"
      onKeyDown={trapTab}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="shortcuts-title">Горячие клавиши</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть подсказки"
        >
          <Icon name="close" />
        </button>
      </header>
      <dl className="shortcut-list">
        {[
          ['Ctrl / ⌘ K', 'Найти задачу или раздел'],
          ['Alt N', 'Новая задача'],
          ['Alt /', 'Поиск в списке'],
          ['?', 'Эта подсказка'],
          ['Esc', 'Закрыть окно'],
          ['Ctrl / ⌘ Enter', 'Сохранить задачу в редакторе'],
        ].map(([key, text]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p>Сочетания не мешают вводу текста.</p>
    </dialog>
  );
}
