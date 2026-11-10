import { useState } from 'react';
import { Loader2, Upload, QrCode, Smartphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { uploadFile } from '@/lib/uploadFile';

/**
 * Form fields for GCash payment details with a choice of what customers will see: QR code or mobile number.
 * value: { gcash_display, gcash_number, gcash_name, gcash_qr_url }   onChange(patch)
 */
export default function GcashModeFields({ value, onChange, tone = 'neutral', onBusyChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const mode = value.gcash_display || (value.gcash_qr_url && !value.gcash_number ? 'qr' : 'number');
  const light = tone === 'blue';

  const setBusy = (busy) => { setUploading(busy); onBusyChange?.(busy); };

  const handleQr = async (file) => {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const url = await uploadFile(file, 'gcash-qr');
      onChange({ gcash_qr_url: url });
    } catch (err) {
      console.error('QR upload failed:', err);
      setError(err?.message || 'Could not upload the QR code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const optionClass = (active) =>
    `flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'
    }`;
  const labelClass = `text-xs ${light ? 'text-blue-900' : ''}`;

  return (
    <div className="space-y-3">
      <div>
        <Label className={labelClass}>What should customers see when paying?</Label>
        <div className="mt-1 flex gap-2" role="radiogroup" aria-label="GCash display">
          <button type="button" role="radio" aria-checked={mode === 'qr'} className={optionClass(mode === 'qr')} onClick={() => onChange({ gcash_display: 'qr' })}>
            <QrCode className="w-3.5 h-3.5" /> QR code
          </button>
          <button type="button" role="radio" aria-checked={mode === 'number'} className={optionClass(mode === 'number')} onClick={() => onChange({ gcash_display: 'number' })}>
            <Smartphone className="w-3.5 h-3.5" /> Mobile number
          </button>
        </div>
        <p className={`mt-1 text-[11px] ${light ? 'text-blue-700' : 'text-muted-foreground'}`}>
          {mode === 'qr' ? 'Only the QR code is shown. Your mobile number stays private.' : 'Customers will see your GCash mobile number.'}
        </p>
      </div>

      {mode === 'qr' ? (
        <div>
          <Label className={labelClass}>GCash QR code *</Label>
          {value.gcash_qr_url ? (
            <div className="mt-1 flex items-center gap-3">
              <img src={value.gcash_qr_url} alt="GCash QR" className="w-24 h-24 rounded-lg bg-white border object-contain" />
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange({ gcash_qr_url: '' })}>Remove</Button>
            </div>
          ) : (
            <label className="mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-white py-4 text-xs text-blue-700 cursor-pointer hover:bg-blue-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload your QR (screenshot from the GCash app)
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleQr(f); }} />
            </label>
          )}
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div>
          <Label className={labelClass}>GCash number *</Label>
          <Input className="mt-1 bg-white" placeholder="09XX XXX XXXX" inputMode="tel" value={value.gcash_number || ''} onChange={(e) => onChange({ gcash_number: e.target.value })} />
        </div>
      )}

      <div>
        <Label className={labelClass}>Account name {mode === 'number' ? '*' : ''}</Label>
        <Input className="mt-1 bg-white" placeholder="Account holder name" value={value.gcash_name || ''} onChange={(e) => onChange({ gcash_name: e.target.value })} />
      </div>
    </div>
  );
}

/** true when the chosen option is filled in */
export function gcashComplete(v) {
  const mode = v.gcash_display || (v.gcash_qr_url && !v.gcash_number ? 'qr' : 'number');
  return mode === 'qr' ? !!v.gcash_qr_url : !!(v.gcash_number && v.gcash_name);
}
