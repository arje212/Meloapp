import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { uploadFile } from '@/lib/uploadFile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Receipt, Upload, Loader2, CheckCircle2,
  Clock, X, AlertCircle,
} from 'lucide-react';

const STATUS_CONFIG = {
  unpaid: {
    label: 'Not yet paid',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon:  AlertCircle,
  },
  submitted: {
    label: 'Receipt submitted — waiting for confirmation',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon:  Clock,
  },
  confirmed: {
    label: 'Payment confirmed! ✓',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon:  CheckCircle2,
  },
  cancelled: {
    label: 'Payment cancelled',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon:  X,
  },
};

async function sendNotification({ userEmail, title, message, type, link }) {
  await supabase.from('notifications').insert({
    user_email: userEmail,
    title,
    message,
    type,
    link,
    icon:    '💰',
    is_read: false,
  });
}

export default function TripPaymentUser({ trip }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(null);
  const [file, setFile]           = useState(null);
  const [notes, setNotes]         = useState('');
  const [error, setError]         = useState('');

  // Fetch this user's payment record
  const { data: payment, isLoading } = useQuery({
    queryKey: ['trip-payment-mine', trip?.id, user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_payments')
        .select('*')
        .eq('trip_id', trip.id)
        .eq('user_email', user.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id && !!user?.email && !!trip?.payment_required,
  });

  if (!trip?.payment_required || !(trip?.gcash_number || trip?.gcash_qr_url)) return null;

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please select an image file (JPG, PNG).'); return; }
    if (f.size > 5 * 1024 * 1024) { setError('Max 5MB file size.'); return; }
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const url = await uploadFile(file, 'trip-receipts');

      if (payment) {
        // Update existing record
        const { error } = await supabase
          .from('trip_payments')
          .update({
            receipt_url:  url,
            status:       'submitted',
            submitted_at: new Date().toISOString(),
            notes:        notes.trim() || null,
          })
          .eq('id', payment.id);
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('trip_payments')
          .insert({
            trip_id:      trip.id,
            user_email:   user.email,
            user_name:    user.full_name || user.email,
            amount:       trip.price,
            receipt_url:  url,
            status:       'submitted',
            submitted_at: new Date().toISOString(),
            notes:        notes.trim() || null,
          });
        if (error) throw error;
      }

      // Notify organizer
      await sendNotification({
        userEmail: trip.organizer_email,
        title:     '💰 Payment Receipt Submitted',
        message:   `${user.full_name || user.email} submitted a payment receipt for "${trip.title}".`,
        type:      'booking',
        link:      `/trips/${trip.id}`,
      });

      qc.invalidateQueries({ queryKey: ['trip-payment-mine', trip.id, user.email] });
      qc.invalidateQueries({ queryKey: ['trip-payments-all', trip.id] });
      setFile(null); setPreview(null); setNotes('');
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center py-4">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  const status = payment?.status || 'unpaid';
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
  const Icon   = cfg.icon;

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Receipt className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">My Payment</h3>
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs font-medium mb-4 ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {cfg.label}
      </div>

      {/* Already confirmed — nothing more to do */}
      {status === 'confirmed' && (
        <div className="text-center py-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-700">Payment Confirmed!</p>
          <p className="text-xs text-muted-foreground mt-1">
            The organizer has confirmed your payment of ₱{Number(trip.price).toLocaleString()}.
          </p>
          {payment?.receipt_url && (
            <img
              src={payment.receipt_url}
              alt="Receipt"
              className="w-full h-28 object-cover object-top rounded-xl border mt-3"
            />
          )}
        </div>
      )}

      {/* Submitted — waiting */}
      {status === 'submitted' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-800">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Your receipt has been submitted. Waiting for organizer confirmation.
          </div>
          {payment?.receipt_url && (
            <img
              src={payment.receipt_url}
              alt="Submitted receipt"
              className="w-full h-28 object-cover object-top rounded-xl border"
            />
          )}
          <p className="text-xs text-muted-foreground text-center">
            Wrong receipt? Upload a new one below.
          </p>
          {/* Allow re-upload */}
          <ReceiptUploader
            preview={preview}
            file={file}
            notes={notes}
            setNotes={setNotes}
            onFileChange={handleFileChange}
            onClear={() => { setFile(null); setPreview(null); }}
            onSubmit={handleSubmit}
            uploading={uploading}
            error={error}
            buttonLabel="Re-upload Receipt"
          />
        </div>
      )}

      {/* Unpaid / cancelled — show upload form */}
      {(status === 'unpaid' || status === 'cancelled') && (
        <ReceiptUploader
          preview={preview}
          file={file}
          notes={notes}
          setNotes={setNotes}
          onFileChange={handleFileChange}
          onClear={() => { setFile(null); setPreview(null); }}
          onSubmit={handleSubmit}
          uploading={uploading}
          error={error}
          buttonLabel="Submit Receipt"
        />
      )}
    </div>
  );
}

// ── Sub-component: Receipt upload form ────────────────────────────────────────
function ReceiptUploader({ preview, file, notes, setNotes, onFileChange, onClear, onSubmit, uploading, error, buttonLabel }) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">GCash Receipt Screenshot *</Label>
        {preview ? (
          <div className="relative mt-1 rounded-xl overflow-hidden border">
            <img src={preview} alt="Receipt preview" className="w-full object-contain max-h-52" />
            <button
              onClick={onClear}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Receipt ready
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors mt-1">
            <Upload className="w-7 h-7 text-muted-foreground mb-1" />
            <span className="text-sm text-muted-foreground">Click to upload screenshot</span>
            <span className="text-xs text-muted-foreground">JPG, PNG — max 5MB</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </label>
        )}
      </div>

      <div>
        <Label className="text-xs">Notes (optional)</Label>
        <textarea
          className="w-full mt-1 px-3 py-2 text-sm border rounded-xl resize-none bg-background outline-none focus:ring-2 focus:ring-primary/30"
          rows={2}
          placeholder="e.g. Sent via GCash at 3:00pm"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <Button
        className="w-full rounded-full"
        onClick={onSubmit}
        disabled={!file || uploading}
      >
        {uploading
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...</>
          : <><Upload className="w-4 h-4 mr-2" /> {buttonLabel}</>
        }
      </Button>
    </div>
  );
}
