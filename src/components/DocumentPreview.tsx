import { useEffect, useState } from 'react';
import { ZipReader } from '@zip.js/zip.js/index-native.js';
import type { FileEntry } from '@zip.js/zip.js/index-native.js';
import { BoundedArchiveReader } from '../storage/archiveReader.ts';
import { fileSize } from '../domain/attachments.ts';

const MAX_PART = 1024 * 1024;
type Preview = { label: string; rows: string[][]; truncated: boolean };

async function xmlPart(entry: FileEntry, signal: AbortSignal): Promise<Document> {
  if (entry.uncompressedSize > MAX_PART)
    throw new Error('Часть документа слишком велика для просмотра.');
  let bytes = 0,
    text = '';
  const decoder = new TextDecoder();
  const sink = new WritableStream<Uint8Array>({
    write(chunk) {
      bytes += chunk.byteLength;
      if (bytes > MAX_PART) throw new Error('Часть документа слишком велика для просмотра.');
      text += decoder.decode(chunk, { stream: true });
    },
  });
  await entry.getData(sink, { signal, useWebWorkers: false, checkSignature: true });
  text += decoder.decode();
  if (/<!doctype/i.test(text)) throw new Error('Этот XML не подходит для безопасного просмотра.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new Error('Не удалось прочитать структуру документа.');
  return doc;
}
const nodes = (root: Document | Element, tag: string) =>
  Array.from(root.getElementsByTagNameNS('*', tag));
const content = (root: Document | Element) =>
  nodes(root, 't')
    .map((node) => node.textContent ?? '')
    .join('');

async function inspect(blob: Blob, name: string, signal: AbortSignal): Promise<Preview> {
  if (blob.size > 32 * 1024 * 1024)
    throw new Error('Большой документ сохранён целиком. Для просмотра скачай файл.');
  const reader = new ZipReader(new BoundedArchiveReader(blob), {
    useWebWorkers: false,
    strictness: 'strict',
  });
  try {
    const entries: FileEntry[] = [];
    let count = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      if (++count > 500) throw new Error('В документе слишком много частей для просмотра.');
      if (entry.encrypted) throw new Error('Зашифрованный архив нужно открыть на устройстве.');
      if (!entry.directory) entries.push(entry);
    }
    const result: Preview = { label: 'Содержимое ZIP', rows: [], truncated: false };
    let characters = 0;
    const add = (row: string[]) => {
      if (result.rows.length >= 200 || characters >= 200_000) {
        result.truncated = true;
        return;
      }
      const cells = row.slice(0, 30).map((value) => {
        const cell = value.slice(0, 200_000 - characters);
        characters += cell.length;
        if (cell.length !== value.length) result.truncated = true;
        return cell;
      });
      if (row.length > 30) result.truncated = true;
      result.rows.push(cells);
    };
    const ext = name.split('.').at(-1)?.toLowerCase();
    if (ext === 'docx') {
      result.label = 'Текст документа';
      const part = entries.find((entry) => entry.filename === 'word/document.xml');
      if (!part) throw new Error('В файле не найден текст DOCX.');
      for (const paragraph of nodes(await xmlPart(part, signal), 'p')) add([content(paragraph)]);
    } else if (ext === 'xlsx') {
      result.label = 'Значения ячеек';
      const sharedPart = entries.find((entry) => entry.filename === 'xl/sharedStrings.xml');
      const shared = sharedPart ? nodes(await xmlPart(sharedPart, signal), 'si').map(content) : [];
      const sheets = entries
        .filter((entry) => /^xl\/worksheets\/[^/]+\.xml$/.test(entry.filename))
        .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
      if (!sheets.length) throw new Error('В файле не найдены листы XLSX.');
      if (sheets.length > 3) result.truncated = true;
      for (const sheet of sheets.slice(0, 3)) {
        add([sheet.filename]);
        for (const row of nodes(await xmlPart(sheet, signal), 'row')) {
          const cells: string[] = [];
          for (const cell of nodes(row, 'c')) {
            const letters = cell.getAttribute('r')?.match(/^[A-Z]+/i)?.[0] ?? '';
            let column = 0;
            for (const char of letters.toUpperCase())
              column = column * 26 + char.charCodeAt(0) - 64;
            const index = letters ? column - 1 : cells.length;
            if (index < 0 || index >= 30) {
              result.truncated = true;
              continue;
            }
            const value = nodes(cell, 'v')[0]?.textContent ?? '';
            cells[index] =
              cell.getAttribute('t') === 's'
                ? (shared[Number(value)] ?? '')
                : cell.getAttribute('t') === 'inlineStr'
                  ? content(cell)
                  : value;
          }
          add(Array.from({ length: cells.length }, (_, index) => cells[index] ?? ''));
        }
      }
    } else if (ext === 'pptx') {
      result.label = 'Текст слайдов';
      const slides = entries
        .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.filename))
        .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
      if (!slides.length) throw new Error('В файле не найдены слайды PPTX.');
      if (slides.length > 20) result.truncated = true;
      for (const [index, slide] of slides.slice(0, 20).entries()) {
        add([`Слайд ${index + 1}`, content(await xmlPart(slide, signal))]);
      }
    } else {
      for (const entry of entries)
        add([
          entry.filename.replace(/[\u0000-\u001f\u007f]/g, '_').slice(0, 300),
          fileSize(entry.uncompressedSize),
        ]);
    }
    return result;
  } finally {
    await reader.close();
  }
}

export default function DocumentPreview({ blob, name }: { blob: Blob; name: string }) {
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setResult(null);
    setError('');
    void inspect(blob, name, controller.signal)
      .then((value) => {
        if (alive) setResult(value);
      })
      .catch((caught) => {
        if (alive)
          setError(caught instanceof Error ? caught.message : 'Не удалось прочитать документ.');
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [blob, name]);
  if (error) return <p role="alert">{error} Оригинал доступен для скачивания.</p>;
  if (!result) return <p role="status">Читаем документ…</p>;
  return (
    <section className="document-preview">
      <h3>{result.label}</h3>
      <p>
        Упрощённый просмотр: макет, изображения, ссылки и активные объекты не показываются. Формулы
        не вычисляются.
      </p>
      <div className="document-table-scroll" role="region" aria-label={result.label} tabIndex={0}>
        <table>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, column) => (
                  <td key={column}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.rows.length && <p>Нет текста для просмотра.</p>}
      {result.truncated && <p>Показана часть документа. Полный файл доступен для скачивания.</p>}
    </section>
  );
}
