import type { TaskView } from '../domain/taskQueries.ts';
import { Icon } from './Icon.tsx';

export function MobileScopePicker({
  view,
  options,
  counts,
  onChange,
}: {
  view: TaskView;
  options: readonly { id: TaskView; label: string }[];
  counts: Readonly<Record<string, number>>;
  onChange: (view: TaskView) => void;
}) {
  return (
    <details
      className="mobile-filters mobile-scope-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label="Разделы" title="Другие разделы">
        <Icon name="layers" size={15} />
        <span>Разделы</span>
      </summary>
      <label>
        <span>Раздел</span>
        <select
          aria-label="Раздел задач"
          value={view}
          onChange={(event) => {
            onChange(event.target.value as TaskView);
            const menu = event.currentTarget.closest('details');
            if (menu) menu.open = false;
          }}
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {counts[item.id]}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}
