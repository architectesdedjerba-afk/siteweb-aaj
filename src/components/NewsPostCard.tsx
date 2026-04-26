/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Facebook-style card for an internal AAJ announcement.
 * Used by the dashboard preview, the full news history view, and the
 * detail modal — passing `compact` clamps the body text and shrinks the
 * media block for the dashboard preview.
 */

import { Download, FileText, User } from 'lucide-react';
import type { NewsItem } from '../types';
import { newsCategoryStyle } from '../lib/memberConfig';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'bmp',
  'svg',
]);

function isImageAttachment(mime?: string, name?: string): boolean {
  if (mime && mime.toLowerCase().startsWith('image/')) return true;
  if (!name) return false;
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

function formatRelativeDate(value: any): string {
  let d: Date | null = null;
  if (!value) return 'Récemment';
  if (typeof value?.toDate === 'function') {
    d = value.toDate();
  } else if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) d = parsed;
  }
  if (!d) return 'Récemment';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD} j`;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface NewsPostCardProps {
  item: NewsItem;
  onClick?: () => void;
  compact?: boolean;
}

export function NewsPostCard({ item, onClick, compact = false }: NewsPostCardProps) {
  const url = item.fileUrl || item.fileBase64 || '';
  const isImage = !!url && isImageAttachment(item.fileMimeType, item.fileName);
  const categoryStyle = item.category ? newsCategoryStyle(item.category) : null;
  const authorName = item.authorDisplayName || item.authorEmail || 'AAJ';
  const photo = item.authorPhotoBase64;

  const wrapperClass = `bg-white border border-aaj-border rounded-lg overflow-hidden ${
    onClick ? 'cursor-pointer hover:border-aaj-royal/40 hover:shadow-md transition-all' : ''
  }`;

  return (
    <article className={wrapperClass} onClick={onClick}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        {photo ? (
          <img
            src={photo}
            alt={authorName}
            className="w-10 h-10 rounded-full object-cover border border-aaj-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-aaj-royal/10 text-aaj-royal flex items-center justify-center shrink-0">
            <User size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-aaj-dark truncate">{authorName}</span>
            {categoryStyle && item.category && (
              <span
                className="inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ backgroundColor: categoryStyle.bg, color: categoryStyle.text }}
              >
                {item.category}
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold text-aaj-gray uppercase tracking-wider">
            {formatRelativeDate(item.createdAt)}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-3">
        <h3
          className={`font-black uppercase tracking-tight text-aaj-dark mb-2 ${
            compact ? 'text-base' : 'text-lg'
          }`}
        >
          {item.title}
        </h3>
        <p
          className={`text-sm text-aaj-dark/80 leading-relaxed font-medium whitespace-pre-wrap ${
            compact ? 'line-clamp-3' : ''
          }`}
        >
          {item.content}
        </p>
      </div>

      {/* Media */}
      {url && isImage && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block bg-slate-50 border-t border-aaj-border flex items-center justify-center"
        >
          <img
            src={url}
            alt={item.fileName || 'Pièce jointe'}
            className={
              compact
                ? 'w-full object-cover max-h-64'
                : 'max-w-full max-h-[80vh] object-contain'
            }
            loading="lazy"
          />
        </a>
      )}
      {url && !isImage && (
        <a
          href={url}
          download={item.fileName || 'Annonce_AAJ.pdf'}
          onClick={(e) => e.stopPropagation()}
          className="mx-5 mb-4 mt-1 flex items-center gap-3 p-3 bg-slate-50 border border-aaj-border rounded hover:border-aaj-royal/40 hover:bg-white transition-all"
        >
          <div className="w-9 h-9 bg-white border border-aaj-border rounded flex items-center justify-center text-aaj-royal shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-aaj-dark line-clamp-1">
              {item.fileName || 'Document joint'}
            </p>
            <p className="text-[9px] font-bold text-aaj-gray uppercase tracking-widest">
              Télécharger
            </p>
          </div>
          <Download size={14} className="text-aaj-gray shrink-0" />
        </a>
      )}
    </article>
  );
}
