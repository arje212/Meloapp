import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Store, MapPin, Star, CheckCircle, MessageCircle, Mountain, Clock, Users, Loader2, CheckCircle2, Phone, LayoutDashboard } from 'lucide-react';
import { unlockAchievement } from '@/lib/achievements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AgencyDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agencyId = window.location.pathname.split('/agencies/')[1];
  const [bookingPkg, setBookingPkg] = useState(null);
  const [bookForm, setBookForm] = useState({ travel_date: '', num_pax: 1, notes: '', payment_method: 'gcash', contact_phone: '' });
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const { data: agency, isLoading } = useQuery({
    queryKey: ['agency', agencyId],
    queryFn: async () => {
      const list = await base44.entities.Agency.filter({ id: agencyId });
      return list[0];
    },
    enabled: !!agencyId,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['agency-packages', agencyId],
    queryFn: () => base44.entities.TourPackage.filter({ agency_id: agencyId, status: 'active' }),
    enabled: !!agencyId,
  });

  const handleBook = async () => {
    setIsBooking(true);
    await base44.entities.Booking.create({
      package_id: bookingPkg.id,
      agency_id: agencyId,
      agency_name: agency.name,
      package_title: bookingPkg.title,
      user_email: user.email,
      user_name: user.full_name,
      travel_date: bookForm.travel_date,
      num_pax: bookForm.num_pax,
      total_price: bookingPkg.price * bookForm.num_pax,
      notes: bookForm.notes,
      payment_method: bookForm.payment_method,
      status: 'pending',
    });
    unlockAchievement(user.email, user.full_name, 'first_booking');
    setIsBooking(false);
    setBookingSuccess(true);
  };

  const handleCloseBooking = () => {
    setBookingPkg(null);
    setBookingSuccess(false);
    setBookForm({ travel_date: '', num_pax: 1, notes: '', payment_method: 'gcash', contact_phone: '' });
  };

  const handleChat = async () => {
    // Create or find existing chat room with agency
    const existing = await base44.entities.ChatRoom.filter({
      type: 'agency',
      agency_id: agencyId,
    });
    const myRoom = existing.find(r => r.participants?.includes(user.email));
    if (myRoom) {
      navigate(`/chat/${myRoom.id}`);
    } else {
      const room = await base44.entities.ChatRoom.create({
        name: agency.name,
        type: 'agency',
        participants: [user.email, agency.owner_email],
        participant_names: [user.full_name, agency.name],
        agency_id: agencyId,
      });
      navigate(`/chat/${room.id}`);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agency) return <div className="text-center py-20"><p>Agency not found</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Agency Header */}
      <div className="bg-card border rounded-2xl overflow-hidden mb-6">
        <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 relative">
          {agency.cover_url && <img src={agency.cover_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="p-6 -mt-8 relative">
          <div className="w-16 h-16 rounded-xl bg-card border shadow flex items-center justify-center overflow-hidden mb-3">
            {agency.logo_url ? <img src={agency.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-primary" />}
          </div>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{agency.name}</h1>
                {agency.is_verified && <CheckCircle className="w-5 h-5 text-primary fill-primary/20" />}
              </div>
              {agency.location && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-4 h-4" />{agency.location}</p>}
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500" />{agency.rating || 'New'}</span>
                <span>{agency.total_bookings || 0} bookings</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {user?.email === agency.owner_email && (
                <Button variant="default" size="sm" className="rounded-full" onClick={() => navigate('/agency-dashboard')}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                </Button>
              )}
              <Button variant="outline" className="rounded-full" onClick={handleChat}>
                <MessageCircle className="w-4 h-4 mr-2" /> Chat
              </Button>
            </div>
          </div>
          {agency.description && <p className="text-sm text-muted-foreground mt-4">{agency.description}</p>}
        </div>
      </div>

      {/* Packages */}
      <h2 className="font-display text-xl font-semibold mb-4">Tour Packages</h2>
      {packages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No packages available yet</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-card border rounded-2xl overflow-hidden">
              <div className="aspect-video relative">
                <img src={pkg.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'} alt="" className="w-full h-full object-cover" />
                {pkg.is_featured && <Badge className="absolute top-3 right-3 bg-secondary text-secondary-foreground">Featured</Badge>}
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{pkg.title}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Mountain className="w-3.5 h-3.5" />{pkg.mountain_name}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {pkg.duration_days && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{pkg.duration_days} days</span>}
                  {pkg.max_pax && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />Max {pkg.max_pax}</span>}
                </div>
                {pkg.includes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pkg.includes.slice(0, 3).map((inc, i) => <Badge key={i} variant="outline" className="text-[10px]">{inc}</Badge>)}
                    {pkg.includes.length > 3 && <Badge variant="outline" className="text-[10px]">+{pkg.includes.length - 3}</Badge>}
                  </div>
                )}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xl font-bold text-primary">₱{pkg.price?.toLocaleString()}</p>
                  <Button className="rounded-full" onClick={() => setBookingPkg(pkg)}>Book Now</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={!!bookingPkg} onOpenChange={handleCloseBooking}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{bookingSuccess ? 'Booking Submitted!' : `Book: ${bookingPkg?.title}`}</DialogTitle>
          </DialogHeader>

          {bookingSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">Booking Received!</p>
                <p className="text-sm text-muted-foreground mt-1">Your booking request has been sent to <span className="font-medium text-foreground">{agency?.name}</span>. They will confirm your booking shortly.</p>
              </div>
              <div className="bg-muted rounded-xl p-4 text-left space-y-1 text-sm">
                <p><span className="text-muted-foreground">Package:</span> <span className="font-medium">{bookingPkg?.title}</span></p>
                <p><span className="text-muted-foreground">Travel Date:</span> <span className="font-medium">{bookForm.travel_date}</span></p>
                <p><span className="text-muted-foreground">Pax:</span> <span className="font-medium">{bookForm.num_pax}</span></p>
                <p><span className="text-muted-foreground">Total:</span> <span className="font-bold text-primary">₱{((bookingPkg?.price || 0) * bookForm.num_pax).toLocaleString()}</span></p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={handleCloseBooking}>Close</Button>
                <Button className="flex-1 rounded-full" onClick={() => { handleCloseBooking(); window.location.href = '/profile'; }}>View Bookings</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pre-filled user info */}
              <div className="bg-muted rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{user?.full_name?.[0] || '?'}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div>
                <Label>Travel Date <span className="text-destructive">*</span></Label>
                {bookingPkg?.available_dates?.length > 0 ? (
                  <div className="space-y-2">
                    <Select value={bookForm.travel_date} onValueChange={v => setBookForm(p => ({ ...p, travel_date: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an available date" />
                      </SelectTrigger>
                      <SelectContent>
                        {bookingPkg.available_dates
                          .filter(d => d >= new Date().toISOString().split('T')[0])
                          .sort()
                          .map(d => (
                            <SelectItem key={d} value={d}>{new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">These are the agency's scheduled hike dates.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input type="date" min={new Date().toISOString().split('T')[0]} value={bookForm.travel_date} onChange={e => setBookForm(p => ({ ...p, travel_date: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">No fixed dates set — choose your preferred date.</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Number of Participants</Label>
                <Input type="number" min={1} max={bookingPkg?.max_pax || 99} value={bookForm.num_pax} onChange={e => setBookForm(p => ({ ...p, num_pax: Number(e.target.value) }))} />
                {bookingPkg?.max_pax && <p className="text-xs text-muted-foreground mt-1">Max {bookingPkg.max_pax} participants</p>}
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={bookForm.payment_method} onValueChange={v => setBookForm(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash on meetup</SelectItem>
                    <SelectItem value="credit_card">Credit / Debit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contact Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="+63 9XX XXX XXXX" value={bookForm.contact_phone} onChange={e => setBookForm(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Special Requests <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea placeholder="Dietary needs, accessibility requirements, etc." value={bookForm.notes} onChange={e => setBookForm(p => ({ ...p, notes: e.target.value }))} className="resize-none" rows={3} />
              </div>
              <div className="bg-muted rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Price</p>
                  <p className="text-2xl font-bold text-primary">₱{((bookingPkg?.price || 0) * bookForm.num_pax).toLocaleString()}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>₱{bookingPkg?.price?.toLocaleString()} × {bookForm.num_pax} pax</p>
                  <Badge variant="outline" className="mt-1">{bookForm.payment_method}</Badge>
                </div>
              </div>
              <Button className="w-full rounded-full" onClick={handleBook} disabled={isBooking || !bookForm.travel_date}>
                {isBooking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Booking
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}