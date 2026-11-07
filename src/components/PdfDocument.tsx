import { useEffect, useRef, useState } from 'react';
import { AnnotationMode, getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readBoundedText } from '../domain/boundedText.ts';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Pixels and plain extracted text only: no PDF scripts, forms, links or HTML layers. */
export default function PdfDocument({ blob, name }: { blob: Blob; name: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(300);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [textOpen, setTextOpen] = useState(false);
  const [textBusy, setTextBusy] = useState(false);
  const [textError, setTextError] = useState('');
  const [textTruncated, setTextTruncated] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    let task: PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setBusy(true);
    setError('');
    setPageNumber(1);
    setZoom(1);
    void blob
      .arrayBuffer()
      .then((buffer) => {
        if (!live) return;
        task = getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: '/pdf/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdf/standard_fonts/',
          iccUrl: '/pdf/iccs/',
          wasmUrl: '/pdf/wasm/',
          useWorkerFetch: true,
          useWasm: false,
          disableFontFace: true,
          useSystemFonts: false,
          enableXfa: false,
          disableWorkerRendering: true,
          stopAtErrors: true,
          maxImageSize: 16_000_000,
          canvasMaxAreaInBytes: 16_000_000,
        });
        return task.promise;
      })
      .then((pdf) => {
        if (live && pdf) setDocument(pdf);
      })
      .catch((caught) => {
        if (live) {
          setError(
            caught?.name === 'PasswordException'
              ? 'PDF защищён паролем. Скачай его и открой в своём приложении.'
              : 'Не удалось прочитать PDF. Исходный файл доступен для скачивания.',
          );
          setBusy(false);
        }
      });
    return () => {
      live = false;
      void task?.destroy().catch(() => undefined);
    };
  }, [blob]);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(160, element.clientWidth - 20)));
    observer.observe(element);
    setWidth(Math.max(160, element.clientWidth - 20));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let live = true;
    let render: RenderTask | undefined;
    setBusy(true);
    setError('');
    void (async () => {
      const page = await document.getPage(pageNumber);
      if (!live) return;
      const original = page.getViewport({ scale: 1 });
      const logicalScale = Math.min(width / original.width, 1400 / original.height, 1.8) * zoom;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(
        logicalScale * ratio,
        4000 / Math.max(original.width, original.height),
        Math.sqrt(4_000_000 / (original.width * original.height)),
      );
      const viewport = page.getViewport({ scale });
      const target = canvas.current!;
      target.width = Math.max(1, Math.floor(viewport.width));
      target.height = Math.max(1, Math.floor(viewport.height));
      target.style.width = `${original.width * logicalScale}px`;
      target.style.height = `${original.height * logicalScale}px`;
      const context = target.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      render = page.render({
        canvas: target,
        canvasContext: context,
        viewport,
        annotationMode: AnnotationMode.DISABLE,
      });
      await render.promise;
      if (live) setBusy(false);
    })().catch((caught) => {
      if (live && caught?.name !== 'RenderingCancelledException') {
        setError('Эту страницу не удалось показать. Файл можно скачать целиком.');
        setBusy(false);
      }
    });
    return () => {
      live = false;
      render?.cancel();
    };
  }, [document, pageNumber, width, zoom]);
  useEffect(() => {
    setText('');
    setTextError('');
    setTextTruncated(false);
    if (!document || !textOpen) {
      setTextBusy(false);
      return;
    }
    let live = true;
    const controller = new AbortController();
    setTextBusy(true);
    void (async () => {
      const page = await document.getPage(pageNumber);
      if (!live) return;
      const result = await readBoundedText(page.streamTextContent(), undefined, controller.signal);
      if (live) {
        setText(result.value);
        setTextTruncated(result.truncated);
      }
    })()
      .catch((caught) => {
        if (live && caught?.name !== 'AbortError')
          setTextError('Текст недоступен. Страницу можно просмотреть выше или скачать файл.');
      })
      .finally(() => {
        if (live) setTextBusy(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [document, pageNumber, textOpen]);
  return (
    <div className="pdf-document">
      <div className="pdf-controls" role="group" aria-label="Страницы PDF">
        <button
          type="button"
          disabled={!document || pageNumber <= 1 || busy}
          onClick={() => setPageNumber((value) => value - 1)}
        >
          Назад
        </button>
        <span aria-live="polite">
          Страница {pageNumber} из {document?.numPages ?? '…'}
        </span>
        <button
          type="button"
          disabled={!document || pageNumber >= document.numPages || busy}
          onClick={() => setPageNumber((value) => value + 1)}
        >
          Дальше
        </button>
        <label>
          <span className="sr-only">Масштаб PDF</span>
          <select
            aria-label="Масштаб PDF"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value={1}>По ширине</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
            <option value={3}>300%</option>
          </select>
        </label>
      </div>
      {busy && <p role="status">Подготавливаем страницу…</p>}
      {error && (
        <p className="input-error" role="alert">
          {error}
        </p>
      )}
      <div className="pdf-canvas-surface" ref={surface}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${name}, страница ${pageNumber}`}
          hidden={!!error}
        />
      </div>
      {document && (
        <details className="pdf-text" onToggle={(event) => setTextOpen(event.currentTarget.open)}>
          <summary>Текст страницы</summary>
          {textBusy ? (
            <p role="status">Извлекаем текст…</p>
          ) : textError ? (
            <p className="input-error">{textError}</p>
          ) : (
            <pre tabIndex={0}>{text || '(на странице нет доступного текста)'}</pre>
          )}
          {textTruncated && (
            <p>Показан ограниченный фрагмент. Полный документ доступен для скачивания.</p>
          )}
        </details>
      )}
    </div>
  );
}
