import { TaskInputError } from './tasks.ts';

export const JOURNAL_KEY = 'almis.focus.journal.v1';
export const MAX_ENTRIES = 500;
export const MAX_ENTRY_TEXT = 4000;
export type JournalEntry = {
  id: string;
  taskId: string;
  stepId: string;
  at: number;
  text: string;
  fileId?: string;
  taskTitle?: string;
  stepTitle?: string;
};
export type Journal = { version: 1; entries: JournalEntry[] };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 100;
export const emptyJournal = (): Journal => ({ version: 1, entries: [] });
export function decodeJournal(raw: string | null): Journal {
  if (raw === null) return emptyJournal();
  if (raw.length > 2_500_000)
    throw new TaskInputError('Журнал слишком большой. Сохрани полную копию.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TaskInputError('Журнал не удалось прочитать. Исходные данные сохранены.');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    (value as Journal).version !== 1 ||
    !Array.isArray((value as Journal).entries) ||
    (value as Journal).entries.length > MAX_ENTRIES
  )
    throw new TaskInputError('Некорректный формат журнала. Исходные данные сохранены.');
  const seen = new Set<string>();
  const entries = (value as Journal).entries.map((item: unknown) => {
    if (!item || typeof item !== 'object')
      throw new TaskInputError('Не удалось прочитать запись журнала.');
    const v = item as Record<string, unknown>;
    if (
      !id(v.id) ||
      !id(v.taskId) ||
      typeof v.stepId !== 'string' ||
      (v.stepId !== '' && !id(v.stepId)) ||
      !Number.isSafeInteger(v.at) ||
      (v.at as number) < 0 ||
      (v.at as number) > 8_640_000_000_000_000 ||
      typeof v.text !== 'string' ||
      !v.text.trim() ||
      v.text.length > MAX_ENTRY_TEXT ||
      (v.fileId !== undefined && !id(v.fileId)) ||
      (v.taskTitle !== undefined &&
        (typeof v.taskTitle !== 'string' || v.taskTitle.length > 180)) ||
      (v.stepTitle !== undefined &&
        (typeof v.stepTitle !== 'string' || v.stepTitle.length > 180)) ||
      seen.has(v.id)
    )
      throw new TaskInputError('Проверь текст и формат записи журнала.');
    seen.add(v.id);
    return {
      id: v.id,
      taskId: v.taskId,
      stepId: v.stepId,
      at: v.at as number,
      text: v.text,
      ...(v.fileId ? { fileId: v.fileId } : {}),
      ...(typeof v.taskTitle === 'string' ? { taskTitle: v.taskTitle } : {}),
      ...(typeof v.stepTitle === 'string' ? { stepTitle: v.stepTitle } : {}),
    };
  });
  return { version: 1, entries };
}
export type JournalAction =
  | { type: 'append'; entries: readonly JournalEntry[] }
  | { type: 'remove'; id: string }
  | { type: 'restore'; data: Journal }
  | { type: 'recover' };
export function applyJournal(data: Journal, action: JournalAction): Journal {
  if (action.type === 'recover') return emptyJournal();
  if (action.type === 'remove')
    return { version: 1, entries: data.entries.filter((e) => e.id !== action.id) };
  const incoming =
    action.type === 'restore'
      ? decodeJournal(JSON.stringify(action.data)).entries
      : decodeJournal(JSON.stringify({ version: 1, entries: action.entries })).entries;
  const ids = new Set(data.entries.map((e) => e.id));
  const entries = [...data.entries, ...incoming.filter((e) => !ids.has(e.id))];
  if (entries.length > MAX_ENTRIES)
    throw new TaskInputError('В журнале уже 500 записей. Сохрани копию и удали ненужные записи.');
  const result = { version: 1 as const, entries };
  return decodeJournal(JSON.stringify(result));
}
