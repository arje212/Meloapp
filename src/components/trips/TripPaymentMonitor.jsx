import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Users, CheckCircle2, Clock,
  AlertCircle, Loader2, Eye, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';

async function sendNotification({ userEmail, title, message, type, link }) {
  await supabase.from('notifications').insert({
    user_email: userEmail,
    title,
    message,
    type,
    link,
    icon:    '✅',
    is_read: false,
  });
}

const STATUS_COLORS = {
  unpaid:    'bg-red-100 text-red-700 border-red-200',
  submitted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function TripPaymentMonitor({ trip, members = [], isOrganizer }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [expanded, setExpanded] = useState(true);

  // All payments for this trip
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['trip-payments-all', trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_payments')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!trip?.id && isOrganizer,
  });

  // (early return placed AFTER all hooks so hook order is stable between renders)
  if (!isOrganizer || !trip?.payment_required) return null;

  // Going members who haven't submitted a payment record yet
  const goingMembers = members.filter(m => m.status === 'going');
  const paidEmails   = new Set(payments.map(p => p.user_email));
  const unpaidMembers = goingMembers.filter(m => !paidEmails.has(m.user_email));

  // Stats
  const confirmed  = payments.filter(p => p.status === 'confirmed');
  const submitted  = payments.filter(p => p.status === 'submitted');
  const totalCollected = confirmed.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalPending   = submitted.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalExpected  = goingMembers.length * (Number(trip.price) || 0);

  const handleConfirm = async (payment) => {
    setConfirmingId(payment.id);
    try {
      const { error } = await supabase
        .from('trip_payments')
        .update({
          status:       'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.email,
        })
        .eq('id', payment.id);
      if (error) throw error;

      // Notify the member
      await sendNotification({
        userEmail: payment.user_email,
        title:     '✅ Payment Confirmed!',
        message:   `Your payment of ₱${Number(payment.amount).toLocaleString()} for "${trip.title}" has been confirmed by the organizer.`,
        type:      'booking',
        link:      `/trips/${trip.id}`,
      });

      qc.invalidateQueries({ queryKey: ['trip-payments-all', trip.id] });
    } catch (err) {
      console.error('Confirm payment error:', err);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancel = async (payment) => {
    setCancellingId(payment.id);
    try {
      const { error } = await supabase
        .from('trip_payments')
        .update({ status: 'cancelled' })
        .eq('id', payment.id);
      if (error) throw error;

      // Notify the member
      await sendNotification({
        userEmail: payment.user_email,
        title:     '❌ Payment Cancelled',
        message:   `Your payment receipt for "${trip.title}" was not accepted. Please re-submit the correct receipt.`,
        type:      'booking',
        link:      `/trips/${trip.id}`,
      });

      qc.invalidateQueries({ queryKey: ['trip-payments-all', trip.id] });
    } catch (err) {
      console.error('Cancel payment error:', err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bg-card border rounded-2xl overflow-hidden mt-4">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Payment Monitor</h3>
          {submitted.length > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">
              {submitted.length} pending review
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Collected</p>
              <p className="text-lg font-bold text-green-700">₱{totalCollected.toLocaleString()}</p>
              <p className="text-[10px] text-green-600">{confirmed.length} confirmed</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-yellow-700">₱{totalPending.toLocaleString()}</p>
              <p className="text-[10px] text-yellow-600">{submitted.length} for review</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Expected</p>
              <p className="text-lg font-bold">₱{totalExpected.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{goingMembers.length} going</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">

              {/* Members who submitted receipts */}
              {payments.map(payment => (
                <div
                  key={payment.id}
                  className={`rounded-xl border p-3 ${payment.status === 'submitted' ? 'bg-yellow-50 border-yellow-200' : 'bg-card'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {(payment.user_name || payment.user_email)[0].toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{payment.user_name || payment.user_email}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[payment.status]}`}>
                          {payment.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{payment.user_email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-semibold text-primary">₱{Number(payment.amount).toLocaleString()}</span>
                        {payment.submitted_at && (
                          <span>Submitted: {format(new Date(payment.submitted_at), 'MMM d, h:mm a')}</span>
                        )}
                        {payment.confirmed_at && (
                          <span className="text-green-600">Confirmed: {format(new Date(payment.confirmed_at), 'MMM d, h:mm a')}</span>
                        )}
                      </div>
                      {payment.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{payment.notes}"</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 shrink-0">
                      {payment.receipt_url && (
                        <button
                          onClick={() => setViewingReceipt(payment)}
                          className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1 hover:bg-primary/5"
                        >
                          <Eye className="w-3 h-3" /> Receipt
                        </button>
                      )}
                      {payment.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] rounded-full bg-green-600 hover:bg-green-700 px-2"
                            onClick={() => handleConfirm(payment)}
                            disabled={confirmingId === payment.id}
                          >
                            {confirmingId === payment.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><CheckCircle2 className="w-3 h-3 mr-0.5" /> Confirm</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] rounded-full border-red-300 text-red-600 hover:bg-red-50 px-2"
                            onClick={() => handleCancel(payment)}
                            disabled={cancellingId === payment.id}
                          >
                            {cancellingId === payment.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><X className="w-3 h-3 mr-0.5" /> Decline</>
                            }
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Members who haven't paid yet */}
              {unpaidMembers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    Not yet paid ({unpaidMembers.length})
                  </p>
                  <div className="space-y-1">
                    {unpaidMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-red-600">
                            {(m.user_name || m.user_email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.user_name || m.user_email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{m.user_email}</p>
                        </div>
                        <span className="text-[10px] text-red-600 font-semibold shrink-0">Unpaid</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payments.length === 0 && unpaidMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No going members yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Receipt Lightbox */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setViewingReceipt(null)}
        >
          <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
              onClick={() => setViewingReceipt(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="bg-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="font-semibold text-sm">{viewingReceipt.user_name}</p>
                <p className="text-xs text-muted-foreground">
                  ₱{Number(viewingReceipt.amount).toLocaleString()} ·{' '}
                  {viewingReceipt.submitted_at && format(new Date(viewingReceipt.submitted_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <img
                src={viewingReceipt.receipt_url}
                alt="GCash receipt"
                className="w-full object-contain max-h-[70vh]"
              />
              {viewingReceipt.status === 'submitted' && (
                <div className="p-3 flex gap-2">
                  <Button
                    className="flex-1 rounded-full bg-green-600 hover:bg-green-700"
                    onClick={() => { handleConfirm(viewingReceipt); setViewingReceipt(null); }}
                    disabled={confirmingId === viewingReceipt.id}
                  >
                    {confirmingId === viewingReceipt.id
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <CheckCircle2 className="w-4 h-4 mr-2" />
                    }
                    Confirm Payment
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full border-red-300 text-red-600"
                    onClick={() => { handleCancel(viewingReceipt); setViewingReceipt(null); }}
                  >
                    <X className="w-4 h-4 mr-2" /> Decline
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
