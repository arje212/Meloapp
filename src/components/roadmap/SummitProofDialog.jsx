import { useEffect, useState } from 'react';
import { Camera, Loader2, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadFile } from '@/lib/uploadFile';
import { distanceKm } from '@/lib/peaks';
import { todayStr } from '@/lib/plans';

const today = () => todayStr();

/** A peak only counts as conquered with a summit photo. Optional location check stores just the distance. */
export default function SummitProofDialog({ node, open, onClose, onConfirm, coords }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [date, setDate] = useState(today());
  const [useGps, setUseGps] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setFile(null); setPreview(''); setError(''); setDate(node?.date_conquered || today()); }
  }, [open, node]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Choose a photo (JPG or PNG).'); return; }
    if (f.size > 8 * 1024 * 1024) { setError('Photo is too large. Max 8MB.'); return; }
    setError(''); setFile(f); setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      let distance = null;
      if (useGps && coords && navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 60000 }));
          distance = Math.round(distanceKm([pos.coords.latitude, pos.coords.longitude], coords) * 10) / 10;
        } catch { /* location is optional */ }
      }
      const proof_url = await uploadFile(file, 'summit-proofs');
      onConfirm({ proof_url, date_conquered: date, proof_distance_km: distance, proof_gps: distance != null });
    } catch (err) {
      console.error('Summit photo upload failed:', err);
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Summit photo for {node?.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">Upload a photo taken at the summit. A peak counts as conquered once it has a photo.</p>

        <label className="block rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer hover:bg-muted/40 transition-colors">
          {preview ? (
            <img src={preview} alt="Selected summit" className="w-full h-48 object-cover" />
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Camera className="w-8 h-8" /><span className="text-sm font-medium">Take or choose a photo</span>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        </label>

        <div>
          <Label htmlFor="summit-date">Date you reached the summit</Label>
          <Input id="summit-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </div>

        {coords && (
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} className="mt-0.5" />
            <span><MapPin className="inline w-3 h-3 mr-0.5" />Check that I'm near the peak. Your location is not saved, only the distance to the peak.</span>
          </label>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1 rounded-full" onClick={submit} disabled={!file || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Confirm summit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}