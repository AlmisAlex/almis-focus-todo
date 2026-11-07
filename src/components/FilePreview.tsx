import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '../domain/attachments.ts';
import { fileSize, previewKind } from '../domain/attachments.ts';
import { useDialog } from '../hooks/useDialog.ts';
import { Icon } from './Icon.tsx';

export function FilePreview({ file, onClose }: { file: Attachment; onClose: () => void }) {
  const { dialog, trapTab } = useDialog();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const kind = previewKind(file.name);
  useEffect(() => {
    let alive = true;
    const objectUrl = URL.createObjectURL(
      new Blob([file.blob], { type: 'application/octet-stream' }),
    );
    const documentUrl =
      kind === 'pdf' ? URL.createObjectURL(new Blob([file.blob], { type: 'application/pdf' })) : '';
    setUrl(objectUrl);
    setPdfUrl(documentUrl);
    const prepare = async () => {
      try {
        if (kind === 'text') {
          const value = await file.blob.slice(0, 200_000).text();
          if (alive) setText(value);
        } else if (kind === 'pdf') {
          if ((await file.blob.slice(0, 5).text()) !== '%PDF-')
            throw new Error('Этот файл не похож на PDF. Его можно скачать.');
        } else if (kind === 'image') {
          const bitmap = await createImageBitmap(file.blob);
          try {
            if (bitmap.width * bitmap.height > 30_000_000)
              throw new Error('Изображение слишком большое для предпросмотра. Его можно скачать.');
            if (alive && canvas.current) {
              const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
              canvas.current.width = Math.max(1, Math.round(bitmap.width * scale));
              canvas.current.height = Math.max(1, Math.round(bitmap.height * scale));
              const context = canvas.current.getContext('2d');
              if (!context)
                throw new Error('Предпросмотр изображения недоступен. Файл можно скачать.');
              context.drawImage(bitmap, 0, 0, canvas.current.width, canvas.current.height);
            }
          } finally {
            bitmap.close();
          }
        }
      } catch (caught) {
        if (alive)
          setError(
            caught instanceof Error && caught.message.includes('скачать')
              ? caught.message
              : 'Браузер не смог показать этот формат. Файл можно скачать.',
          );
      } finally {
        if (alive) setReady(true);
      }
    };
    void prepare();
    return () => {
      alive = false;
      URL.revokeObjectURL(objectUrl);
      if (documentUrl) URL.revokeObjectURL(documentUrl);
    };
  }, [file, kind]);
  return (
    <dialog
      ref={dialog}
      className="file-preview-dialog"
      aria-label={`Просмотр файла: ${file.name}`}
      onKeyDown={(event) => {
        trapTab(event);
        event.stopPropagation();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="section-caption">ВЛОЖЕНИЕ · {fileSize(file.size)}</span>
          <h2>{file.name}</h2>
        </div>
        <button
          data-dialog-autofocus
          type="button"
          className="icon-button"
          aria-label="Закрыть просмотр файла"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="file-preview-content">
        {!ready && <p role="status">Подготавливаем просмотр…</p>}
        {kind === 'image' && (
          <canvas ref={canvas} role="img" aria-label={file.name} hidden={!ready || !!error} />
        )}
        {kind === 'text' && ready && (
          <>
            <pre tabIndex={0} aria-label="Текст файла">
              {text || '(пустой файл)'}
            </pre>
            {file.size > 200_000 && (
              <p>Показаны первые 200 КБ. Полный файл доступен для скачивания.</p>
            )}
          </>
        )}
        {kind === 'pdf' && ready && !error && (
          <div className="file-format-card">
            <Icon name="file" size={42} />
            <h3>Документ PDF</h3>
            <p>Откроется в просмотрщике браузера в отдельной вкладке.</p>
            <a className="primary-button" href={pdfUrl} target="_blank" rel="noopener noreferrer">
              Открыть PDF
            </a>
          </div>
        )}
        {kind === 'download' && (
          <div className="file-format-card">
            <Icon name="file" size={42} />
            <h3>Файл сохранён целиком</h3>
            <p>Для этого формата нужно подходящее приложение. Скачай файл, чтобы открыть его.</p>
          </div>
        )}
        {error && (
          <p className="input-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="dialog-footer">
        <span>Только в этом браузере · без загрузки на сервер</span>
        <a className="secondary-button" href={url || undefined} download={file.name}>
          <Icon name="download" size={16} /> Скачать файл
        </a>
      </footer>
    </dialog>
  );
}
