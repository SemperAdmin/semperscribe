'use client';

/**
 * The official fillable form, shown being filled.
 *
 * A browser's own PDF viewer shows a dynamic XFA form as its placeholder
 * page ("please wait..."), so the blob iframe the other previews use
 * cannot show the NAVMC 10274 export. pdf.js carries an XFA engine: with
 * `enableXfa` it lays the form out itself, binds the datasets the app
 * wrote, and renders each page as HTML through its XfaLayer. That is what
 * this draws, read-only, one sheet per page, scaled to the pane.
 *
 * The bytes shown are the export's own bytes (src/lib/xfa-form-fill.ts),
 * so the preview is the file Acrobat opens, laid out by a second engine.
 * The redraw (src/services/pdf/navmc10274Generator.ts) remains the
 * preview and the export once a signature field is placed.
 */
import { useEffect, useRef, useState } from 'react';
import { getPdfWorkerSrc } from '@/lib/pdf-worker';
import './xfa-preview.css';

interface XfaFormPreviewProps {
  blob: Blob;
  className?: string;
}

/** pdf.js asks the link service only when the form carries a link; this form carries none. */
const NO_LINKS = { addLinkAttributes() { /* no links on the form */ } };

export function XfaFormPreview({ blob, className }: XfaFormPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  // Re-layout when the pane changes width; the sheets scale to it.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth(prev => (Math.abs(prev - w) < 4 ? prev : w));
    });
    observer.observe(host);
    setWidth(host.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let doc: { destroy(): Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
        }
        // The copy is deliberate: pdfjs transfers the buffer to its worker.
        const data = new Uint8Array(await blob.arrayBuffer());
        const loaded = await pdfjs.getDocument({ data, enableXfa: true, isEvalSupported: false, useSystemFonts: true }).promise;
        doc = loaded;
        const host = hostRef.current;
        if (cancelled || !host) return;
        const paneWidth = (width || host.clientWidth || 644) - 32;
        const sheets: HTMLElement[] = [];
        for (let n = 1; n <= loaded.numPages; n++) {
          const page = await loaded.getPage(n);
          const xfaHtml = await page.getXfa();
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = Math.max(0.25, paneWidth / base.width);
          const viewport = page.getViewport({ scale });
          const sheet = document.createElement('div');
          sheet.className = 'xfaPreviewPage';
          sheet.dataset.page = String(n);
          sheet.style.width = `${Math.round(viewport.width)}px`;
          sheet.style.height = `${Math.round(viewport.height)}px`;
          const layer = document.createElement('div');
          sheet.append(layer);
          if (xfaHtml) {
            pdfjs.XfaLayer.render({
              viewport: viewport.clone({ dontFlip: true }),
              div: layer,
              xfaHtml,
              annotationStorage: loaded.annotationStorage,
              linkService: NO_LINKS as unknown as Parameters<typeof pdfjs.XfaLayer.render>[0]['linkService'],
              intent: 'print',
            });
          }
          sheets.push(sheet);
        }
        if (cancelled) return;
        host.replaceChildren(...sheets);
        setPageCount(loaded.numPages);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy().catch(() => undefined);
    };
  }, [blob, width]);

  return (
    <div className={className} data-testid="official-form-preview" data-pages={pageCount ?? undefined}>
      {error && (
        <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-foreground">
          The official form could not be laid out for preview ({error}). The export is unaffected.
        </div>
      )}
      <div ref={hostRef} className="xfaPreviewHost" aria-label="Official form preview" />
    </div>
  );
}
