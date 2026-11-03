import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { commissionConfirmPatch } from '@/lib/commission';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertTriangle, Wallet, Receipt, Eye, X, Clock } from 'lucide-react';
import { format } from 'date-fns';

const getRate = (rate) => rate || 10;

export default function AdminBookings() {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState(null);

  // ── Receipt preview dialog state ─────────────────────────
  const [receiptDialog,  setReceiptDialog]  = useState(false);
  const [receiptBooking, setReceiptBooking] = useState(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date', 1000),
  });

  // Instantly update a booking in local cache — no loading flicker
  const patchCache = (id, patch) => {
    queryClient.setQueryData(['admin-bookings'], (old = []) =>
      old.map(b => b.id === id ? { ...b, ...patch } : b)
    );
  };

  const handleStatusChange = async (id, status) => {
    const previous = bookings.find(b => b.id === id)?.status;
    patchCache(id, { status });
    try {
      await base44.entities.Booking.update(id, { status });
    } catch (err) {
      console.error('Status change failed:', err);
      patchCache(id, { status: previous });
      alert('Unable to update booking status: ' + (err?.message || 'unknown error'));
    }
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  };

  // ── Open receipt viewer then confirm ────────────────────
  const openReceiptViewer = (booking) => {
    setReceiptBooking(booking);
    setReceiptDialog(true);
  };

  // ✅ Admin confirms GCash received — sets proper status
  const handleConfirmCommission = async (booking) => {
    setUpdatingId(booking.id);
    const patch = commissionConfirmPatch();
    patchCache(booking.id, patch); // instant UI update
    setReceiptDialog(false);
    try {
      await base44.entities.Booking.update(booking.id, patch);
    } catch {
      // rollback on error
      patchCache(booking.id, {
        status:               'commission_sent',
        commission_confirmed: false,
        commission_confirmed_date: null,
      });
    }
    setUpdatingId(null);
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  };

  // ⚠ Warn agency
  const handleWarn = async (booking) => {
    setUpdatingId(booking.id);
    patchCache(booking.id, { commission_penalty: 'warning' });
    try {
      await Promise.all([
        base44.entities.Booking.update(booking.id, { commission_penalty: 'warning' }),
        base44.entities.Agency.update(booking.agency_id, { commission_warning: true }),
      ]);
    } catch {
      patchCache(booking.id, { commission_penalty: null });
    }
    setUpdatingId(null);
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  };

  // 🚫 Suspend agency
  const handleSuspend = async (booking) => {
    setUpdatingId(booking.id);
    patchCache(booking.id, { commission_penalty: 'suspended' });
    try {
      await Promise.all([
        base44.entities.Booking.update(booking.id, { commission_penalty: 'suspended' }),
        base44.entities.Agency.update(booking.agency_id, { status: 'suspended' }),
      ]);
    } catch {
      patchCache(booking.id, { commission_penalty: null });
    }
    setUpdatingId(null);
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  };

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const withFee = bookings.map(b => ({
    ...b,
    _fee: b.platform_fee || Math.round((b.total_price || 0) * getRate(b.commission_rate) / 100),
  }));

  const grandTotal      = withFee.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalCommission = withFee.reduce((s, b) => s + b._fee, 0);
  const confirmedTotal  = withFee.filter(b => b.status === 'commission_confirmed').reduce((s, b) => s + b._fee, 0);
  const pendingTotal    = withFee.filter(b => b.status === 'commission_sent').reduce((s, b) => s + b._fee, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl font-bold">Bookings ({bookings.length})</h2>
        <p className="text-lg font-bold text-primary">Total: ₱{grandTotal.toLocaleString()}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Commission</p>
          <p className="text-xl font-bold text-primary">₱{totalCommission.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Expected from all bookings</p>
        </div>
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Confirmed Received</p>
          <p className="text-xl font-bold text-green-600">₱{confirmedTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">GCash received & confirmed</p>
        </div>
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Pending Collection</p>
          <p className="text-xl font-bold text-orange-500">₱{pendingTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Receipt sent, awaiting confirm</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Commission Due</TableHead>
              <TableHead>Travel Date</TableHead>
              <TableHead>Booking Status</TableHead>
              <TableHead>GCash Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withFee.map(b => {
              const isUpdating = updatingId === b.id;

              // ── GCash Commission column ──────────────────
              let commissionCell;

              if (b.status === 'commission_confirmed') {
                // ✅ Already confirmed
                commissionCell = (
                  <div className="space-y-1">
                    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </Badge>
                    {b.commission_confirmed_date && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(b.commission_confirmed_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                );

              } else if (b.status === 'commission_sent') {
                // 📄 Agency sent commission — admin needs to review & confirm
                commissionCell = (
                  <div className="flex flex-col gap-1.5 min-w-[180px]">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                      onClick={() => openReceiptViewer(b)}
                      disabled={isUpdating}
                    >
                      {isUpdating
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Eye className="w-3 h-3" />}
                      {isUpdating ? 'Saving...' : 'View Receipt & Confirm'}
                    </Button>

                    {/* Penalty actions */}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => handleWarn(b)}
                        disabled={isUpdating}
                      >
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Warn
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 text-[10px] px-2"
                        onClick={() => handleSuspend(b)}
                        disabled={isUpdating}
                      >
                        Suspend
                      </Button>
                    </div>

                    {b.commission_penalty === 'warning' && (
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] w-fit">⚠ Warning issued</Badge>
                    )}
                    {b.commission_penalty === 'suspended' && (
                      <Badge className="bg-red-100 text-red-700 text-[10px] w-fit">🚫 Agency suspended</Badge>
                    )}
                  </div>
                );

              } else if (b.status === 'completed') {
                // ⏳ Completed but agency hasn't sent receipt yet
                commissionCell = (
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1 text-xs">
                    <Clock className="w-3 h-3" /> Waiting for receipt
                  </Badge>
                );

              } else {
                // Other statuses — no action needed
                commissionCell = (
                  <span className="text-xs text-muted-foreground">—</span>
                );
              }

              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.package_title}</TableCell>
                  <TableCell className="text-sm">{b.user_name || b.user_email}</TableCell>
                  <TableCell className="text-sm">{b.agency_name}</TableCell>
                  <TableCell className="font-semibold">₱{(b.total_price || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-orange-600">₱{b._fee.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({getRate(b.commission_rate)}%)</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.travel_date ? format(new Date(b.travel_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Select value={b.status} onValueChange={v => handleStatusChange(b.id, v)}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['pending','confirmed','paid','completed','commission_sent','commission_confirmed','cancelled','refunded'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{commissionCell}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ══ RECEIPT VIEWER DIALOG ══ */}
      <Dialog open={receiptDialog} onOpenChange={v => { if (updatingId === null) setReceiptDialog(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" /> GCash Receipt — Review & Confirm
            </DialogTitle>
          </DialogHeader>

          {receiptBooking && (
            <div className="space-y-4">
              {/* Booking summary */}
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p className="font-semibold">{receiptBooking.package_title}</p>
                <p className="text-xs text-muted-foreground">{receiptBooking.agency_name}</p>
                <p className="text-xs text-muted-foreground">
                  {receiptBooking.user_name} · {receiptBooking.travel_date
                    ? format(new Date(receiptBooking.travel_date), 'MMM d, yyyy') : '—'}
                </p>
                <div className="flex justify-between pt-1 border-t mt-1">
                  <span className="text-muted-foreground text-xs">Commission amount</span>
                  <span className="font-bold text-blue-700">
                    ₱{receiptBooking._fee?.toLocaleString()}
                    <span className="font-normal text-muted-foreground ml-1">
                      ({getRate(receiptBooking.commission_rate)}%)
                    </span>
                  </span>
                </div>
              </div>

              {/* GCash receipt image */}
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">GCash Receipt from Agency</p>
                {receiptBooking.gcash_receipt_url ? (
                  <div className="rounded-xl overflow-hidden border bg-muted">
                    <img
                      src={receiptBooking.gcash_receipt_url}
                      alt="GCash receipt"
                      className="w-full object-contain max-h-72"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-muted flex flex-col items-center justify-center py-6 gap-2">
                    <Receipt className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground text-center">
                      Walang receipt image na na-upload ang agency.<br />
                      Pwede mo pa ring i-confirm kung natanggap mo na ang GCash payment.
                    </p>
                  </div>
                )}
                {receiptBooking.commission_sent_date && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Sent {format(new Date(receiptBooking.commission_sent_date), 'MMM d, yyyy · h:mm a')}
                  </p>
                )}
              </div>

              {/* Completion proof (optional reference) */}
              {receiptBooking.completion_proof_url && (
                <div>
                  <p className="text-xs font-medium mb-2 text-muted-foreground">Trip Completion Proof</p>
                  <div className="rounded-xl overflow-hidden border bg-muted">
                    <img
                      src={receiptBooking.completion_proof_url}
                      alt="Trip proof"
                      className="w-full h-24 object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {receiptBooking.actual_pax} pax attended
                  </p>
                </div>
              )}

              <p className="text-xs bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-blue-800">
                ✅ I-verify ang receipt bago i-confirm. Kapag na-confirm, matatanggap ng agency ang notification na natanggap mo na ang commission.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={() => setReceiptDialog(false)}>
                  <X className="w-4 h-4 mr-1" /> Close
                </Button>
                <Button
                  className="flex-1 rounded-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleConfirmCommission(receiptBooking)}
                  disabled={updatingId === receiptBooking.id}
                >
                  {updatingId === receiptBooking.id
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Wallet className="w-4 h-4 mr-2" />}
                  Confirm GCash Received
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}