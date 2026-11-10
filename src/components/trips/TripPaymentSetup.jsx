import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Edit2, CheckCircle2, Loader2, X } from 'lucide-react';
import GcashModeFields, { gcashComplete } from '@/components/payments/GcashModeFields';
import GcashPayCard from '@/components/payments/GcashPayCard';

export default function TripPaymentSetup({ trip, isOrganizer }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const fromTrip = () => ({
    price:            trip?.price            ?? '',
    gcash_number:     trip?.gcash_number     ?? '',
    gcash_name:       trip?.gcash_name       ?? '',
    gcash_qr_url:     trip?.gcash_qr_url     ?? '',
    gcash_display:    trip?.gcash_display    ?? (trip?.gcash_qr_url && !trip?.gcash_number ? 'qr' : 'number'),
    payment_required: trip?.payment_required ?? false,
  });
  const [form, setForm] = useState(fromTrip);

  if (!isOrganizer && !trip?.payment_required) return null;

  const handleSave = async () => {
    setSaving(true); setSaveError('');
    try {
      const { error } = await supabase
        .from('trips')
        .update({
          price:            form.price ? Number(form.price) : null,
          gcash_number:     form.gcash_number.trim()  || null,
          gcash_name:       form.gcash_name.trim()    || null,
          gcash_qr_url:     form.gcash_qr_url         || null,
          gcash_display:    form.gcash_display,
          payment_required: form.payment_required,
        })
        .eq('id', trip.id);

      if (error) {
        // new columns missing in the database: say so instead of failing silently
        if (/gcash_qr_url|gcash_display|column/i.test(error.message || '')) {
          throw new Error('The QR option needs a database update. Ask the admin to run the latest migration.');
        }
        throw error;
      }

      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
      setEditMode(false);
    } catch (err) {
      console.error('Save payment setup error:', err);
      setSaveError(err?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasPaymentSetup = trip?.payment_required && (trip?.gcash_number || trip?.gcash_qr_url) && trip?.price;

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Trip Payment</h3>
          {hasPaymentSetup && (
            <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
              Active
            </span>
          )}
        </div>
        {isOrganizer && !editMode && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-7 text-xs gap-1"
            onClick={() => {
              setForm(fromTrip());
              setSaveError('');
              setEditMode(true);
            }}
          >
            <Edit2 className="w-3 h-3" />
            {hasPaymentSetup ? 'Edit' : 'Setup Payment'}
          </Button>
        )}
      </div>

      {/* Organizer edit form */}
      {isOrganizer && editMode && (
        <div className="bg-muted rounded-xl p-4 space-y-3">
          {/* Toggle payment required */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm(p => ({ ...p, payment_required: !p.payment_required }))}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${
                form.payment_required ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                form.payment_required ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
            <span className="text-sm font-medium">Require payment to join this trip</span>
          </label>

          {form.payment_required && (
            <>
              <div>
                <Label className="text-xs">Trip Fee (₱) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  className="mt-1 bg-background"
                />
              </div>
              <GcashModeFields value={form} onChange={(patch) => setForm(p => ({ ...p, ...patch }))} onBusyChange={setQrBusy} />
            </>
          )}

          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => setEditMode(false)}
              disabled={saving}
            >
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 rounded-full"
              onClick={handleSave}
              disabled={saving || qrBusy || (form.payment_required && (!form.price || !gcashComplete(form)))}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Display current payment setup (for members and organizer when not editing) */}
      {!editMode && hasPaymentSetup && (
        <div className="space-y-3">
          <GcashPayCard mode={trip.gcash_display} number={trip.gcash_number} qrUrl={trip.gcash_qr_url} name={trip.gcash_name} amount={trip.price} />
          <p className="text-xs text-muted-foreground text-center">
            Send the exact amount via GCash then upload your receipt below.
          </p>
        </div>
      )}

      {/* Organizer — no payment setup yet */}
      {!editMode && !hasPaymentSetup && isOrganizer && (
        <p className="text-sm text-muted-foreground text-center py-3">
          No payment setup yet. Click "Setup Payment" to require members to pay.
        </p>
      )}
    </div>
  );
}
