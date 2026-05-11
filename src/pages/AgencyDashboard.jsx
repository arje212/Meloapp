import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Store, Package, CalendarDays, MessageCircle, BookOpen, Plus, Loader2,
  Upload, Trash2, CheckCircle, XCircle, AlertCircle, Mountain, Users,
  CreditCard, ArrowLeft, Edit, Star, PenSquare, TrendingUp
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import FinancialSummary from '@/components/agency/FinancialSummary';

const bookingStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  completed: 'bg-primary/10 text-primary',
  cancelled: 'bg-red-100 text-red-800',
};

export default function AgencyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pkgDialog, setPkgDialog] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [tripDialog, setTripDialog] = useState(false);
  const [postDialog, setPostDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pkgForm, setPkgForm] = useState({ title: '', description: '', mountain_name: '', price: '', currency: 'PHP', duration_days: '', max_pax: '', includes: '', image_url: '', available_dates: '' });
  const [tripForm, setTripForm] = useState({ title: '', description: '', mountain_name: '', start_date: '', end_date: '', max_participants: 10, budget_estimate: '', is_public: true });
  const [postForm, setPostForm] = useState({ content: '', post_type: 'agency_promo' });
  const [uploading, setUploading] = useState(false);

  // Fetch agency
  const { data: agencies = [], isLoading: loadingAgency } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn: () => base44.entities.Agency.filter({ owner_email: user?.email }),
    enabled: !!user?.email,
  });

  const agency = agencies[0];

  const { data: subs = [] } = useQuery({
    queryKey: ['my-subs', agency?.id],
    queryFn: () => base44.entities.AgencySubscription.filter({ agency_id: agency.id, status: 'verified' }),
    enabled: !!agency?.id,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['agency-packages', agency?.id],
    queryFn: () => base44.entities.TourPackage.filter({ agency_id: agency.id }),
    enabled: !!agency?.id,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['agency-bookings', agency?.id],
    queryFn: () => base44.entities.Booking.filter({ agency_id: agency.id }, '-created_date', 100),
    enabled: !!agency?.id,
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['agency-trips', agency?.id],
    queryFn: () => base44.entities.Trip.filter({ organizer_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['agency-posts', user?.email],
    queryFn: () => base44.entities.Post.filter({ author_email: user.email, status: 'active' }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: chatRooms = [] } = useQuery({
    queryKey: ['agency-chats', user?.email],
    queryFn: async () => {
      const all = await base44.entities.ChatRoom.list('-updated_date', 100);
      return all.filter(r => r.participants?.includes(user.email));
    },
    enabled: !!user?.email,
  });

  const activeSub = subs[0];
  const hasActiveSub = !!activeSub;

  // ---------- SAVE PACKAGE ----------
  const handleSavePkg = async () => {
    setSaving(true);
    const data = {
      ...pkgForm,
      agency_id: agency.id,
      agency_name: agency.name,
      price: Number(pkgForm.price),
      duration_days: Number(pkgForm.duration_days) || undefined,
      max_pax: Number(pkgForm.max_pax) || undefined,
      includes: pkgForm.includes ? pkgForm.includes.split('\n').map(s => s.trim()).filter(Boolean) : [],
      available_dates: pkgForm.available_dates ? pkgForm.available_dates.split('\n').map(s => s.trim()).filter(Boolean) : [],
      status: 'active',
    };
    if (editPkg) {
      await base44.entities.TourPackage.update(editPkg.id, data);
    } else {
      await base44.entities.TourPackage.create(data);
    }
    qc.invalidateQueries({ queryKey: ['agency-packages'] });
    setPkgDialog(false);
    setEditPkg(null);
    setPkgForm({ title: '', description: '', mountain_name: '', price: '', currency: 'PHP', duration_days: '', max_pax: '', includes: '', image_url: '', available_dates: '' });
    setSaving(false);
  };

  // ---------- SAVE TRIP ----------
  const handleSaveTrip = async () => {
    setSaving(true);
    const data = {
      ...tripForm,
      organizer_email: user.email,
      organizer_name: user.full_name,
      max_participants: Number(tripForm.max_participants),
      budget_estimate: Number(tripForm.budget_estimate) || undefined,
      status: 'open',
    };
    const trip = await base44.entities.Trip.create(data);
    await base44.entities.TripMember.create({ trip_id: trip.id, user_email: user.email, user_name: user.full_name, status: 'going', role: 'organizer' });
    qc.invalidateQueries({ queryKey: ['agency-trips'] });
    setTripDialog(false);
    setTripForm({ title: '', description: '', mountain_name: '', start_date: '', end_date: '', max_participants: 10, budget_estimate: '', is_public: true });
    setSaving(false);
  };

  // ---------- SAVE POST ----------
  const handleSavePost = async () => {
    setSaving(true);
    await base44.entities.Post.create({
      ...postForm,
      author_email: user.email,
      author_name: agency?.name || user.full_name,
      status: 'active',
    });
    qc.invalidateQueries({ queryKey: ['agency-posts'] });
    setPostDialog(false);
    setPostForm({ content: '', post_type: 'agency_promo' });
    setSaving(false);
  };

  const handleUpdateBooking = async (id, status) => {
    await base44.entities.Booking.update(id, { status });
    qc.invalidateQueries({ queryKey: ['agency-bookings'] });
  };

  const openEditPkg = (pkg) => {
    setEditPkg(pkg);
    setPkgForm({
      title: pkg.title,
      description: pkg.description || '',
      mountain_name: pkg.mountain_name,
      price: String(pkg.price),
      currency: pkg.currency || 'PHP',
      duration_days: String(pkg.duration_days || ''),
      max_pax: String(pkg.max_pax || ''),
      includes: (pkg.includes || []).join('\n'),
      image_url: pkg.image_url || '',
      available_dates: (pkg.available_dates || []).join('\n'),
    });
    setPkgDialog(true);
  };

  if (loadingAgency) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!agency) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">No Agency Found</h2>
        <p className="text-sm text-muted-foreground mb-4">Register your agency to access the dashboard.</p>
        <Button className="rounded-full" onClick={() => navigate('/agency-register')}>Register Agency</Button>
      </div>
    );
  }

  if (agency.status === 'pending') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500/60 mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Under Review</h2>
        <p className="text-sm text-muted-foreground">Your agency registration is pending admin approval.</p>
      </div>
    );
  }

  if (agency.status === 'rejected') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <XCircle className="w-16 h-16 text-destructive/60 mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Application Rejected</h2>
        <p className="text-sm text-muted-foreground">Contact support for more information.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="bg-card border rounded-2xl p-4 sm:p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {agency.logo_url ? <img src={agency.logo_url} className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-bold">{agency.name}</h1>
              {agency.is_verified && <Badge className="bg-green-100 text-green-700 border-0 text-xs">✓ Verified</Badge>}
              {hasActiveSub
                ? <Badge className="bg-primary/10 text-primary border-0 text-xs capitalize">{activeSub.plan} Plan</Badge>
                : <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">No Active Subscription</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{agency.location} · {agency.contact_phone}</p>
          </div>
          {!hasActiveSub && (
            <Button size="sm" className="rounded-full text-xs shrink-0" onClick={() => navigate('/agency-subscribe')}>Subscribe Now</Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Packages', value: packages.length, icon: Package },
            { label: 'Trips', value: trips.length, icon: Mountain },
            { label: 'Bookings', value: bookings.length, icon: BookOpen },
            { label: 'Messages', value: chatRooms.length, icon: MessageCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-muted rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-primary">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bookings">
        <TabsList className="w-full grid grid-cols-6 h-auto p-1 mb-4">
          <TabsTrigger value="finance" className="text-xs py-1.5"><TrendingUp className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Finance</span></TabsTrigger>
          <TabsTrigger value="bookings" className="text-xs py-1.5">Bookings</TabsTrigger>
          <TabsTrigger value="packages" className="text-xs py-1.5">Packages</TabsTrigger>
          <TabsTrigger value="trips" className="text-xs py-1.5">Trips</TabsTrigger>
          <TabsTrigger value="posts" className="text-xs py-1.5">Posts</TabsTrigger>
          <TabsTrigger value="messages" className="text-xs py-1.5">Chats</TabsTrigger>
        </TabsList>

        {/* ── FINANCE ── */}
        <TabsContent value="finance">
          <FinancialSummary bookings={bookings} packages={packages} />
        </TabsContent>

        {/* ── BOOKINGS ── */}
        <TabsContent value="bookings" className="space-y-3">
          {bookings.length === 0
            ? <EmptyState icon={BookOpen} msg="No bookings yet." />
            : bookings.map(b => (
                <div key={b.id} className="bg-card border rounded-xl p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm">{b.package_title}</p>
                      <p className="text-xs text-muted-foreground">{b.user_name} · {b.user_email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${bookingStatusColors[b.status] || 'bg-muted text-muted-foreground'}`}>{b.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                    {b.travel_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{b.travel_date}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.num_pax} pax</span>
                    <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{b.payment_method?.replace('_', ' ')}</span>
                    <span className="font-bold text-primary">₱{b.total_price?.toLocaleString()}</span>
                  </div>
                  {b.notes && <p className="text-xs text-muted-foreground mb-2 italic">"{b.notes}"</p>}
                  {b.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-full h-7 text-xs flex-1" onClick={() => handleUpdateBooking(b.id, 'confirmed')}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full h-7 text-xs flex-1" onClick={() => handleUpdateBooking(b.id, 'cancelled')}>
                        <XCircle className="w-3 h-3 mr-1" /> Decline
                      </Button>
                    </div>
                  )}
                  {b.status === 'confirmed' && (
                    <Button size="sm" className="rounded-full h-7 text-xs w-full" onClick={() => handleUpdateBooking(b.id, 'completed')}>
                      Mark as Completed
                    </Button>
                  )}
                </div>
              ))
          }
        </TabsContent>

        {/* ── PACKAGES ── */}
        <TabsContent value="packages" className="space-y-3">
          {!hasActiveSub && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3 text-sm">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
              <span className="text-yellow-800">Subscribe to a plan to manage packages.</span>
              <Button size="sm" className="rounded-full h-7 text-xs ml-auto shrink-0" onClick={() => navigate('/agency-subscribe')}>Subscribe</Button>
            </div>
          )}
          <Button className="w-full rounded-full" disabled={!hasActiveSub} onClick={() => { setEditPkg(null); setPkgDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Tour Package
          </Button>
          {packages.length === 0
            ? <EmptyState icon={Package} msg="No packages yet." />
            : packages.map(pkg => (
                <div key={pkg.id} className="bg-card border rounded-xl p-3 flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                    {pkg.image_url && <img src={pkg.image_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{pkg.title}</p>
                    <p className="text-xs text-muted-foreground">{pkg.mountain_name}</p>
                    <p className="text-primary font-bold text-sm mt-1">₱{pkg.price?.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => openEditPkg(pkg)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-destructive" onClick={async () => { await base44.entities.TourPackage.delete(pkg.id); qc.invalidateQueries({ queryKey: ['agency-packages'] }); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
          }
        </TabsContent>

        {/* ── TRIPS ── */}
        <TabsContent value="trips" className="space-y-3">
          <Button className="w-full rounded-full" onClick={() => setTripDialog(true)}>
            <Plus className="w-4 h-4 mr-2" /> Organize a Trip
          </Button>
          {trips.length === 0
            ? <EmptyState icon={Mountain} msg="No trips organized yet." />
            : trips.map(trip => (
                <Link key={trip.id} to={`/trips/${trip.id}`} className="block">
                  <div className="bg-card border rounded-xl p-3 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{trip.title}</p>
                        <p className="text-xs text-muted-foreground">{trip.mountain_name}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{trip.status}</Badge>
                    </div>
                    {trip.start_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <CalendarDays className="w-3 h-3" /> {trip.start_date}
                      </p>
                    )}
                  </div>
                </Link>
              ))
          }
        </TabsContent>

        {/* ── POSTS ── */}
        <TabsContent value="posts" className="space-y-3">
          <Button className="w-full rounded-full" onClick={() => setPostDialog(true)}>
            <PenSquare className="w-4 h-4 mr-2" /> Create Post / Promo
          </Button>
          {posts.length === 0
            ? <EmptyState icon={PenSquare} msg="No posts yet." />
            : posts.map(post => (
                <div key={post.id} className="bg-card border rounded-xl p-3">
                  <p className="text-sm line-clamp-2">{post.content}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{format(new Date(post.created_date), 'MMM d, yyyy')}</span>
                    <span>{post.like_count || 0} likes · {post.comment_count || 0} comments</span>
                  </div>
                </div>
              ))
          }
        </TabsContent>

        {/* ── MESSAGES ── */}
        <TabsContent value="messages" className="space-y-1">
          {chatRooms.length === 0
            ? <EmptyState icon={MessageCircle} msg="No conversations yet. Users can message you from your agency page." />
            : chatRooms.map(room => {
                const otherIdx = room.participants?.indexOf(user.email) === 0 ? 1 : 0;
                const name = room.name || room.participant_names?.[otherIdx] || room.participants?.[otherIdx] || 'User';
                return (
                  <Link key={room.id} to={`/chat/${room.id}`} className="block">
                    <div className="flex items-center gap-3 p-3 bg-card border rounded-xl hover:bg-muted transition-colors">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{name}</p>
                        {room.last_message && <p className="text-xs text-muted-foreground truncate">{room.last_message}</p>}
                      </div>
                    </div>
                  </Link>
                );
              })
          }
        </TabsContent>
      </Tabs>

      {/* ── PACKAGE DIALOG ── */}
      <Dialog open={pkgDialog} onOpenChange={v => { if (!saving) { setPkgDialog(v); if (!v) setEditPkg(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPkg ? 'Edit Package' : 'New Tour Package'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Package Title *</Label><Input value={pkgForm.title} onChange={e => setPkgForm(p => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
            <div><Label>Mountain / Destination *</Label><Input value={pkgForm.mountain_name} onChange={e => setPkgForm(p => ({ ...p, mountain_name: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₱) *</Label><Input type="number" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))} className="mt-1" /></div>
              <div><Label>Duration (days)</Label><Input type="number" value={pkgForm.duration_days} onChange={e => setPkgForm(p => ({ ...p, duration_days: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>Max Participants</Label><Input type="number" value={pkgForm.max_pax} onChange={e => setPkgForm(p => ({ ...p, max_pax: e.target.value }))} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} rows={2} className="resize-none mt-1" /></div>
            <div><Label>Inclusions (one per line)</Label><Textarea value={pkgForm.includes} onChange={e => setPkgForm(p => ({ ...p, includes: e.target.value }))} placeholder="Meals&#10;Guide&#10;Tent" rows={3} className="resize-none mt-1" /></div>
            <div><Label>Available Dates (one per line, YYYY-MM-DD)</Label><Textarea value={pkgForm.available_dates} onChange={e => setPkgForm(p => ({ ...p, available_dates: e.target.value }))} placeholder="2025-06-01&#10;2025-06-08" rows={2} className="resize-none mt-1" /></div>
            <div><Label>Cover Image URL</Label><Input value={pkgForm.image_url} onChange={e => setPkgForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." className="mt-1" /></div>
            <Button className="w-full rounded-full" onClick={handleSavePkg} disabled={!pkgForm.title || !pkgForm.price || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} {editPkg ? 'Save Changes' : 'Create Package'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── TRIP DIALOG ── */}
      <Dialog open={tripDialog} onOpenChange={v => { if (!saving) setTripDialog(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Organize a Trip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Trip Title *</Label><Input value={tripForm.title} onChange={e => setTripForm(p => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
            <div><Label>Mountain *</Label><Input value={tripForm.mountain_name} onChange={e => setTripForm(p => ({ ...p, mountain_name: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date *</Label><Input type="date" value={tripForm.start_date} onChange={e => setTripForm(p => ({ ...p, start_date: e.target.value }))} className="mt-1" /></div>
              <div><Label>End Date</Label><Input type="date" value={tripForm.end_date} onChange={e => setTripForm(p => ({ ...p, end_date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Max Participants</Label><Input type="number" value={tripForm.max_participants} onChange={e => setTripForm(p => ({ ...p, max_participants: e.target.value }))} className="mt-1" /></div>
              <div><Label>Budget Estimate (₱)</Label><Input type="number" value={tripForm.budget_estimate} onChange={e => setTripForm(p => ({ ...p, budget_estimate: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={tripForm.description} onChange={e => setTripForm(p => ({ ...p, description: e.target.value }))} rows={3} className="resize-none mt-1" /></div>
            <Button className="w-full rounded-full" onClick={handleSaveTrip} disabled={!tripForm.title || !tripForm.mountain_name || !tripForm.start_date || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── POST DIALOG ── */}
      <Dialog open={postDialog} onOpenChange={v => { if (!saving) setPostDialog(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Agency Post</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Post Type</Label>
              <Select value={postForm.post_type} onValueChange={v => setPostForm(p => ({ ...p, post_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency_promo">Agency Promo</SelectItem>
                  <SelectItem value="tour_package">Tour Package</SelectItem>
                  <SelectItem value="tip">Hiking Tip</SelectItem>
                  <SelectItem value="experience">Experience Share</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Content *</Label><Textarea value={postForm.content} onChange={e => setPostForm(p => ({ ...p, content: e.target.value }))} rows={4} placeholder="Share an update, promo, or tip..." className="resize-none mt-1" /></div>
            <Button className="w-full rounded-full" onClick={handleSavePost} disabled={!postForm.content || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <div className="text-center py-10">
      <Icon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}