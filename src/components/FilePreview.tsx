/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight preview modal for files attached to commission PVs (and
 * potentially other surfaces). Shows images inline, embeds PDFs via the
 * browser's native viewer, and exposes a clear "Télécharger" action so
 * clicking a thumbnail no longer triggers a forced download.
 *
 * The component supports a list of files and lets the user navigate
 * between them with prev/next or arrow keys — useful when an "avis"
 * includes several photos.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-react';

export interface PreviewFile {
  id?: string;
  url: string;
  name: string;
  /** MIME type — used to decide between <img> and <iframe>. */
  type?: string;
}

interface FilePreviewProps {
  files: PreviewFile[];
  /** Index of the file to open when the modal mounts. */
  initialIndex?: number;
  onClose: () => void;
}

function isImage(type?: string, name?: string): boolean {
  if (type && type.startsWith('image/')) return true;
  if (!name) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(name);
}

function isPdf(type?: string, name?: string): boolean {
  if (type === 'application/pdf') return true;
  if (!name) return false;
  return /\.pdf$/i.test(name);
}

export default function FilePreview({ files, initialIndex = 0, onClose }: FilePreviewProps) {
  const safeFiles = useMemo(() => files.filter((f) => f && f.url), [files]);
  const [index, setIndex] = useState<number>(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, safeFiles.length - 1))
  );

  const current = safeFiles[index];
  const total = safeFiles.length;

  const goPrev = () => setIndex((i) => (i > 0 ? i - 1 : total - 1));
  const goNext = () => setIndex((i) => (i < total - 1 ? i + 1 : 0));

  // Keyboard nav: Esc to close, arrows to switch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && total > 1) goPrev();
      else if (e.key === 'ArrowRight' && total > 1) goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!current) return null;

  const showAsImage = isImage(current.type, current.name);
  const showAsPdf = isPdf(current.type, current.name);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du fichier"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer l'aperçu"
        className="absolute inset-0 bg-aaj-dark/95 backdrop-blur-sm cursor-zoom-out"
      />

      {/* Frame */}
      <div className="relative w-full h-full max-w-6xl max-h-[95vh] flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-aaj-border bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-aaj-royal/10 text-aaj-royal flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-tight text-aaj-dark truncate">
                {current.name}
              </p>
              {total > 1 && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-aaj-gray">
                  Fichier {index + 1} sur {total}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={current.url}
              download={current.name}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-aaj-royal text-white rounded text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-aaj-dark transition-colors"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Télécharger</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="w-9 h-9 flex items-center justify-center border border-aaj-border bg-white rounded text-aaj-gray hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
          {showAsImage ? (
            <img
              src={current.url}
              alt={current.name}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          ) : showAsPdf ? (
            <iframe
              key={current.url}
              src={current.url}
              title={current.name}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <FileText size={48} className="text-aaj-gray" />
              <p className="text-sm font-bold text-aaj-dark">
                Aperçu non disponible pour ce type de fichier.
              </p>
              <a
                href={current.url}
                download={current.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-aaj-dark transition-colors"
              >
                <Download size={14} />
                Télécharger le fichier
              </a>
            </div>
          )}

          {/* Prev / Next */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Fichier précédent"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 border border-aaj-border text-aaj-dark hover:bg-aaj-royal hover:text-white transition-colors flex items-center justify-center shadow"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Fichier suivant"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 border border-aaj-border text-aaj-dark hover:bg-aaj-royal hover:text-white transition-colors flex items-center justify-center shadow"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-aaj-border bg-white">
            {safeFiles.map((f, i) => {
              const thumbIsImage = isImage(f.type, f.name);
              const active = i === index;
              return (
                <button
                  key={f.id || i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={[
                    'shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all',
                    active
                      ? 'border-aaj-royal ring-2 ring-aaj-royal/30'
                      : 'border-aaj-border hover:border-aaj-royal/50',
                  ].join(' ')}
                  title={f.name}
                  aria-label={`Voir ${f.name}`}
                >
                  {thumbIsImage ? (
                    <img
                      src={f.url}
                      alt={f.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-1">
                      <FileText size={18} className="text-aaj-royal" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-aaj-gray">
                        PDF
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
