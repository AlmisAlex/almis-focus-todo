import { useEffect, useRef, useState } from 'react';
import { useDialog } from '../hooks/useDialog.ts';
import { Icon } from './Icon.tsx';

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };
export function DrawingPad({
  onSave,
  onClose,
}: {
  onSave: (file: File) => boolean;
  onClose: () => void;
}) {
  const { dialog, trapTab } = useDialog();
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<number | null>(null);
  const [color, setColor] = useState('#3157ce');
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const cleared = useRef<Stroke[] | null>(null);
  const draw = () => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1000, 640);
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const stroke of strokes.current) {
      context.strokeStyle = stroke.color;
      context.beginPath();
      stroke.points.forEach((p, index) => {
        if (!index) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      });
      context.stroke();
    }
  };
  useEffect(draw, []);
  const close = () => {
    if (saving) return;
    if (count || cleared.current?.length) setDiscard(true);
    else onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="drawing-dialog"
      aria-labelledby="drawing-title"
      onKeyDown={(event) => {
        trapTab(event);
        event.stopPropagation();
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
    >
      <header className="dialog-heading">
        <div>
          <h2 id="drawing-title">Набросок к задаче</h2>
          <p>Нарисуй схему мышью или пальцем</p>
        </div>
        <button
          className="icon-button"
          type="button"
          disabled={saving}
          onClick={close}
          aria-label="Закрыть схему"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="drawing-tools" role="group" aria-label="Инструменты схемы">
        {['#3157ce', '#252c37', '#2c6c50', '#ac3342'].map((value, index) => (
          <button
            type="button"
            key={value}
            aria-pressed={color === value}
            onClick={() => setColor(value)}
            aria-label={
              ['Синий карандаш', 'Чёрный карандаш', 'Зелёный карандаш', 'Красный карандаш'][index]
            }
          >
            <span style={{ background: value }} />
          </button>
        ))}
        <button
          type="button"
          disabled={(!count && !cleared.current?.length) || saving}
          onClick={() => {
            if (strokes.current.length) strokes.current.pop();
            else if (cleared.current) {
              strokes.current = cleared.current;
              cleared.current = null;
            }
            setCount(strokes.current.length);
            draw();
          }}
        >
          Отменить линию
        </button>
        <button
          type="button"
          disabled={!count || saving}
          onClick={() => {
            cleared.current = strokes.current;
            strokes.current = [];
            setCount(0);
            draw();
          }}
        >
          Очистить
        </button>
      </div>
      <div className="drawing-surface">
        <canvas
          ref={canvas}
          width={1000}
          height={640}
          aria-label="Поле рисования схемы"
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0 || saving || strokes.current.length >= 100) return;
            e.preventDefault();
            active.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            const p = {
              x: ((e.clientX - r.left) * 1000) / r.width,
              y: ((e.clientY - r.top) * 640) / r.height,
            };
            strokes.current.push({ color, points: [p, { x: p.x + 0.1, y: p.y + 0.1 }] });
            setCount(strokes.current.length);
            draw();
          }}
          onPointerMove={(e) => {
            if (active.current !== e.pointerId || saving) return;
            const stroke = strokes.current.at(-1);
            if (!stroke || stroke.points.length >= 2000) return;
            const r = e.currentTarget.getBoundingClientRect();
            const p = {
              x: Math.max(0, Math.min(1000, ((e.clientX - r.left) * 1000) / r.width)),
              y: Math.max(0, Math.min(640, ((e.clientY - r.top) * 640) / r.height)),
            };
            const last = stroke.points.at(-1)!;
            stroke.points.push(p);
            const ctx = e.currentTarget.getContext('2d');
            if (ctx) {
              ctx.strokeStyle = stroke.color;
              ctx.beginPath();
              ctx.moveTo(last.x, last.y);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }
          }}
          onPointerUp={(e) => {
            if (active.current === e.pointerId) {
              active.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onPointerCancel={() => {
            active.current = null;
          }}
        />
      </div>
      <footer className="dialog-footer">
        <span>Сохранится как PNG к выбранному шагу</span>
        <button
          className="primary-button"
          type="button"
          disabled={!count || saving}
          onClick={async () => {
            setSaving(true);
            try {
              const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.current?.toBlob(
                  (b) => (b ? resolve(b) : reject(Error('Не удалось сохранить рисунок.'))),
                  'image/png',
                ),
              );
              if (!onSave(new File([blob], 'Схема.png', { type: 'image/png' }))) {
                setError(
                  'Схема не добавлена: освободи место в списке вложений. Рисунок остаётся здесь.',
                );
                setSaving(false);
              }
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Схема не сохранена.');
              setSaving(false);
            }
          }}
        >
          Добавить схему
        </button>
      </footer>
      {discard && (
        <div className="work-discard" role="alert">
          <p>Закрыть без сохранения схемы?</p>
          <button type="button" className="secondary-button" onClick={() => setDiscard(false)}>
            Продолжить рисовать
          </button>
          <button type="button" className="danger-button" onClick={onClose}>
            Отбросить схему
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="input-error">
          {error}
        </p>
      )}
    </dialog>
  );
}
