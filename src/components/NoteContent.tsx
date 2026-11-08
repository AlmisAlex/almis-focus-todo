import type { ReactNode } from 'react';

/** A deliberately small, inert table/list renderer. Never interprets HTML or URLs. */
export function NoteContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .slice(0, 12)
      .map((s) => s.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (
      line.includes('|') &&
      /^[\s|:-]+$/.test(lines[i + 1] ?? '') &&
      (lines[i + 1] ?? '').includes('-')
    ) {
      const headers = cells(line),
        rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? '').includes('|') && rows.length < 80) {
        rows.push(cells(lines[i]!));
        i++;
      }
      i--;
      blocks.push(
        <div className="note-table-scroll" key={'table' + i} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {headers.map((h, j) => (
                  <th key={j} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j}>
                  {headers.map((_, k) => (
                    <td key={k}>{row[k] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else blocks.push(<p key={i}>{line || '\u00a0'}</p>);
  }
  return <div className="note-content">{blocks}</div>;
}
