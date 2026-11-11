import { useState } from 'react';
import { ImagePlus, Loader2, X, RefreshCw } from 'lucide-react';
import { uploadFile } from '@/lib/uploadFile';
import { prepareImageFile, downscaleImage, isHeic } from '@/lib/prepareImage';

const MAX_MB = 20;

/**
 * Pick a photo from the phone (gallery or camera) instead of pasting a link.
 * The photo is converted (HEIC), shrunk, uploaded, and onChange(url) receives the stored address.
 */
export default function ImageField({
  value, onChange, folder = 'uploads', label = 'Photo', hint, heightClass = 'h-40', onBusyChange,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    if (!picked.type.startsWith('image/') && !isHeic(picked)) { setError('Please choose a photo (JPG, PNG, HEIC).'); return; }
    if (picked.size > MAX_MB * 1024 * 1024) { setError(`The photo is too large (max ${MAX_MB} MB).`); return; }
    setError(''); setBusy(true); onBusyChange?.(true);
    try {
      const file = await downscaleImage(await prepareImageFile(picked));
      onChange(await uploadFile(file, folder));
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError(err?.message || 'Could not upload the photo. Please try again.');
    } finally {
      setBusy(false); onBusyChange?.(false);
    }
  };

  return (
    <div>
      {label && <p className="text-sm font-medium mb-1">{label}</p>}
      {value ? (
        <div className={`relative ${heightClass} rounded-xl overflow-hidden border bg-muted`}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <label className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer" aria-label="Replace photo">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
            </label>
            <button type="button" onClick={() => onChange('')} className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove photo">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center gap-1.5 ${heightClass} rounded-xl border-2 border-dashed cursor-pointer hover:bg-muted/60 text-muted-foreground transition-colors`}>
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
          <span className="text-sm font-medium">{busy ? 'Uploading...' : 'Choose a photo'}</span>
          <span className="text-[11px]">{hint || 'From your gallery or camera'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
