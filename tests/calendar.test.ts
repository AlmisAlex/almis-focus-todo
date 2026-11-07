import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDay, monthCells, moveMonth, weekDay } from '../src/domain/calendar.ts';
import { matchesView, queryTasks } from '../src/domain/taskQueries.ts';
import { createTask, replayTaskActions, updateTasks } from '../src/domain/tasks.ts';

const task = {
  ...createTask('Задача', 'one', 100),
  dueDate: '2026-11-07',
  priority: 'high' as const,
  notes: 'Сохранить заметку',
  completed: true,
};

test('calendar arithmetic crosses month/year and DST boundaries without moving dates', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-25', 7), '2026-11-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
});
test('month navigation clamps day but preserves valid dates and schema boundaries', () => {
  assert.equal(moveMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(moveMonth('2028-01-31', 1), '2028-02-29');
  assert.equal(moveMonth('2028-02-29', 12), '2029-02-28');
  assert.equal(moveMonth('2026-12-31', 1), '2027-01-31');
  assert.equal(moveMonth('1900-01-01', -1), '1900-01-01');
  assert.equal(moveMonth('9999-12-31', 1), '9999-12-31');
  assert.equal(addDays('9999-12-31', 1), '9999-12-31');
  assert.equal(addDays('1900-01-01', -1), '1900-01-01');
});
test('month grid starts Monday and has six weeks with each month day exactly once', () => {
  const cells = monthCells('2028-02-17');
  assert.equal(cells.length, 42);
  assert.equal(weekDay(cells[0]!.date), 0);
  const days = cells.filter((cell) => cell?.inMonth).map((cell) => cell!.date);
  assert.equal(days.length, 29);
  assert.equal(new Set(days).size, 29);
  assert.equal(days[0], '2028-02-01');
  assert.equal(days.at(-1), '2028-02-29');
});
test('calendar rejects invalid dates and renders boundary filler cells without invalid dates', () => {
  assert.throws(() => addDays('2026-02-30', 1));
  assert.throws(() => moveMonth('', 1));
  for (const month of ['1900-01-01', '9999-12-31']) {
    const cells = monthCells(month);
    assert.equal(cells.length, 42);
    for (const cell of cells)
      if (cell) assert.ok(cell.date >= '1900-01-01' && cell.date <= '9999-12-31');
  }
  assert.ok(formatDay('2026-11-07').includes('2026'));
});
test('upcoming is today plus six days, excluding completed/unscheduled/outside dates', () => {
  const make = (id: string, dueDate: string, completed = false) => ({
    ...task,
    id,
    dueDate,
    completed,
  });
  const tasks = [
    make('past', '2026-11-06'),
    make('today', '2026-11-07'),
    make('last', '2026-11-13'),
    make('later', '2026-11-14'),
    make('done', '2026-11-08', true),
    make('none', ''),
  ];
  assert.deepEqual(
    queryTasks(tasks, 'upcoming', '', 'due', '2026-11-07').map((item) => item.id),
    ['today', 'last'],
  );
  assert.deepEqual(
    queryTasks(tasks, 'undated', '', 'newest', '2026-11-07').map((item) => item.id),
    ['none'],
  );
  assert.equal(
    matchesView(
      { ...createTask('Без срока', 'no-date', 100), completed: false },
      'undated',
      '2026-11-07',
    ),
    true,
  );
});
test('date assignment only changes date and never resurrects deleted tasks', () => {
  const result = updateTasks([task], {
    type: 'set-dates',
    changes: [
      { id: 'one', dueDate: '2026-12-01' },
      { id: 'missing', dueDate: '2026-12-02' },
    ],
  });
  assert.deepEqual(result, [{ ...task, dueDate: '2026-12-01' }]);
  assert.equal(task.dueDate, '2026-11-07');
  assert.throws(() =>
    updateTasks([task], { type: 'set-dates', changes: [{ id: 'one', dueDate: 'not-date' }] }),
  );
});
test('undo restores old dates only when date was not changed since scheduling', () => {
  const tasks = [
    { ...task, dueDate: '2026-12-01' },
    { ...task, id: 'two', dueDate: '2027-01-01' },
  ];
  const result = updateTasks(tasks, {
    type: 'set-dates',
    changes: [
      { id: 'one', dueDate: '', expectedDate: '2026-12-01' },
      { id: 'two', dueDate: '2026-11-01', expectedDate: '2026-12-01' },
    ],
  });
  assert.equal(result[0]?.dueDate, '');
  assert.equal(result[1]?.dueDate, '2027-01-01');
});
test('replaying a date change preserves another tab title/note updates and is idempotent', () => {
  const latest = [{ ...task, title: 'Новый текст другой вкладки', notes: 'Новая заметка' }];
  const action = { type: 'set-dates' as const, changes: [{ id: 'one', dueDate: '2026-12-31' }] };
  const once = replayTaskActions(latest, [action]);
  assert.deepEqual(once, [{ ...latest[0], dueDate: '2026-12-31' }]);
  assert.deepEqual(replayTaskActions(once, [action]), once);
});
