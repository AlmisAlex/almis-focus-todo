import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  addDays,
  formatDay,
  formatMonth,
  monthCells,
  moveMonth,
  weekDay,
} from '../domain/calendar.ts';
import type { Task } from '../domain/tasks.ts';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const fullDays = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

export function TaskCalendar({
  tasks,
  today,
  selected,
  onSelect,
  onUndated,
  onOpenDay,
}: {
  tasks: readonly Task[];
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onUndated: () => void;
  onOpenDay: () => void;
}) {
  const [month, setMonth] = useState(selected);
  const [focused, setFocused] = useState(selected);
  const focusAfterMove = useRef(false);
  const grid = useRef<HTMLTableElement>(null);
  const cells = monthCells(month);
  const counts = new Map<string, { active: number; completed: number }>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const count = counts.get(task.dueDate) ?? { active: 0, completed: 0 };
    if (task.completed) count.completed += 1;
    else count.active += 1;
    counts.set(task.dueDate, count);
  }
  useLayoutEffect(() => {
    setMonth(selected);
    setFocused(selected);
  }, [selected]);
  useLayoutEffect(() => {
    if (!focusAfterMove.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
    focusAfterMove.current = false;
  }, [focused, month]);
  const focusDate = (date: string) => {
    focusAfterMove.current = true;
    setFocused(date);
    setMonth(date);
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    let next: string | undefined;
    if (event.key === 'ArrowRight') next = addDays(date, 1);
    if (event.key === 'ArrowLeft') next = addDays(date, -1);
    if (event.key === 'ArrowDown') next = addDays(date, 7);
    if (event.key === 'ArrowUp') next = addDays(date, -7);
    if (event.key === 'Home') next = addDays(date, -weekDay(date));
    if (event.key === 'End') next = addDays(date, 6 - weekDay(date));
    if (event.key === 'PageUp') next = moveMonth(date, event.shiftKey ? -12 : -1);
    if (event.key === 'PageDown') next = moveMonth(date, event.shiftKey ? 12 : 1);
    if (next) {
      event.preventDefault();
      focusDate(next);
    }
  };
  const changeMonth = (delta: number) => {
    const date = moveMonth(`${month.slice(0, 7)}-01`, delta);
    setMonth(date);
    setFocused(date);
  };
  const withoutDate = tasks.filter((task) => !task.completed && !task.dueDate).length;
  return (
    <section className="calendar-panel" aria-label="Планирование по календарю">
      <div className="calendar-main">
        <header className="calendar-heading">
          <div>
            <span className="section-caption">ПЛАН НА МЕСЯЦ</span>
            <h3 id="calendar-month" aria-live="polite">
              {formatMonth(month)}
            </h3>
          </div>
          <div className="calendar-navigation">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              disabled={month.slice(0, 7) === '1900-01'}
              onClick={() => changeMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setMonth(today);
                setFocused(today);
                onSelect(today);
              }}
            >
              Сегодня
            </button>
            <button
              type="button"
              aria-label="Следующий месяц"
              disabled={month.slice(0, 7) === '9999-12'}
              onClick={() => changeMonth(1)}
            >
              ›
            </button>
          </div>
        </header>
        <table
          ref={grid}
          className="calendar-grid"
          role="grid"
          aria-labelledby="calendar-month"
          aria-describedby="calendar-help"
        >
          <thead>
            <tr>
              {weekdays.map((label, index) => (
                <th key={label} scope="col" abbr={fullDays[index]}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, week) => (
              <tr key={week}>
                {cells.slice(week * 7, week * 7 + 7).map((cell, index) => {
                  if (!cell) return <td key={index} />;
                  const count = counts.get(cell.date) ?? { active: 0, completed: 0 };
                  return (
                    <td key={cell.date} aria-selected={selected === cell.date}>
                      <button
                        type="button"
                        data-date={cell.date}
                        tabIndex={focused === cell.date ? 0 : -1}
                        aria-current={cell.date === today ? 'date' : undefined}
                        className={`${cell.inMonth ? '' : 'calendar-outside '}${selected === cell.date ? 'calendar-selected' : ''}`}
                        aria-label={`${formatDay(cell.date)}. В работе: ${count.active}. Готово: ${count.completed}`}
                        onFocus={() => setFocused(cell.date)}
                        onClick={() => {
                          setMonth(cell.date);
                          onSelect(cell.date);
                        }}
                        onKeyDown={(event) => keyboard(event, cell.date)}
                      >
                        <span>{Number(cell.date.slice(8))}</span>
                        <small aria-hidden="true">
                          {count.active ? `• ${count.active}` : count.completed ? '✓' : '\u00a0'}
                        </small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p id="calendar-help" className="calendar-help">
          Стрелки — день и неделя · Page Up / Down — месяц · Enter — выбрать
        </p>
      </div>
      <aside className="calendar-summary">
        <span className="section-caption">ВЫБРАННЫЙ ДЕНЬ</span>
        <h3>{formatDay(selected)}</h3>
        <div className="calendar-day-stats">
          <strong>
            {counts.get(selected)?.active ?? 0}
            <span>в работе</span>
          </strong>
          <strong>
            {counts.get(selected)?.completed ?? 0}
            <span>готово</span>
          </strong>
        </div>
        <p>
          Выбери день и добавь задачу ниже — срок подставится автоматически. Список показывает
          задачи этого дня.
        </p>
        <button type="button" className="primary-button" onClick={onOpenDay}>
          К задачам дня
        </button>
        <button type="button" className="secondary-button" onClick={onUndated}>
          Разобрать без срока <span>{withoutDate}</span>
        </button>
        <div className="calendar-legend">
          <span>Обводка — сегодня</span>
          <span>Число дел — невыполненные задачи</span>
        </div>
      </aside>
    </section>
  );
}
