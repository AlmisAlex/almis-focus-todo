import test from 'node:test';
import assert from 'node:assert/strict';
import {
  taskDraft,
  draftChanges,
  draftDetails,
  validatePendingFiles,
  materializeDraft,
} from '../src/domain/taskDraft.ts';
import { createTask } from '../src/domain/tasks.ts';
import { MAX_FILE_SIZE } from '../src/domain/attachments.ts';

test('typed but unconfirmed next step is included once when submitting the modal', () => {
  const draft = { ...taskDraft(), title: 'Задача', stepDraft: '  Последний набранный шаг  ' };
  const submitted = materializeDraft(draft);
  assert.equal(submitted.steps.length, 1);
  assert.equal(submitted.steps[0]?.title, 'Последний набранный шаг');
  assert.equal(submitted.stepDraft, '');
  assert.deepEqual(materializeDraft(submitted), submitted);
  assert.equal(draft.steps.length, 0);
});

test('modal draft preserves unchanged fields and emits only title edits', () => {
  const base = taskDraft({
    ...createTask('Исходная', 'id', 100),
    notes: 'Заметка',
    dueDate: '2026-11-09',
    steps: [{ id: 's', title: 'Шаг', completed: true }],
  });
  const change = draftChanges(base, { ...base, title: 'Новый текст' });
  assert.deepEqual(change, { title: 'Новый текст', details: {} });
  assert.deepEqual(base.steps, [{ id: 's', title: 'Шаг', completed: true }]);
});
test('new modal includes defaults and explicit removal of focus/date in creation details', () => {
  const draft = taskDraft(undefined, {
    projectId: 'project',
    dueDate: '2026-11-08',
    focusDate: '2026-11-07',
  });
  const details = draftDetails({
    ...draft,
    title: 'Задача',
    focusDate: '',
    dueDate: '',
    notes: '  Детали  ',
  });
  assert.deepEqual(details, {
    notes: 'Детали',
    dueDate: '',
    priority: 'normal',
    projectId: 'project',
    focusDate: '',
    steps: [],
    tags: [],
    workState: 'todo',
    recurrence: '',
  });
});
test('modal draft detects checklist changes separately from current task state', () => {
  const base = taskDraft(createTask('Задача', 'id', 100));
  const steps = [{ id: 'new', title: 'Первый шаг', completed: false }];
  assert.deepEqual(draftChanges(base, { ...base, steps }), {
    title: undefined,
    details: { steps },
  });
});
test('pending file validation respects single file and combined store quotas without stress allocation', () => {
  validatePendingFiles([new File(['ok'], 'tiny.txt')], []);
  assert.throws(() => validatePendingFiles([{ size: MAX_FILE_SIZE + 1 } as File], []), /Размер/);
  assert.throws(
    () =>
      validatePendingFiles(
        [new File(['ok'], 'tiny.txt')],
        Array.from({ length: 100 }, () => ({ size: 0 })),
      ),
    /100 файлов/,
  );
});
