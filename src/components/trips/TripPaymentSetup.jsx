import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Edit2, CheckCircle2, Loader2, X } from 'lucide-react';

export default function TripPaymentSetup({ trip, isOrganizer }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    price:            trip?.price            ?? '',
    gcash_number:     trip?.gcash_number     ?? '',
    gcash_name:       trip?.gcash_name       ?? '',
    payment_required: trip?.payment_required ?? false,
  });

  if (!isOrganizer && !trip?.payment_required) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('trips')
        .update({
          price:            form.price ? Number(form.price) : null,
          gcash_number:     form.gcash_number.trim()  || null,
          gcash_name:       form.gcash_name.trim()    || null,
          payment_required: form.payment_required,
        })
        .eq('id', trip.id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
      setEditMode(false);
    } catch (err) {
      console.error('Save payment setup error:', err);
    } finally {
      setSaving(false);
    }
  };

  const hasPaymentSetup = trip?.payment_required && trip?.gcash_number && trip?.price;

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
              setForm({
                price:            trip?.price            ?? '',
                gcash_number:     trip?.gcash_number     ?? '',
                gcash_name:       trip?.gcash_name       ?? '',
                payment_required: trip?.payment_required ?? false,
              });
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">GCash Number *</Label>
                  <Input
                    placeholder="09XX XXX XXXX"
                    value={form.gcash_number}
                    onChange={e => setForm(p => ({ ...p, gcash_number: e.target.value }))}
                    className="mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">GCash Name *</Label>
                  <Input
                    placeholder="Account name"
                    value={form.gcash_name}
                    onChange={e => setForm(p => ({ ...p, gcash_name: e.target.value }))}
                    className="mt-1 bg-background"
                  />
                </div>
              </div>
            </>
          )}

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
              disabled={saving || (form.payment_required && (!form.price || !form.gcash_number || !form.gcash_name))}
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
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl p-4">
            <p className="text-xs font-medium opacity-80 mb-1">Send payment to</p>
            <p className="text-2xl font-bold tracking-widest">{trip.gcash_number}</p>
            <p className="text-sm opacity-90 mt-0.5">{trip.gcash_name}</p>
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs opacity-80">Amount</p>
              <p className="text-xl font-bold">₱{Number(trip.price).toLocaleString()}</p>
            </div>
          </div>
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
