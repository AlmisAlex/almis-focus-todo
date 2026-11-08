import type { Planner, PlannerAction, Preferences } from '../domain/planner.ts';
import type { Task } from '../domain/tasks.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { PlannerPanel } from './PlannerPanel.tsx';
import { Icon } from './Icon.tsx';

export function FocusDialog({
  data,
  tasks,
  today,
  error,
  onAction,
  onPreferences,
  onClose,
}: {
  data: Planner;
  tasks: readonly Task[];
  today: string;
  error: string;
  onAction: (action: PlannerAction) => Promise<boolean>;
  onPreferences: (patch: Partial<Preferences>) => Promise<boolean>;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  return (
    <dialog
      ref={dialog}
      className="focus-dialog"
      aria-labelledby="focus-dialog-title"
      onKeyDown={trapTab}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="section-caption">ФОКУС</span>
          <h2 id="focus-dialog-title">Одно дело за раз</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть фокус-таймер"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="focus-dialog-body">
        <PlannerPanel
          data={data}
          tasks={tasks}
          today={today}
          error={error}
          onAction={onAction}
          onPreferences={onPreferences}
        />
      </div>
    </dialog>
  );
}
