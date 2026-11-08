import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDelimited, inferDelimiter } from '../src/domain/tabular.ts';
test('CSV supports quoted delimiters, escaped quotes and multiline values', () => {
  assert.deepEqual(
    parseDelimited('Имя,Заметка\r\n"а,б","Он сказал ""да""\nи продолжил"', ',').rows,
    [
      ['Имя', 'Заметка'],
      ['а,б', 'Он сказал "да"\nи продолжил'],
    ],
  );
});
test('TSV and semicolon detection ignore quoted delimiters', () => {
  assert.equal(inferDelimiter('"а,б";Статус\nГотово;Да', 'table.csv'), ';');
  assert.equal(inferDelimiter('а\tб', 'table.tsv'), '\t');
  assert.deepEqual(parseDelimited('a\tb\n1\t2', '\t').rows, [
    ['a', 'b'],
    ['1', '2'],
  ]);
});
test('table preview bounds rows, columns and source while retaining empty cells', () => {
  assert.deepEqual(parseDelimited('a,,c\n', ',').rows, [['a', '', 'c']]);
  const rows = parseDelimited(Array(201).fill('a').join('\n'), ',');
  assert.equal(rows.rows.length, 200);
  assert.ok(rows.truncated);
  const columns = parseDelimited(Array(31).fill('a').join(','), ',');
  assert.equal(columns.rows[0]?.length, 30);
  assert.ok(columns.truncated);
  assert.ok(parseDelimited('a'.repeat(200001), ',').truncated);
});
