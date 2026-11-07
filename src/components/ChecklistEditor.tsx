import { useState } from 'react';
import { MAX_STEPS, MAX_STEP_TITLE } from '../domain/tasks.ts';
import type { TaskStep } from '../domain/tasks.ts';
import { newId } from '../domain/ids.ts';
import { Icon } from './Icon.tsx';

export function ChecklistEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: readonly TaskStep[];
  onChange: (steps: readonly TaskStep[]) => void;
  disabled: boolean;
}) {
  const [title, setTitle] = useState('');
  const add = () => {
    if (disabled || !title.trim() || steps.length >= MAX_STEPS) return;
    onChange([...steps, { id: newId(), title: title.trim(), completed: false }]);
    setTitle('');
  };
  return (
    <section className="checklist-editor" aria-label="Шаги задачи">
      <header>
        <h3>Шаги задачи</h3>
        <span>
          {steps.filter((step) => step.completed).length} / {steps.length}
        </span>
      </header>
      {!steps.length && <p>Большое дело проще начать с маленького шага.</p>}
      <ol>
        {steps.map((step, index) => (
          <li key={step.id}>
            <input
              type="checkbox"
              checked={step.completed}
              disabled={disabled}
              aria-label={`Готовность шага: ${step.title}`}
              onChange={() =>
                onChange(
                  steps.map((item) =>
                    item.id === step.id ? { ...item, completed: !item.completed } : item,
                  ),
                )
              }
            />
            <input
              type="text"
              maxLength={MAX_STEP_TITLE}
              value={step.title}
              disabled={disabled}
              aria-label={`Текст шага ${index + 1}`}
              onChange={(event) =>
                onChange(
                  steps.map((item) =>
                    item.id === step.id ? { ...item, title: event.target.value } : item,
                  ),
                )
              }
            />
            <button
              type="button"
              className="icon-button"
              disabled={disabled}
              aria-label={`Удалить шаг: ${step.title}`}
              onClick={() => onChange(steps.filter((item) => item.id !== step.id))}
            >
              <Icon name="close" size={15} />
            </button>
          </li>
        ))}
      </ol>
      <div className="step-composer">
        <label className="sr-only" htmlFor="new-step">
          Новый шаг
        </label>
        <input
          id="new-step"
          value={title}
          maxLength={MAX_STEP_TITLE}
          disabled={disabled || steps.length >= MAX_STEPS}
          placeholder={
            steps.length >= MAX_STEPS ? 'Достигнут лимит 20 шагов' : 'Добавить следующий шаг…'
          }
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Добавить шаг"
          disabled={disabled || !title.trim() || steps.length >= MAX_STEPS}
          onClick={add}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </section>
  );
}
