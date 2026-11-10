import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function cropToBlob(src, area, maxSize = 800) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load the image.'));
    el.src = src;
  });
  const side = Math.min(Math.round(Math.min(area.width, area.height)), maxSize) || 1;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  canvas.getContext('2d').drawImage(img, area.x, area.y, area.width, area.height, 0, 0, side, side);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not crop the image.'))), 'image/jpeg', 0.9));
}

/**
 * Full-screen crop/zoom picker (round preview). Used when changing a profile photo.
 * onDone receives a JPEG Blob (max 800px), so big phone photos are also shrunk.
 */
export default function ImageCropDialog({ src, onCancel, onDone, title = 'Crop photo' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onComplete = useCallback((_, pixels) => setArea(pixels), []);

  const confirm = async () => {
    if (!area || busy) return;
    setBusy(true); setError('');
    try {
      await onDone(await cropToBlob(src, area));
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  return createPortal(
    // pointer-events:auto so it still works when opened from inside another dialog
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black" style={{ pointerEvents: 'auto' }}>
      <div className="px-4 py-3 text-center text-white font-semibold text-sm">{title}</div>
      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
        />
      </div>
      <div className="bg-black px-6 pt-4 pb-6 space-y-4">
        <input
          type="range" min={1} max={3} step={0.01} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom" className="w-full accent-green-500"
        />
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 rounded-full bg-transparent text-white border-white/40 hover:bg-white/10" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" className="flex-1 rounded-full" onClick={confirm} disabled={busy || !area}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gamitin'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
