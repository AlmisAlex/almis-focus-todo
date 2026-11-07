import { TaskInputError, validDate } from './tasks.ts';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDate(value: string): Date {
  if (!value || !validDate(value)) throw new TaskInputError('Укажите корректную дату.');
  return new Date(`${value}T12:00:00Z`);
}
function serialize(date: Date): string {
  if (date.getUTCFullYear() < 1900) return '1900-01-01';
  if (date.getUTCFullYear() > 9999) return '9999-12-31';
  return date.toISOString().slice(0, 10);
}

/** UTC calendar arithmetic avoids DST jumps; dates have no time-of-day semantics. */
export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return serialize(date);
}

export function moveMonth(value: string, delta: number): string {
  const date = parseDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const end = new Date(date.getTime());
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  return serialize(date);
}

export function weekDay(value: string): number {
  return (parseDate(value).getUTCDay() + 6) % 7;
}

export type CalendarCell = { date: string; inMonth: boolean } | null;
export function monthCells(month: string): CalendarCell[] {
  const first = `${month.slice(0, 7)}-01`;
  const date = parseDate(first);
  date.setUTCDate(date.getUTCDate() - weekDay(first));
  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(date.getTime());
    cell.setUTCDate(cell.getUTCDate() + index);
    const key = cell.toISOString().slice(0, 10);
    if (cell.getUTCFullYear() < 1900 || cell.getUTCFullYear() > 9999) return null;
    return { date: key, inMonth: key.slice(0, 7) === month.slice(0, 7) };
  });
}

export function formatDay(value: string): string {
  return new Intl.DateTimeFormat('ru', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDate(value));
}
export function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    parseDate(value),
  );
}
