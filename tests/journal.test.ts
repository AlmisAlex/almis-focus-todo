import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJournal,
  decodeJournal,
  emptyJournal,
  JOURNAL_KEY,
  MAX_ENTRIES,
} from '../src/domain/journal.ts';
import type { JournalEntry } from '../src/domain/journal.ts';
import { commitJournal } from '../src/storage/journalStorage.ts';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../src/storage/workspaceBackup.ts';
import { defaultPlanner, decodePlanner, updatePlanner } from '../src/domain/planner.ts';

const entry = (id: string, overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  taskId: 'task1',
  stepId: 'step1',
  at: 1000,
  text: 'Заметка по шагу',
  ...overrides,
});
class Store {
  values = new Map<string, string>();
  fail = '';
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (key === this.fail) throw new DOMException('Synthetic quota', 'QuotaExceededError');
    this.values.set(key, value);
  }
}
test('journal absence reads empty without writing; notes and step scope roundtrip', () => {
  assert.deepEqual(decodeJournal(null), emptyJournal());
  const data = applyJournal(emptyJournal(), {
    type: 'append',
    entries: [entry('a', { text: 'Строка1\nСтрока2' })],
  });
  assert.deepEqual(decodeJournal(JSON.stringify(data)), data);
});
test('independent journal writes and retried IDs keep both intentions once', () => {
  const store = new Store();
  commitJournal(store, { type: 'append', entries: [entry('a')] });
  commitJournal(store, { type: 'append', entries: [entry('b', { stepId: '' })] });
  const retried = commitJournal(store, {
    type: 'append',
    entries: [entry('a', { text: 'Stale alternate' })],
  });
  assert.equal(retried.entries.length, 2);
  assert.equal(retried.entries[0]?.text, 'Заметка по шагу');
});
test('journal rejects duplicates, invalid references, oversized text and invalid timestamps', () => {
  for (const entries of [
    [entry('a'), entry('a')],
    [entry('a', { taskId: '' })],
    [entry('a', { text: 'x'.repeat(4001) })],
    [entry('a', { at: -1 })],
    [entry('a', { at: Number.NaN })],
    [entry('a', { fileId: '' })],
  ])
    assert.throws(() => decodeJournal(JSON.stringify({ version: 1, entries })));
});
test('journal write refusal leaves readable original and same batch can retry', () => {
  const store = new Store();
  commitJournal(store, { type: 'append', entries: [entry('a')] });
  const original = store.getItem(JOURNAL_KEY);
  store.fail = JOURNAL_KEY;
  const action = { type: 'append' as const, entries: [entry('b')] };
  assert.throws(() => commitJournal(store, action));
  assert.equal(store.getItem(JOURNAL_KEY), original);
  store.fail = '';
  commitJournal(store, action);
  assert.equal(commitJournal(store, action).entries.length, 2);
});
test('explicit corrupt journal recovery keeps complete original before replacement', () => {
  const store = new Store();
  const raw = '{"version":1,';
  store.setItem(JOURNAL_KEY, raw);
  assert.throws(() => commitJournal(store, { type: 'append', entries: [entry('a')] }));
  assert.equal(store.getItem(JOURNAL_KEY), raw);
  commitJournal(store, { type: 'recover' });
  assert.equal(store.getItem('almis.focus.journal.recovery'), raw);
  assert.deepEqual(decodeJournal(store.getItem(JOURNAL_KEY)), emptyJournal());
});
test('failed recovery copy preserves corrupt original; restore can recover and retry idempotently', () => {
  const store = new Store();
  store.setItem(JOURNAL_KEY, 'incomplete journal');
  store.fail = 'almis.focus.journal.recovery';
  const action = { type: 'restore' as const, data: { version: 1 as const, entries: [entry('a')] } };
  assert.throws(() => commitJournal(store, action));
  assert.equal(store.getItem(JOURNAL_KEY), 'incomplete journal');
  store.fail = '';
  commitJournal(store, action);
  assert.equal(store.getItem('almis.focus.journal.recovery'), 'incomplete journal');
  assert.equal(commitJournal(store, action).entries.length, 1);
});
test('journal entry limit rejects whole action without replacing existing records', () => {
  const store = new Store();
  commitJournal(store, { type: 'append', entries: [entry('existing')] });
  const original = store.getItem(JOURNAL_KEY);
  assert.throws(() =>
    commitJournal(store, {
      type: 'append',
      entries: Array.from({ length: MAX_ENTRIES }, (_, i) => entry('new' + i)),
    }),
  );
  assert.equal(store.getItem(JOURNAL_KEY), original);
});
test('full backup6 includes orphan step notes, file references and bytes; old backup5 still reads', async () => {
  const file = {
    id: 'file1',
    taskId: 'task1',
    name: 'example.txt',
    type: 'text/plain',
    size: 4,
    createdAt: 1,
    blob: new Blob(['note']),
  };
  const journal = {
    version: 1 as const,
    entries: [entry('a'), entry('b', { fileId: 'file1', text: 'example.txt' })],
  };
  const raw = await exportWorkspaceBackup([], [], [file], defaultPlanner(), journal);
  assert.equal(JSON.parse(raw).version, 6);
  const restored = importWorkspaceBackup(raw);
  assert.deepEqual(restored.journal, journal);
  assert.equal(await restored.attachments[0]?.blob.text(), 'note');
  assert.equal(restored.tasks.length, 0);
  assert.equal(JSON.parse(await exportWorkspaceBackup([], [], [])).version, 5);
});
test('invalid journal inside backup is rejected before import', async () => {
  const raw = JSON.parse(await exportWorkspaceBackup([], [], [], defaultPlanner(), emptyJournal()));
  raw.journal = { version: 1, entries: [entry('a', { text: '' })] };
  assert.throws(() => importWorkspaceBackup(JSON.stringify(raw)));
});
test('custom focus duration survives reload and does not change active countdown', () => {
  let data = updatePlanner(defaultPlanner(), {
    type: 'preferences',
    patch: { focusMinutes: 7, breakMinutes: 3 },
  });
  data = updatePlanner(data, {
    type: 'start',
    id: 'timer1',
    taskId: '',
    title: '',
    kind: 'focus',
    now: 1000,
  });
  assert.equal(data.timer?.duration, 7 * 60_000);
  data = updatePlanner(data, { type: 'preferences', patch: { focusMinutes: 1 } });
  assert.equal(decodePlanner(JSON.stringify(data)).preferences.focusMinutes, 1);
  assert.equal(data.timer?.duration, 7 * 60_000);
  assert.throws(() => updatePlanner(data, { type: 'preferences', patch: { focusMinutes: 0 } }));
  assert.throws(() => updatePlanner(data, { type: 'preferences', patch: { focusMinutes: 121 } }));
});

test('card columns and legacy preferences roundtrip without accepting invalid layouts', () => {
  const original = defaultPlanner();
  const cards = updatePlanner(original, {
    type: 'preferences',
    patch: { layout: 'cards', columns: 3 },
  });
  assert.equal(decodePlanner(JSON.stringify(cards)).preferences.columns, 3);
  assert.equal(decodePlanner(JSON.stringify(original)).preferences.layout, 'list');
  const invalid = structuredClone(cards) as unknown as { preferences: { columns: number } };
  invalid.preferences.columns = 4;
  assert.throws(() => decodePlanner(JSON.stringify(invalid)));
});
test('orphan metadata roundtrips and deleting an entry preserves other records', () => {
  const data = applyJournal(emptyJournal(), {
    type: 'append',
    entries: [
      entry('a', { taskTitle: 'Проект', stepTitle: 'Прежний шаг' }),
      entry('b', { fileId: 'file1', text: 'example.txt' }),
    ],
  });
  assert.equal(decodeJournal(JSON.stringify(data)).entries[0]?.taskTitle, 'Проект');
  assert.equal(applyJournal(data, { type: 'remove', id: 'a' }).entries[0]?.fileId, 'file1');
  assert.equal(data.entries.length, 2);
});
