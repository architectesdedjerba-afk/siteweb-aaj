/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DocumentThumbnail — renders a small visual preview of an uploaded
 * document for the Library cards.
 *
 *   - Images (jpg/png/gif/webp) → <img> directly
 *   - PDFs                       → first page rendered to <canvas>
 *                                  via pdfjs-dist (lazy-loaded; only
 *                                  fired when the thumbnail enters
 *                                  the viewport, to avoid downloading
 *                                  every PDF on page load)
 *   - Anything else              → typed icon + extension badge
 */
import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileArchive,
  File as FileIcon,
} from 'lucide-react';

interface Props {
  url: string;
  name?: string;
  fileType?: string;
  /** Tailwind size classes; default = w-16 h-20 (compact). */
  className?: string;
}

const PDF_EXTS = ['pdf'];
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'];
const SHEET_EXTS = ['xls', 'xlsx', 'csv', 'ods'];
const DOC_EXTS = ['doc', 'docx', 'odt', 'rtf', 'txt'];
const CODE_EXTS = ['json', 'xml', 'html', 'js', 'ts', 'css'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz'];

function detectExt(url: string, fileType?: string): string {
  if (fileType) return fileType.toLowerCase().replace(/^\./, '');
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return (m?.[1] ?? '').toLowerCase();
}

function FallbackIcon({ ext, name }: { ext: string; name?: string }) {
  let Icon = FileIcon;
  let tint = 'text-aaj-gray';
  if (SHEET_EXTS.includes(ext)) {
    Icon = FileSpreadsheet;
    tint = 'text-emerald-600';
  } else if (DOC_EXTS.includes(ext)) {
    Icon = FileText;
    tint = 'text-aaj-royal';
  } else if (CODE_EXTS.includes(ext)) {
    Icon = FileCode;
    tint = 'text-indigo-500';
  } else if (ARCHIVE_EXTS.includes(ext)) {
    Icon = FileArchive;
    tint = 'text-amber-600';
  } else if (IMG_EXTS.includes(ext)) {
    Icon = FileImage;
    tint = 'text-rose-500';
  }
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-50 to-slate-100"
      title={name || ext}
    >
      <Icon size={26} className={tint} strokeWidth={1.4} />
      {ext && (
        <span className="text-[8px] font-black uppercase tracking-widest text-aaj-gray">
          {ext}
        </span>
      )}
    </div>
  );
}

/** Tiny module-level cache so we don't re-render the same PDF page. */
const PDF_CACHE = new Map<string, string>();

export function DocumentThumbnail({ url, name, fileType, className }: Props) {
  const ext = detectExt(url, fileType);
  const isPdf = PDF_EXTS.includes(ext);
  const isImg = IMG_EXTS.includes(ext);

  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(
    PDF_CACHE.get(url) ?? null
  );
  const [pdfError, setPdfError] = useState(false);

  // Observe viewport entry — only kick off the PDF render once visible.
  useEffect(() => {
    if (!isPdf || pdfDataUrl) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isPdf, pdfDataUrl]);

  // Render the first page of the PDF to a data URL.
  useEffect(() => {
    if (!isPdf || !inView || pdfDataUrl || pdfError) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Vite resolves this to a hashed asset URL; the worker runs as a Web Worker.
        const workerUrl = (
          await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        // Target ~ 200px wide thumbnail (we display it ~64px wide,
        // but render at higher res for crisp display on retina).
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = 240;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        if (cancelled) return;
        const data = canvas.toDataURL('image/jpeg', 0.7);
        PDF_CACHE.set(url, data);
        setPdfDataUrl(data);
      } catch (err) {
        if (!cancelled) {
          console.warn('PDF thumbnail render failed for', url, err);
          setPdfError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPdf, inView, url, pdfDataUrl, pdfError]);

  const sizeClass = className ?? 'w-16 h-20';

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 ${sizeClass} overflow-hidden border border-aaj-border rounded bg-white shadow-sm`}
    >
      {isImg && (
        <img
          src={url}
          alt={name || 'document'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            // Hide broken images so the fallback below shows through.
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      {isPdf && pdfDataUrl && (
        <img
          src={pdfDataUrl}
          alt={name || 'PDF preview'}
          className="w-full h-full object-cover object-top"
        />
      )}

      {isPdf && !pdfDataUrl && !pdfError && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-rose-50 to-slate-50">
          <FileText size={22} className="text-rose-500/80" strokeWidth={1.4} />
          <span className="text-[8px] font-black uppercase tracking-widest text-aaj-gray">
            PDF
          </span>
        </div>
      )}

      {((isPdf && pdfError) || (!isImg && !isPdf)) && (
        <FallbackIcon ext={ext} name={name} />
      )}
    </div>
  );
}

export default DocumentThumbnail;
