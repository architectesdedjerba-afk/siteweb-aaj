/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Helper that builds a single A4 PDF out of one or more images. Used by the
 * "Avis Commissions" publishing flow so a multi-image upload is consolidated
 * into one downloadable file (req. by AAJ admin so members get a clean PV
 * rather than a folder of loose photos).
 */

import { jsPDF } from 'jspdf';

export interface ImageInput {
  /** The image data — already-loaded HTMLImageElement, blob URL, or remote URL. */
  src: string;
  /** Optional name (used in tooltips/logs only). */
  name?: string;
  /** MIME type or extension hint, used to pick JPEG/PNG. Defaults to JPEG. */
  type?: string;
}

function pickFormat(type?: string): 'JPEG' | 'PNG' {
  if (!type) return 'JPEG';
  const lower = type.toLowerCase();
  if (lower.includes('png')) return 'PNG';
  return 'JPEG';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow same-origin without CORS, but request CORS for cross-origin so
    // the resulting canvas doesn't get tainted (would block toDataURL).
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossible de charger l'image : ${url}`));
    img.src = url;
  });
}

function imageToDataUrl(img: HTMLImageElement, format: 'JPEG' | 'PNG'): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas 2D non supporté.");
  ctx.drawImage(img, 0, 0);
  // JPEG keeps file size manageable for photos; PNG preserves transparency
  // but is heavier — only used when caller specifically requests it.
  return canvas.toDataURL(format === 'PNG' ? 'image/png' : 'image/jpeg', 0.9);
}

/**
 * Build a Blob containing a PDF where each input image fills one A4 page,
 * preserving aspect ratio and centred on the page.
 */
export async function imagesToPdfBlob(images: ImageInput[]): Promise<Blob> {
  if (!images.length) throw new Error('Aucune image à convertir.');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10; // mm
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  for (let i = 0; i < images.length; i++) {
    const input = images[i];
    if (i > 0) pdf.addPage();
    const format = pickFormat(input.type);
    const img = await loadImage(input.src);
    const dataUrl = imageToDataUrl(img, format);

    // Fit-within: scale so neither width nor height exceeds the printable area.
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;
    const scale = Math.min(maxW / naturalW, maxH / naturalH);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    pdf.addImage(dataUrl, format, x, y, drawW, drawH, undefined, 'FAST');
  }

  return pdf.output('blob');
}
