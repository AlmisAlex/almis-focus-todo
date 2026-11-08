import { useEffect, useState } from 'react';
import { inferDelimiter, MAX_TABULAR_BYTES, parseDelimited } from '../domain/tabular.ts';
type State =
  { kind: 'loading' } | { kind: 'ready'; rows: string[][]; truncated: boolean } | { kind: 'error' };
export function TabularPreview({ blob, name }: { blob: Blob; name: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    void blob
      .slice(0, MAX_TABULAR_BYTES)
      .text()
      .then((text) => {
        if (alive) {
          const parsed = parseDelimited(text, inferDelimiter(text, name));
          setState({
            kind: 'ready',
            rows: parsed.rows,
            truncated: parsed.truncated || blob.size > MAX_TABULAR_BYTES,
          });
        }
      })
      .catch(() => {
        if (alive) setState({ kind: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [blob, name]);
  if (state.kind === 'loading') return <p role="status">Подготавливаем таблицу…</p>;
  if (state.kind === 'error')
    return (
      <p role="alert" className="input-error">
        Браузер не смог прочитать таблицу. Файл можно скачать целиком.
      </p>
    );
  if (!state.rows.length) return <p>Таблица пуста.</p>;
  return (
    <div className="tabular-preview">
      <div
        className="tabular-preview-scroll"
        tabIndex={0}
        role="region"
        aria-label="Прокрутка таблицы"
      >
        <table aria-label={`Таблица: ${name}`}>
          <tbody>
            {state.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.truncated && <p>Показан фрагмент: до 200 КБ, 200 строк и 30 столбцов.</p>}
    </div>
  );
}
