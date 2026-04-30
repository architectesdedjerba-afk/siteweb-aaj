import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Cropper, { type Area } from 'react-easy-crop';
import { XCircle, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface PhotoCropperModalProps {
  /** Fichier source choisi par l'utilisateur. Quand `null`, la modal est fermée. */
  file: File | null;
  /** Annulation utilisateur (Échap, clic backdrop, bouton Annuler). */
  onCancel: () => void;
  /** Crop validé : data URL JPEG prêt à uploader (déjà compressé). */
  onConfirm: (dataUrl: string) => void;
  /** Taille de sortie en pixels sur chaque côté (carré). Défaut 600. */
  outputSize?: number;
  /** Qualité JPEG 0-1. Défaut 0.85. */
  quality?: number;
  /** Forme du masque de crop : "round" ou "rect". Défaut "round" (avatar). */
  cropShape?: 'round' | 'rect';
}

/**
 * Modal de recadrage / positionnement / zoom d'une photo de profil avant
 * upload. Drag pour repositionner, slider ou molette pour zoomer. Output :
 * un data URL JPEG carré de `outputSize`x`outputSize` (par défaut 600 px,
 * quality 0.85) — typiquement 30-150 KB pour une photo de visage.
 */
export function PhotoCropperModal({
  file,
  onCancel,
  onConfirm,
  outputSize = 600,
  quality = 0.85,
  cropShape = 'round',
}: PhotoCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger le fichier en data URL dès qu'il change.
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setError(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.onerror = () => setError('Lecture du fichier impossible.');
    reader.readAsDataURL(file);
  }, [file]);

  // Échap = annuler.
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onCancel]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    setError(null);
    try {
      const dataUrl = await renderCroppedImage(
        imageSrc,
        croppedAreaPixels,
        outputSize,
        quality
      );
      onConfirm(dataUrl);
    } catch (err) {
      console.error('PhotoCropper error:', err);
      setError('Impossible de générer la photo recadrée.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-aaj-dark/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-aaj-border flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">
              Recadrer votre photo
            </h3>
            <p className="text-[10px] text-aaj-gray font-bold uppercase tracking-widest mt-1">
              Glissez pour positionner · Molette ou slider pour zoomer
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-aaj-gray hover:text-aaj-dark transition-colors"
            aria-label="Fermer"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="bg-aaj-dark relative h-[420px] sm:h-[480px] w-full">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={cropShape}
              showGrid={false}
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.4}
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs uppercase tracking-widest">
              Chargement…
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-aaj-border bg-slate-50 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
            className="text-aaj-gray hover:text-aaj-royal transition-colors"
            aria-label="Dézoomer"
          >
            <ZoomOut size={18} />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-aaj-royal"
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}
            className="text-aaj-gray hover:text-aaj-royal transition-colors"
            aria-label="Zoomer"
          >
            <ZoomIn size={18} />
          </button>
        </div>

        {error && (
          <div className="px-8 py-3 bg-red-50 text-red-600 border-t border-red-100 text-[11px] font-bold uppercase tracking-wider">
            {error}
          </div>
        )}

        <div className="p-6 border-t border-aaj-border bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest text-aaj-gray border border-aaj-border hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !croppedAreaPixels || !imageSrc}
            className="px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest bg-aaj-royal text-white hover:bg-aaj-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Check size={14} />
            {isProcessing ? 'Traitement…' : 'Valider'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Charge une image data URL puis dessine la zone croppée sur un canvas
 * carré de `outputSize`px et exporte en JPEG. Les dimensions du crop sont
 * fournies par react-easy-crop en pixels naturels de l'image source.
 */
async function renderCroppedImage(
  imageSrc: string,
  cropPixels: Area,
  outputSize: number,
  quality: number
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non supporté.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Fond blanc pour les éventuels pixels transparents (PNG → JPEG).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize
  );
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible.'));
    img.src = src;
  });
}
