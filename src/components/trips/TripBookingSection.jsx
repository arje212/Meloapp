import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Users, Package, CheckCircle2, Loader2 } from 'lucide-react';

const PLAN_COMMISSION = { free: 10, starter: 7, pro: 5, yearly: 3 };

export default function TripBookingSection({ trip }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [bookingPkg, setBookingPkg] = useState(null);
  const [bookForm, setBookForm] = useState({
    travel_date: '', num_pax: 1, notes: '', payment_method: 'gcash',
    pickup_location: '', dropoff_location: '', meetup_location: '',
    contact_phone: '', date_mode: 'scheduled',
  });
  const [isBooking, setIsBooking] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ['trip-packages', trip?.mountain_name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_packages')
        .select('*')
        .eq('mountain_name', trip.mountain_name)
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.mountain_name,
  });

  const agencyIds = [...new Set(packages.map(p => p.agency_id).filter(Boolean))];

  const { data: subs = [] } = useQuery({
    queryKey: ['trip-pkg-subs', agencyIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_subscriptions')
        .select('*')
        .in('agency_id', agencyIds)
        .eq('status', 'verified');
      if (error) throw error;
      return data;
    },
    enabled: agencyIds.length > 0,
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-trip-bookings', user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('package_id')
        .eq('user_email', user.email);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  const bookedPackageIds = new Set(myBookings.map(b => b.package_id));

  const getCommissionRate = (agencyId) => {
    const sub = subs.find(s => s.agency_id === agencyId);
    return PLAN_COMMISSION[sub?.plan?.toLowerCase()] ?? PLAN_COMMISSION.free;
  };

  const handleBook = async () => {
    if (!bookingPkg) return;
    setIsBooking(true);
    try {
      const commissionRate = getCommissionRate(bookingPkg.agency_id);
      const totalPrice = (bookingPkg.price || 0) * bookForm.num_pax;
      const downpayment = Math.round(totalPrice * 0.3);
      const balance = totalPrice - downpayment;

      const { error } = await supabase.from('bookings').insert({
        user_email: user.email,
        package_id: bookingPkg.id,
        agency_id: bookingPkg.agency_id,
        agency_name: bookingPkg.agency_name,
        trip_id: trip.id,
        travel_date: bookForm.travel_date || trip.start_date || '',
        num_pax: bookForm.num_pax,
        notes: bookForm.notes,
        payment_method: bookForm.payment_method,
        pickup_location: bookForm.pickup_location,
        dropoff_location: bookForm.dropoff_location,
        meetup_location: bookForm.meetup_location,
        contact_phone: bookForm.contact_phone,
        total_price: totalPrice,
        downpayment,
        balance,
        commission_rate: commissionRate,
        status: 'pending',
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['my-trip-bookings'] });
      setSuccess(true);
    } catch (err) {
      console.error('Booking error:', err);
    } finally {
      setIsBooking(false);
    }
  };

  const handleClose = () => {
    setBookingPkg(null);
    setSuccess(false);
    setBookForm({
      travel_date: '', num_pax: 1, notes: '', payment_method: 'gcash',
      pickup_location: '', dropoff_location: '', meetup_location: '',
      contact_phone: '', date_mode: 'scheduled',
    });
  };

  if (packages.length === 0) return null;

  const totalPrice = (bookingPkg?.price || 0) * bookForm.num_pax;
  const downpayment = Math.round(totalPrice * 0.3);
  const balance = totalPrice - downpayment;

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Book a Tour Package</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Join this trip through one of these available packages from local agencies.
      </p>

      <div className="space-y-3">
        {packages.map(pkg => {
          const alreadyBooked = bookedPackageIds.has(pkg.id);
          return (
            <div key={pkg.id} className="border rounded-xl p-3 flex gap-3 items-start">
              {pkg.image_url && (
                <img src={pkg.image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{pkg.title}</p>
                <p className="text-xs text-muted-foreground">{pkg.agency_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                  {pkg.duration_days && (
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{pkg.duration_days}d</span>
                  )}
                  {pkg.max_pax && (
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />Max {pkg.max_pax}</span>
                  )}
                </div>
                <p className="text-primary font-bold text-sm mt-1">₱{pkg.price?.toLocaleString()}/person</p>
              </div>
              <div className="shrink-0">
                {alreadyBooked ? (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Booked
                  </Badge>
                ) : (
                  <Button size="sm" className="rounded-full text-xs h-8" onClick={() => setBookingPkg(pkg)}>
                    Book
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!bookingPkg} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {success ? 'Booking Submitted!' : `Book: ${bookingPkg?.title}`}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">Booking Received!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your request has been sent to <b>{bookingPkg?.agency_name}</b>. They will confirm shortly.
                </p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-left text-sm space-y-1">
                <p><span className="text-muted-foreground">Package:</span> <b>{bookingPkg?.title}</b></p>
                <p><span className="text-muted-foreground">Pax:</span> <b>{bookForm.num_pax}</b></p>
                <p><span className="text-muted-foreground">Downpayment now:</span> <b className="text-green-700">₱{downpayment.toLocaleString()}</b></p>
                <p><span className="text-muted-foreground">Balance on meetup:</span> <b className="text-amber-700">₱{balance.toLocaleString()}</b></p>
                <p><span className="text-muted-foreground">Total:</span> <b className="text-primary">₱{totalPrice.toLocaleString()}</b></p>
              </div>
              <Button className="w-full rounded-full" onClick={handleClose}>Done</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{user?.full_name?.[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs">Travel Date</Label>
                <Input type="date" className="mt-1" min={new Date().toISOString().split('T')[0]}
                  value={bookForm.travel_date || trip?.start_date || ''}
                  onChange={e => setBookForm(p => ({ ...p, travel_date: e.target.value }))} />
                {trip?.start_date && <p className="text-xs text-muted-foreground mt-1">Trip starts: {trip.start_date}</p>}
              </div>

              <div>
                <Label className="text-xs">Number of Participants</Label>
                <Input type="number" min={1} max={bookingPkg?.max_pax || 99} className="mt-1"
                  value={bookForm.num_pax}
                  onChange={e => setBookForm(p => ({ ...p, num_pax: Number(e.target.value) }))} />
              </div>

              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={bookForm.payment_method} onValueChange={v => setBookForm(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash on meetup</SelectItem>
                    <SelectItem value="credit_card">Credit / Debit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Special Requests (optional)</Label>
                <Textarea className="mt-1 resize-none" rows={2} placeholder="Any notes for the agency..."
                  value={bookForm.notes}
                  onChange={e => setBookForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              <div className="bg-muted rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Total Price</p>
                  <p className="text-xl font-bold text-primary">₱{totalPrice.toLocaleString()}</p>
                </div>
                <div className="border-t pt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-green-700">
                    <span>Downpayment now (30%)</span>
                    <span className="font-bold">₱{downpayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>Balance on meetup</span>
                    <span className="font-semibold">₱{balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Button className="w-full rounded-full" onClick={handleBook} disabled={isBooking}>
                {isBooking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Booking (₱{downpayment.toLocaleString()} downpayment)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}