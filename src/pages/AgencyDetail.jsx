import { useState } from 'react';
import { fetchMyChatRooms } from '@/lib/chatHelpers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Store, MapPin, Star, CheckCircle, MessageCircle,
  Mountain, Clock, Users, Loader2, CheckCircle2, Phone,
  LayoutDashboard, AlertTriangle, Check, Info,
  Camera, Shield, Award, Calendar, Globe, Facebook, Instagram,
  ChevronLeft, ChevronRight, X, ZoomIn, ImageOff, ThumbsUp,
  BadgeCheck, FileText, Flag, Share2,
  Bookmark, BookmarkCheck, Timer, UserCheck,
  Megaphone, ClipboardList, CheckSquare, UserPlus, CreditCard, TrendingUp, Upload, Receipt,
} from 'lucide-react';
import { unlockAchievement } from '@/lib/achievements';
import { uploadFile } from '@/lib/uploadFile';
import { createBooking } from '@/lib/createBooking';
import { getCommissionRate, pickActiveSubscription, todayStr as localToday } from '@/lib/plans';
import PlanBadge from '@/components/agencies/PlanBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const asList = (value) => Array.isArray(value)
  ? value.filter(Boolean)
  : String(value || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);

const TRUST_LEVELS = {
  verified: { label: 'Verified Agency',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: BadgeCheck },
  starter:  { label: 'Starter Plan',     color: 'bg-blue-100 text-blue-800 border-blue-200',         icon: Shield },
  pro:      { label: 'Pro Agency',        color: 'bg-violet-100 text-violet-800 border-violet-200',   icon: Award },
  yearly:   { label: 'Partner Agency',   color: 'bg-amber-100 text-amber-800 border-amber-200',      icon: Star },
};

const REPORT_REASONS = [
  'Fake photos or misrepresentation','Scam or fraud attempt','Unresponsive after payment',
  'Overpriced / hidden fees','Poor or unsafe service','Inappropriate behavior','Other',
];

const BOOKING_STATUS_CONFIG = {
  pending:              { label: 'Pending Review',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200',   icon: Clock,        desc: 'Hinihintay ang confirmation ng agency.' },
  confirmed:            { label: 'Confirmed!',        color: 'bg-blue-100 text-blue-800 border-blue-200',         icon: CheckCircle,  desc: 'Na-confirm na ng agency ang iyong booking.' },
  paid:                 { label: 'Payment Received', color: 'bg-green-100 text-green-800 border-green-200',      icon: CreditCard,   desc: 'Natanggap na ang iyong bayad.' },
  completed:            { label: 'Trip Completed',   color: 'bg-primary/10 text-primary border-primary/20',      icon: CheckCircle2, desc: 'Tapos na ang trip. Salamat!' },
  commission_sent:      { label: 'Processing',       color: 'bg-orange-100 text-orange-800 border-orange-200',   icon: TrendingUp,   desc: 'Processing ang iyong booking.' },
  commission_confirmed: { label: 'All Done!',        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',icon: CheckCircle2, desc: 'Lahat ay confirmed!' },
  cancelled:            { label: 'Cancelled',        color: 'bg-red-100 text-red-800 border-red-200',            icon: X,            desc: 'Na-cancel ang booking.' },
};

const DOWNPAYMENT_RATE = 0.3;

const countBookedPax = (bookingsForPkg = [], travelDate) => {
  return bookingsForPkg
    .filter(b => b && b.status !== 'cancelled' && (travelDate ? b.travel_date === travelDate : true))
    .reduce((sum, b) => sum + (Number(b.num_pax) || 1), 0);
};

function PhotoLightbox({ photos, startIndex, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  const prev = () => setCurrent(i => (i - 1 + photos.length) % photos.length);
  const next = () => setCurrent(i => (i + 1) % photos.length);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 rounded-full p-2" onClick={onClose}><X className="w-5 h-5" /></button>
      <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 rounded-full p-3" onClick={e => { e.stopPropagation(); prev(); }}><ChevronLeft className="w-5 h-5" /></button>
      <div className="max-w-3xl max-h-[80vh] px-16" onClick={e => e.stopPropagation()}>
        <img src={photos[current]} alt="" className="max-w-full max-h-[75vh] object-contain rounded-lg" />
        <p className="text-white/60 text-center text-sm mt-2">{current + 1} / {photos.length}</p>
      </div>
      <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 rounded-full p-3" onClick={e => { e.stopPropagation(); next(); }}><ChevronRight className="w-5 h-5" /></button>
    </div>
  );
}

function AgencyGallery({ photos = [] }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  if (!photos.length) return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center"><ImageOff className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No background photos uploaded yet</p></div>
  );
  const visible = photos.slice(0, 5);
  const remaining = photos.length - 5;
  return (
    <>
      <div className="grid grid-cols-4 gap-2 h-56">
        <div className="col-span-2 row-span-2 relative rounded-xl overflow-hidden cursor-pointer group" onClick={() => setLightboxIndex(0)}>
          <img src={visible[0]} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"><ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" /></div>
        </div>
        {visible.slice(1, 5).map((photo, i) => (
          <div key={i} className="relative rounded-xl overflow-hidden cursor-pointer group" onClick={() => setLightboxIndex(i + 1)}>
            <img src={photo} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            {i === 3 && remaining > 0 ? <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white font-bold text-lg">+{remaining}</span></div> : <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"><ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" /></div>}
          </div>
        ))}
      </div>
      {lightboxIndex !== null && <PhotoLightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
    </>
  );
}

function TrustPanel({ agency, agencyPlan }) {
  const trustItems = [
    { icon: BadgeCheck, label: 'Platform Verified', desc: agency.is_verified ? 'Identity & documents checked by Melotrip' : 'Not yet verified', ok: !!agency.is_verified },
    { icon: Camera, label: 'Background Photos', desc: agency.gallery_photos?.length ? `${agency.gallery_photos.length} proof photo${agency.gallery_photos.length > 1 ? 's' : ''} uploaded` : 'No background photos yet', ok: !!(agency.gallery_photos?.length) },
    { icon: Calendar, label: 'Member Since', desc: agency.created_date ? new Date(agency.created_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' }) : 'Date unavailable', ok: !!agency.created_date },
    { icon: ThumbsUp, label: 'Completed Bookings', desc: agency.total_bookings ? `${agency.total_bookings} confirmed trips done` : 'No bookings yet', ok: (agency.total_bookings || 0) > 0 },
    { icon: FileText, label: 'Subscription Plan', desc: agencyPlan !== 'free' ? `Active ${agencyPlan.charAt(0).toUpperCase() + agencyPlan.slice(1)} plan` : 'Free tier', ok: agencyPlan !== 'free' },
    { icon: ClipboardList, label: 'Business Registration', desc: agency.business_reg_number ? `Reg. No. ${agency.business_reg_number}` : 'Not provided', ok: !!agency.business_reg_number },
    { icon: CheckSquare, label: 'DOLE / Permit', desc: agency.permit_number ? `Permit No. ${agency.permit_number}` : 'Not provided', ok: !!agency.permit_number },
  ];
  const score = trustItems.filter(t => t.ok).length;
  const scoreColor = score >= 5 ? 'text-emerald-600' : score >= 3 ? 'text-amber-600' : 'text-red-500';
  const scoreBg = score >= 5 ? 'bg-emerald-50 border-emerald-200' : score >= 3 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  return (
    <div className={`rounded-2xl border p-4 ${scoreBg} space-y-3`}>
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Shield className={`w-5 h-5 ${scoreColor}`} /><span className={`font-semibold text-sm ${scoreColor}`}>Agency Trust Score</span></div><span className={`text-lg font-bold ${scoreColor}`}>{score}/{trustItems.length}</span></div>
      <div className="w-full h-2 rounded-full bg-white/60 overflow-hidden"><div className={`h-full rounded-full transition-all ${score >= 5 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${(score / trustItems.length) * 100}%` }} /></div>
      <div className="space-y-2">
        {trustItems.map((item, i) => { const Icon = item.icon; return (
          <div key={i} className="flex items-start gap-2.5 bg-white/60 rounded-xl p-2.5">
            <div className={`mt-0.5 rounded-full p-1 ${item.ok ? 'bg-emerald-100' : 'bg-gray-100'}`}><Icon className={`w-3.5 h-3.5 ${item.ok ? 'text-emerald-600' : 'text-gray-400'}`} /></div>
            <div className="flex-1 min-w-0"><p className="text-xs font-medium text-foreground">{item.label}</p><p className="text-[11px] text-muted-foreground">{item.desc}</p></div>
            {item.ok ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> : <X className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />}
          </div>
        ); })}
      </div>
    </div>
  );
}

function StarRatingInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)} onClick={() => onChange(n)} className="transition-transform hover:scale-110">
          <Star className={`w-7 h-7 transition-colors ${n <= (hovered || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

function JoinerSlotsTab({ agencyId, packages, user, isAgencyOwner, onBook }) {
  const { data: joinerSlots = [], isLoading } = useQuery({
    queryKey: ['joiner-slots', agencyId],
    queryFn: async () => { const all = await base44.entities.Booking.filter({ agency_id: agencyId, is_joiner_slot: true }); return all.filter(b => b.status !== 'cancelled' && b.status !== 'completed'); },
    enabled: !!agencyId,
  });
  const { data: slotBookings = [] } = useQuery({
    queryKey: ['slot-bookings', agencyId],
    queryFn: () => base44.entities.Booking.filter({ agency_id: agencyId, joined_slot: true }),
    enabled: !!agencyId,
  });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!joinerSlots.length) return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center"><UserPlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">Walang available joiner slots</p><p className="text-xs text-muted-foreground mt-1">Mag-chat sa agency para tanungin ang availability</p></div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Joiner slots ay para sa mga solo o maliit na grupo na gustong sumama sa existing trip ng agency.</span></div>
      <div className="space-y-3">
        {joinerSlots.map(slot => {
          const joined = slotBookings.filter(b => b.slot_id === slot.id).length;
          const available = (slot.max_joiners || 0) - joined;
          const isFull = available <= 0;
          const fillPct = slot.max_joiners ? Math.round((joined / slot.max_joiners) * 100) : 0;
          return (
            <div key={slot.id} className={`bg-card border rounded-2xl overflow-hidden ${isFull ? 'opacity-70' : ''}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div><p className="font-semibold text-sm">{slot.package_title}</p><div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">{slot.travel_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{slot.travel_date}</span>}<span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{slot.pickup_location || 'TBD'}</span></div></div>
                  <div className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${isFull ? 'bg-red-100 text-red-700 border-red-200' : available <= 2 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>{isFull ? 'FULL' : `${available} slot${available !== 1 ? 's' : ''} left`}</div>
                </div>
                <div className="space-y-1 mb-3"><div className="flex justify-between text-[10px] text-muted-foreground"><span>{joined}/{slot.max_joiners || '?'} joiners</span><span>{fillPct}% full</span></div><div className="w-full h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full transition-all ${isFull ? 'bg-red-500' : fillPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(fillPct, 100)}%` }} /></div></div>
                {Number(slot.joiner_price) > 0 && (
                  <div className="flex items-center justify-between">
                    <div><p className="text-lg font-bold text-primary">P{slot.joiner_price?.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">per joiner</p></div>
                    {!isAgencyOwner && !isFull && user && <Button size="sm" className="rounded-full" onClick={() => onBook(slot)}><UserPlus className="w-3.5 h-3.5 mr-1" />Join Slot</Button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewsTab({ agencyId, user }) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['agency-reviews', agencyId],
    queryFn: () => base44.entities.AgencyReview.filter({ agency_id: agencyId }),
    enabled: !!agencyId,
  });
  const [formError, setFormError] = useState('');
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true); setFormError('');
    try {
    await base44.entities.AgencyReview.create({ agency_id: agencyId, user_email: user.email, user_name: user.full_name || user.email, rating, comment, created_date: new Date().toISOString() });
    queryClient.invalidateQueries(['agency-reviews', agencyId]);
    setSubmitted(true); setShowForm(false); setRating(0); setComment('');
    } catch (err) {
      console.error('Review failed:', err);
      setFormError(/duplicate|unique/i.test(err?.message || '') ? 'You already reviewed this agency.' : 'Could not save your review. Please try again.');
    } finally { setSubmitting(false); }
  };
  const distrib = [5,4,3,2,1].map(n => ({ n, count: reviews.filter(r => r.rating === n).length }));
  return (
    <div className="space-y-4">
      {reviews.length > 0 && (
        <div className="bg-card border rounded-2xl p-4 flex gap-6 items-center">
          <div className="text-center shrink-0"><p className="text-4xl font-bold text-primary">{avgRating}</p><div className="flex gap-0.5 justify-center mt-1">{[1,2,3,4,5].map(n => <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}</div><p className="text-xs text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p></div>
          <div className="flex-1 space-y-1">{distrib.map(({ n, count }) => (<div key={n} className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-3">{n}</span><Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" /><div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-yellow-400 rounded-full" style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }} /></div><span className="text-xs text-muted-foreground w-4 text-right">{count}</span></div>))}</div>
        </div>
      )}
      {user && !submitted && <button onClick={() => setShowForm(v => !v)} className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-2xl py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"><Star className="w-4 h-4" />{showForm ? 'Cancel' : 'Write a Review'}</button>}
      {submitted && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800"><CheckCircle2 className="w-4 h-4 shrink-0" />Thank you for your review!</div>}
      {showForm && (
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium">Your Rating</p>
          <StarRatingInput value={rating} onChange={setRating} />
          <div><Label>Comment <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea placeholder="Share your experience..." value={comment} onChange={e => setComment(e.target.value)} className="resize-none mt-1" rows={3} /></div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button className="w-full rounded-full" onClick={handleSubmit} disabled={!rating || submitting}>{submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Submit Review</Button>
        </div>
      )}
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      : reviews.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center"><Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">No reviews yet</p></div>
      : <div className="space-y-3">{reviews.map((review, i) => (
        <div key={i} className="bg-card border rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{(review.user_name || '?')[0].toUpperCase()}</span></div><div><p className="text-sm font-medium">{review.user_name || 'Anonymous'}</p><p className="text-[11px] text-muted-foreground">{review.created_date ? new Date(review.created_date).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : ''}</p></div></div>
            <div className="flex gap-0.5">{[1,2,3,4,5].map(n => <Star key={n} className={`w-3.5 h-3.5 ${n <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />)}</div>
          </div>
          {review.comment && <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>}
        </div>
      ))}</div>}
    </div>
  );
}

function GuidesTab({ agency, isAgencyOwner }) {
  const guides = agency.guides || [];
  if (!guides.length) return <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center"><UserCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">No guide profiles yet</p><p className="text-xs text-muted-foreground mt-1">{isAgencyOwner ? 'Add your guides in the agency dashboard.' : "This agency hasn't added guide profiles yet."}</p></div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {guides.map((guide, i) => (
        <div key={i} className="bg-card border rounded-2xl p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">{guide.photo_url ? <img src={guide.photo_url} alt={guide.name} className="w-full h-full object-cover" /> : <UserCheck className="w-6 h-6 text-primary" />}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap"><p className="font-semibold text-sm">{guide.name}</p>{guide.certified && <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5"><BadgeCheck className="w-3 h-3" />Certified</span>}</div>
            {guide.years_experience && <p className="text-xs text-muted-foreground mt-0.5">{guide.years_experience} year{guide.years_experience !== 1 ? 's' : ''} experience</p>}
            {guide.bio && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{guide.bio}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleTab({ packages, bookingsByPkg = {} }) {
  const today = localToday();
  const allTrips = packages.flatMap(pkg => {
    const pkgBookings = bookingsByPkg[pkg.id] || [];
    return (pkg.available_dates || []).filter(d => d >= today).map(d => {
      const bookedCount = countBookedPax(pkgBookings, d);
      const available = pkg.max_pax ? Math.max(0, pkg.max_pax - bookedCount) : null;
      const isFull = pkg.max_pax ? bookedCount >= pkg.max_pax : false;
      return { ...pkg, trip_date: d, bookedCount, available, isFull };
    });
  }).sort((a, b) => a.trip_date.localeCompare(b.trip_date));
  if (!allTrips.length) return <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center"><Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">No upcoming trips scheduled</p></div>;
  const byMonth = {};
  allTrips.forEach(trip => { const d = new Date(trip.trip_date + 'T00:00:00'); const key = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' }); if (!byMonth[key]) byMonth[key] = []; byMonth[key].push(trip); });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Slots available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Almost full</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Full</span>
      </div>
      {Object.entries(byMonth).map(([month, trips]) => (
        <div key={month}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{month}</p>
          <div className="space-y-2">
            {trips.map((trip, i) => {
              const d = new Date(trip.trip_date + 'T00:00:00');
              const fillPct = trip.max_pax ? Math.round((trip.bookedCount / trip.max_pax) * 100) : 0;
              return (
                <div key={i} className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${trip.isFull ? 'opacity-60' : ''}`}>
                  <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${trip.isFull ? 'bg-red-100' : trip.available !== null && trip.available <= 2 ? 'bg-amber-100' : 'bg-primary/10'}`}>
                    <span className={`text-[10px] font-medium uppercase ${trip.isFull ? 'text-red-600' : 'text-primary'}`}>{d.toLocaleDateString('en-PH', { month: 'short' })}</span>
                    <span className={`text-lg font-bold leading-none ${trip.isFull ? 'text-red-600' : 'text-primary'}`}>{d.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{trip.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mountain className="w-3 h-3" />{trip.mountain_name}{trip.duration_days && <span className="ml-1">· {trip.duration_days}D</span>}</p>
                    {trip.max_pax && <div className="mt-1 flex items-center gap-2"><div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[80px]"><div className={`h-full rounded-full ${trip.isFull ? 'bg-red-500' : fillPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(fillPct, 100)}%` }} /></div><span className={`text-[10px] font-semibold ${trip.isFull ? 'text-red-600' : trip.available <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>{trip.isFull ? 'FULL' : `${trip.available} left`}</span></div>}
                  </div>
                  <div className="text-right shrink-0"><p className="text-sm font-bold text-primary">P{trip.price?.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">per pax</p></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MeetupTab({ agency, isAgencyOwner, allAgencyBookings = [] }) {
  const meetupPlaces = agency.meetup_places || [];
  const userMeetups = isAgencyOwner
    ? allAgencyBookings.filter(b => b.pickup_location && b.status !== 'cancelled').map(b => ({ user: b.user_name || b.user_email, location: b.pickup_location, date: b.travel_date, pkg: b.package_title, pax: b.num_pax, status: b.status }))
    : [];
  return (
    <div className="space-y-4">
      {meetupPlaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center"><MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">No meetup places listed</p><p className="text-xs text-muted-foreground mt-1">{isAgencyOwner ? 'Add your meetup points in the agency dashboard.' : 'Chat the agency to ask about assembly points.'}</p></div>
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>These are the agency's usual meetup/assembly points before trips.</span></div>
          {meetupPlaces.map((place, i) => (
            <div key={i} className="bg-card border rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><MapPin className="w-4 h-4 text-primary" /></div><div className="flex-1 min-w-0"><p className="font-semibold text-sm">{place.name}</p>{place.address && <p className="text-xs text-muted-foreground mt-0.5">{place.address}</p>}</div>{place.is_primary && <span className="text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 shrink-0">Primary</span>}</div>
              {place.notes && <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2 leading-relaxed">{place.notes}</p>}
              {place.google_maps_url && <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Globe className="w-3.5 h-3.5" />View on Google Maps</a>}
            </div>
          ))}
        </>
      )}
      {isAgencyOwner && userMeetups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><p className="font-semibold text-sm">User Meetup Locations ({userMeetups.length})</p></div>
          <div className="space-y-2">
            {userMeetups.map((m, i) => (
              <div key={i} className="bg-card border rounded-xl p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{(m.user || '?')[0].toUpperCase()}</span></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1"><p className="text-sm font-medium truncate">{m.user}</p><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${BOOKING_STATUS_CONFIG[m.status]?.color || 'bg-muted text-muted-foreground'}`}>{BOOKING_STATUS_CONFIG[m.status]?.label || m.status}</span></div>
                  <p className="text-xs text-muted-foreground truncate">{m.pkg}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs"><MapPin className="w-3 h-3 text-primary shrink-0" /><span className="font-medium text-primary">{m.location}</span></div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">{m.date && <span>{m.date}</span>}<span>{m.pax} pax</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportModal({ agency, user, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reportError, setReportError] = useState('');
  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true); setReportError('');
    try {
    await base44.entities.AgencyReport.create({ agency_id: agency.id, agency_name: agency.name, reported_by: user.email, reason, details, status: 'pending', created_date: new Date().toISOString() });
    setDone(true);
    } catch (err) {
      console.error('Report failed:', err);
      setReportError('Could not send your report. Please try again.');
    } finally { setSubmitting(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Flag className="w-4 h-4" />Report Agency</DialogTitle></DialogHeader>
        {done ? (
          <div className="text-center space-y-3 py-4"><CheckCircle2 className="w-12 h-12 text-primary mx-auto" /><p className="font-semibold">Report Submitted</p><Button className="w-full rounded-full" onClick={onClose}>Close</Button></div>
        ) : (
          <div className="space-y-4">
            <div><Label>Reason *</Label><Select value={reason} onValueChange={setReason}><SelectTrigger className="mt-1"><SelectValue placeholder="Select a reason" /></SelectTrigger><SelectContent>{REPORT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Additional Details <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea placeholder="Describe the issue..." value={details} onChange={e => setDetails(e.target.value)} className="resize-none mt-1" rows={4} /></div>
            {reportError && <p className="text-xs text-destructive">{reportError}</p>}
            <div className="flex gap-2"><Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Cancel</Button><Button variant="destructive" className="flex-1 rounded-full" onClick={handleSubmit} disabled={!reason || submitting}>{submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Submit Report</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SharePackageDialog({ pkg, agency, user, isOwner, onClose }) {
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const buildCaption = () => isOwner
    ? ['Now open for booking: ' + pkg.title + '!', '', pkg.mountain_name ? 'Mountain: ' + pkg.mountain_name : null, '', 'Book now at Melotrip - P' + (pkg.price?.toLocaleString() || '0') + ' per person!'].filter(l => l !== null).join('\n')
    : ['Check out this package from ' + agency.name + '!', '', pkg.title, pkg.mountain_name || null, 'P' + (pkg.price?.toLocaleString() || '0') + ' per person', '', 'Find them on Melotrip!'].filter(l => l !== null).join('\n');
  if (!initialized) { setCaption(buildCaption()); setInitialized(true); }
  const handlePost = async () => {
    if (!caption.trim()) return;
    setPosting(true);
    try {
      const images = [];
      if (pkg.image_url) images.push(pkg.image_url);
      if (agency.gallery_photos?.length) agency.gallery_photos.slice(0, 4).forEach(p => { if (p !== pkg.image_url) images.push(p); });
      await base44.entities.Post.create({ author_email: user.email, author_name: user.full_name || user.email, content: caption.trim(), image_url: images[0] || null, media_type: 'image', post_images: images, post_type: images.length > 1 ? 'carousel' : 'photo', mountain_name: pkg.mountain_name || null, status: 'active', audience: 'public', package_id: pkg.id, package_price: pkg.price, agency_id: agency.id, agency_name: agency.name });
      setDone(true);
    } catch (err) { console.error('Share post error:', err); } finally { setPosting(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2">{isOwner ? <><Megaphone className="w-4 h-4 text-primary" />Promote Package</> : <><Share2 className="w-4 h-4 text-primary" />Share to Feed</>}</DialogTitle></DialogHeader>
        {done ? (
          <div className="text-center space-y-3 py-4"><CheckCircle2 className="w-12 h-12 text-primary mx-auto" /><p className="font-semibold">Posted to Feed!</p><Button className="w-full rounded-full" onClick={onClose}>Done</Button></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border overflow-hidden"><div className="h-28 bg-muted relative"><img src={pkg.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'} alt={pkg.title} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><div className="absolute bottom-2 left-3 text-white"><p className="font-bold text-sm">{pkg.title}</p></div></div></div>
            <div><Label>Caption</Label><Textarea value={caption} onChange={e => setCaption(e.target.value)} className="resize-none mt-1 text-sm" rows={7} /></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Cancel</Button><Button className="flex-1 rounded-full" onClick={handlePost} disabled={!caption.trim() || posting}>{posting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{isOwner ? 'Promote Now' : 'Share to Feed'}</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AgencyDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agencyId = window.location.pathname.split('/agencies/')[1];

  const [bookingPkg, setBookingPkg] = useState(null);
  const [bookForm, setBookForm] = useState({
    travel_date: '', date_mode: 'scheduled', num_pax: 1,
    pickup_location: '', dropoff_location: '', meetup_location: '',
    notes: '', payment_method: 'gcash', contact_phone: '', use_downpayment: true,
  });
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [newBookingId, setNewBookingId] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [activeTab, setActiveTab] = useState('packages');
  const [formError, setFormError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [sharePkg, setSharePkg] = useState(null);
  const [pkgDetailsView, setPkgDetailsView] = useState(null);

  // Downpayment receipt upload states
  const [dpReceiptFile,      setDpReceiptFile]      = useState(null);
  const [dpReceiptPreview,   setDpReceiptPreview]   = useState(null);
  const [uploadingDpReceipt, setUploadingDpReceipt] = useState(false);
  const [dpReceiptDone,      setDpReceiptDone]      = useState(false);

  // Queries
  const { data: agency, isLoading } = useQuery({
    queryKey: ['agency', agencyId],
    queryFn: async () => { const list = await base44.entities.Agency.filter({ id: agencyId }); return list[0]; },
    enabled: !!agencyId,
  });
  const { data: packages = [] } = useQuery({
    queryKey: ['agency-packages', agencyId],
    queryFn: () => base44.entities.TourPackage.filter({ agency_id: agencyId, status: 'active' }),
    enabled: !!agencyId,
  });
  const { data: agencySubs = [] } = useQuery({
    queryKey: ['agency-sub', agencyId],
    queryFn: () => base44.entities.AgencySubscription.filter({ agency_id: agencyId, status: 'verified' }),
    enabled: !!agencyId,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ['agency-reviews', agencyId],
    queryFn: () => base44.entities.AgencyReview.filter({ agency_id: agencyId }),
    enabled: !!agencyId,
  });
  const packageIds = packages.map(p => p.id);
  const { data: bookingsByPkg = {} } = useQuery({
    queryKey: ['bookings-by-pkg', agencyId, packageIds.join(',')],
    queryFn: async () => {
      if (!packageIds.length) return {};
      const results = await Promise.all(
        packageIds.map(pkgId =>
          base44.entities.Booking.filter({ package_id: pkgId })
            .then(list => ({
              pkgId,
              bookings: Array.isArray(list)
                ? list.filter(b => b.package_id === pkgId && b.status !== 'cancelled')
                : []
            }))
            .catch(() => ({ pkgId, bookings: [] }))
        )
      );
      return Object.fromEntries(results.map(r => [r.pkgId, r.bookings]));
    },
    enabled: !!agencyId && packageIds.length > 0,
  });
  const allAgencyBookings = Object.values(bookingsByPkg).flat();

  // Derived
  const agencyPlan = pickActiveSubscription(agencySubs)?.plan ?? 'free';
  const commissionRate = getCommissionRate(agencyPlan);
  const totalPrice = (bookingPkg?.price || 0) * bookForm.num_pax;
  const downpayment = Math.round(totalPrice * DOWNPAYMENT_RATE);
  const balance = totalPrice - downpayment;
  const platformFee = Math.round(totalPrice * commissionRate / 100);
  const isAgencyOwner = user?.email === agency?.owner_email;
  const galleryPhotos = agency?.gallery_photos?.length ? agency.gallery_photos : agency?.cover_url ? [agency.cover_url] : [];
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const specialtyMountains = [...new Set(packages.map(p => p.mountain_name).filter(Boolean))];
  const today = localToday();
  const futureDates = (bookingPkg?.available_dates || []).filter(d => d >= today).sort();
  const allDatesExpired = (bookingPkg?.available_dates?.length > 0) && futureDates.length === 0;
  const allowCustomDates = bookingPkg?.allow_custom_dates !== false;
  const showDateDropdown = futureDates.length > 0 && bookForm.date_mode === 'scheduled';
  const pickupLocations = asList(bookingPkg?.pickup_locations);
  const dropoffLocations = asList(bookingPkg?.dropoff_locations);
  const otherPickupLocations = asList(bookingPkg?.other_pickup_locations);
  const getBookingsForPkg = (pkgId) => bookingsByPkg[pkgId] || [];
  const isDateFull = (dateStr) => {
    if (!bookingPkg?.max_pax || !dateStr) return false;
    const pkgBookings = getBookingsForPkg(bookingPkg.id);
    const bookedForDate = pkgBookings.filter(
      b => b.travel_date === dateStr && b.status !== 'cancelled'
    ).reduce((sum, b) => sum + (Number(b.num_pax) || 1), 0);
    return bookedForDate >= bookingPkg.max_pax;
  };
  const availableSlotsForDate = (dateStr) => {
    if (!bookingPkg?.max_pax || !dateStr) return null;
    const pkgBookings = getBookingsForPkg(bookingPkg.id);
    const bookedForDate = pkgBookings.filter(
      b => b.travel_date === dateStr && b.status !== 'cancelled'
    ).reduce((sum, b) => sum + (Number(b.num_pax) || 1), 0);
    return Math.max(0, bookingPkg.max_pax - bookedForDate);
  };
  const slotsLeft = availableSlotsForDate(bookForm.travel_date);
  const selectedDateFull = isDateFull(bookForm.travel_date);

  // Actions
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) { await navigator.share({ title: agency?.name, url }); }
    else { await navigator.clipboard.writeText(url); setShareMsg('Link copied!'); setTimeout(() => setShareMsg(''), 2000); }
  };

  // ── Uses shared createBooking helper ──
  const handleBook = async () => {
    setFormError('');
    if (!bookForm.travel_date) { setFormError('Please select a travel date.'); return; }
    if (isDateFull(bookForm.travel_date)) { setFormError('Puno na ang slots para sa date na ito. Pumili ng ibang date.'); return; }
    const slots = availableSlotsForDate(bookForm.travel_date);
    if (slots !== null && bookForm.num_pax > slots) { setFormError(`${slots} slot${slots !== 1 ? 's' : ''} na lang ang natitira.`); return; }
    if (bookingPkg?.max_pax && bookForm.num_pax > bookingPkg.max_pax) { setFormError(`Maximum ${bookingPkg.max_pax} participants allowed.`); return; }

    // Duplicate guard: same user + package + date with an active booking
    try {
      const mine = await base44.entities.Booking.filter({ package_id: bookingPkg.id, user_email: user.email });
      if (mine.some(b => b.travel_date === bookForm.travel_date && !['cancelled', 'refunded'].includes(b.status))) {
        setFormError('May active booking ka na sa package at date na ito.');
        return;
      }
    } catch { /* if the check fails, don't block the booking */ }

    setIsBooking(true);
    try {
      // 1. Create booking using shared helper — consistent fields with TripBookingSection
      const booking = await createBooking({
        pkg: bookingPkg,
        agency,
        user,
        form: bookForm,
        commissionRate,
      });

      setNewBookingId(booking?.id || null);

      // 2. Auto-create group chat
      try {
        await base44.entities.ChatRoom.create({
          name: `${bookingPkg.title} – ${bookForm.travel_date}`,
          type: 'group', is_group: true,
          participants: [user.email, agency.owner_email],
          participant_names: [user.full_name || user.email, agency.name],
          agency_id: agencyId,
          booking_id: booking?.id || undefined,
          package_title: bookingPkg.title,
          created_by: agency.owner_email,
        });
      } catch (chatErr) { console.warn('Group chat auto-create failed:', chatErr); }

      unlockAchievement(user.email, user.full_name, 'first_booking');
      setIsBooking(false);
      setBookingSuccess(true);
    } catch (err) {
      setIsBooking(false);
      setFormError(err.message || 'Booking failed. Try again.');
    }
  };

  // ── DP receipt handlers — uses shared uploadFile ──
  const handleDpReceiptFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    setDpReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setDpReceiptPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmitDpReceipt = async () => {
    if (!dpReceiptFile || !newBookingId) return;
    setUploadingDpReceipt(true);
    try {
      const url = await uploadFile(dpReceiptFile, 'dp-receipts');
      await base44.entities.Booking.update(newBookingId, {
        dp_receipt_url: url,
        dp_receipt_submitted_at: new Date().toISOString(),
      });
      setDpReceiptDone(true);
    } catch (err) { console.error('DP receipt upload failed:', err); }
    finally { setUploadingDpReceipt(false); }
  };

  const handleCloseBooking = () => {
    setBookingPkg(null); setBookingSuccess(false); setFormError(''); setNewBookingId(null);
    setDpReceiptFile(null); setDpReceiptPreview(null); setDpReceiptDone(false);
    setBookForm({ travel_date: '', date_mode: 'scheduled', num_pax: 1, pickup_location: '', dropoff_location: '', meetup_location: '', notes: '', payment_method: 'gcash', contact_phone: '', use_downpayment: true });
  };

  const handleChat = async () => {
    if (!user || !agency || chatLoading) return;
    setChatError('');
    if (!agency.owner_email) { setChatError('This agency has no contact account yet.'); return; }
    if (agency.owner_email.toLowerCase() === (user.email || '').toLowerCase()) { navigate('/chat'); return; }   // your own agency
    setChatLoading(true);
    try {
      // The old lookup filtered on agency_id / initiated_by columns that chat_rooms may not have, so it threw
      // and nothing happened. Look through MY rooms instead and reuse the direct chat with this owner.
      const mine = await fetchMyChatRooms(user.email);
      const owner = agency.owner_email.toLowerCase();
      const existing = mine.find((r) => !r.trip_id && (r.participants || []).length === 2 &&
        (r.participants || []).some((e) => String(e).toLowerCase() === owner));
      if (existing) { navigate(`/chat/${existing.id}`); return; }
      const room = await base44.entities.ChatRoom.create({
        name: agency.name, type: 'direct',
        participants: [user.email, agency.owner_email],
        participant_names: [user.full_name || user.email, agency.name],
        agency_id: agencyId, initiated_by: user.email,
      });
      navigate(`/chat/${room.id}`);
    } catch (err) {
      console.error('Open chat failed:', err);
      setChatError(`Could not open the chat. Please try again.${err?.message ? ` (${String(err.message).slice(0, 120)})` : ''}`);
    } finally {
      setChatLoading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agency) return <div className="text-center py-20"><p>Agency not found</p></div>;

  const trustBadge = TRUST_LEVELS[agencyPlan] || TRUST_LEVELS.verified;
  const tabs = [
    { id: 'packages', label: 'Packages', count: packages.length },
    { id: 'joiners', label: 'Joiners' },
    { id: 'reviews', label: 'Reviews', count: reviews.length },
    { id: 'schedule', label: 'Schedule' },
    { id: 'meetup', label: 'Meetup' },
    { id: 'guides', label: 'Guides', count: (agency.guides || []).length },
    { id: 'photos', label: 'Photos', count: galleryPhotos.length },
    { id: 'trust', label: 'Trust' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" />Back</button>

      {/* Header */}
      <div className="bg-card border rounded-2xl overflow-hidden mb-4">
        <div className="h-44 bg-gradient-to-br from-primary/20 to-primary/5 relative">
          {agency.cover_url && <img src={agency.cover_url} alt="" className="w-full h-full object-cover" />}
          {agency.is_verified && <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg"><BadgeCheck className="w-3.5 h-3.5" />Verified by Melotrip</div>}
        </div>
        <div className="p-5 -mt-8 relative">
          <div className="w-16 h-16 rounded-xl bg-card border-2 border-background shadow-lg flex items-center justify-center overflow-hidden mb-3">{agency.logo_url ? <img src={agency.logo_url} alt={agency.name} className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-primary" />}</div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="w-full sm:flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><h1 className="font-display text-2xl font-bold break-words">{agency.name}</h1><PlanBadge plan={agencyPlan} />{agency.is_verified && <CheckCircle className="w-5 h-5 text-emerald-500 fill-emerald-100 shrink-0" />}</div>
              {agencyPlan !== 'free' && <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 mt-1 ${trustBadge.color}`}><trustBadge.icon className="w-3 h-3" />{trustBadge.label}</span>}
              {agency.location && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2"><MapPin className="w-4 h-4" />{agency.location}</p>}
              <div className="flex items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground flex-wrap">
                {Number(avgRating || agency.rating) > 0 && <span className="flex items-center gap-1 whitespace-nowrap"><Star className="w-4 h-4 text-yellow-500 fill-yellow-400" /><span className="font-medium text-foreground">{avgRating || agency.rating}</span>{reviews.length > 0 && <span className="text-xs">({reviews.length})</span>}</span>}
                <span className="flex items-center gap-1 whitespace-nowrap"><CheckCircle2 className="w-4 h-4 text-primary" />{agency.total_bookings || 0} bookings</span>
                {Number(agency.years_operating) > 0 && <span className="flex items-center gap-1 whitespace-nowrap"><Calendar className="w-4 h-4" />{agency.years_operating}y in business</span>}
                {agency.response_time && <span className="flex items-center gap-1 whitespace-nowrap"><Timer className="w-4 h-4" />Replies in {agency.response_time}</span>}
              </div>
              {specialtyMountains.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{specialtyMountains.map((m, i) => <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5"><Mountain className="w-3 h-3" />{m}</span>)}</div>}
            </div>
            <div className="flex gap-2 flex-wrap items-center sm:shrink-0">
              {isAgencyOwner && <Button variant="default" size="sm" className="rounded-full" onClick={() => navigate('/agency-dashboard')}><LayoutDashboard className="w-4 h-4 mr-2" />Dashboard</Button>}
              {!isAgencyOwner && <>
                <button onClick={() => setSaved(v => !v)} className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${saved ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}</button>
                <button onClick={handleShare} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"><Share2 className="w-4 h-4" />{shareMsg && <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-0.5 rounded whitespace-nowrap">{shareMsg}</span>}</button>
                <button onClick={() => setShowReport(true)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"><Flag className="w-4 h-4" /></button>
                <Button variant="outline" className="rounded-full" onClick={handleChat} disabled={chatLoading}>{chatLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}{chatLoading ? 'Opening...' : 'Chat'}</Button>
                {chatError && <p className="basis-full text-xs text-destructive">{chatError}</p>}
              </>}
            </div>
          </div>
          {agency.description && <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{agency.description}</p>}
          {(agency.website || agency.facebook_url || agency.instagram_url || agency.contact_phone) && (
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
              {agency.website && <a href={agency.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><Globe className="w-3.5 h-3.5" />Website</a>}
              {agency.facebook_url && <a href={agency.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><Facebook className="w-3.5 h-3.5" />Facebook</a>}
              {agency.instagram_url && <a href={agency.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><Instagram className="w-3.5 h-3.5" />Instagram</a>}
              {agency.contact_phone && <a href={`tel:${agency.contact_phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><Phone className="w-3.5 h-3.5" />{agency.contact_phone}</a>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 flex items-center justify-center gap-1 text-sm rounded-lg py-2 px-3 transition-all font-medium whitespace-nowrap ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}{tab.count !== undefined && <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-border text-muted-foreground'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'packages' && (
        packages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <Mountain className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No packages available yet</p>
            {!isAgencyOwner && (
              <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={handleChat}>
                <MessageCircle className="w-4 h-4 mr-2" />Chat Agency
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {packages.map(pkg => {
                const pkgBookings = bookingsByPkg[pkg.id] || [];
                const maxPax = pkg.max_pax;
                const todayStr = localToday();
                const futurePkgDates = (pkg.available_dates || []).filter(d => d >= todayStr).sort();
                const nextDate = futurePkgDates[0] || null;
                const bookedOnNextDate = nextDate ? countBookedPax(pkgBookings, nextDate) : 0;
                const available = maxPax && nextDate ? Math.max(0, maxPax - bookedOnNextDate) : null;
                const isFull = !!(maxPax && nextDate && bookedOnNextDate >= maxPax);
                const fillPct = maxPax && nextDate ? Math.min(Math.round((bookedOnNextDate / maxPax) * 100), 100) : 0;
                const slotLabel = (() => {
                  if (!maxPax || !nextDate) return null;
                  if (isFull) return 'FULL';
                  if (available === 1) return '1 slot left';
                  return `${available} slots left`;
                })();
                const slotBadgeClass = isFull ? 'bg-red-500 text-white' : available !== null && available <= 2 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';
                return (
                  <div key={pkg.id} className={`bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${isFull ? 'opacity-80' : ''}`} onClick={() => setPkgDetailsView(pkg)}>
                    <div className="aspect-video relative">
                      <img src={pkg.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'} alt="" className="w-full h-full object-cover" />
                      {slotLabel && (
                        <div className={`absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shadow ${slotBadgeClass}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />{slotLabel}
                        </div>
                      )}
                      {pkg.promo_text && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pkg.promo_text}</div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold">{pkg.title}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Mountain className="w-3.5 h-3.5" />{pkg.mountain_name}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {pkg.duration_days && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{pkg.duration_days} days</span>}
                        {maxPax && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />Max {maxPax} per date</span>}
                      </div>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{pkg.description}</p>
                      )}
                      {pkg.includes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pkg.includes.slice(0, 3).map((inc, i) => <Badge key={i} variant="outline" className="text-[10px]">{inc}</Badge>)}
                          {pkg.includes.length > 3 && <Badge variant="outline" className="text-[10px]">+{pkg.includes.length - 3}</Badge>}
                        </div>
                      )}
                      {nextDate && (
                        <p className="text-xs text-green-600 font-medium mt-2">Next date: {new Date(nextDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      )}
                      {pkg.nature_spots?.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <p className="font-medium text-foreground">Spots:</p>
                          <p className="line-clamp-1">{pkg.nature_spots.slice(0, 2).join(' • ')}{pkg.nature_spots.length > 2 ? ' +' + (pkg.nature_spots.length - 2) : ''}</p>
                        </div>
                      )}
                      {maxPax && nextDate && (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{bookedOnNextDate}/{maxPax} booked{nextDate && <span className="ml-1 text-muted-foreground/70">on {new Date(nextDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>}</span>
                            <span>{fillPct}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isFull ? 'bg-red-500' : fillPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${fillPct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-xl font-bold text-primary">P{pkg.price?.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">per person</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSharePkg(pkg)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                            {isAgencyOwner ? <Megaphone className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                          </button>
                          <Button className="rounded-full" onClick={() => { if (!isFull) setBookingPkg(pkg); }} disabled={isFull} variant={isFull ? 'outline' : 'default'}>
                            {isFull ? 'Full' : 'Book Now'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {activeTab === 'joiners' && (
        <JoinerSlotsTab agencyId={agencyId} packages={packages} user={user} isAgencyOwner={isAgencyOwner} onBook={(slot) => {
          const matchedPkg = packages.find(p => p.id === slot.package_id) || { id: slot.package_id, title: slot.package_title, price: slot.joiner_price, max_pax: slot.max_joiners, available_dates: slot.travel_date ? [slot.travel_date] : [], allow_custom_dates: false };
          setBookingPkg(matchedPkg);
          setBookForm(f => ({ ...f, travel_date: slot.travel_date || '', date_mode: 'scheduled', pickup_location: slot.pickup_location || '', num_pax: 1 }));
        }} />
      )}

      {activeTab === 'reviews'  && <ReviewsTab agencyId={agencyId} user={user} />}
      {activeTab === 'schedule' && <ScheduleTab packages={packages} bookingsByPkg={bookingsByPkg} />}
      {activeTab === 'meetup'   && <MeetupTab agency={agency} isAgencyOwner={isAgencyOwner} allAgencyBookings={allAgencyBookings} />}
      {activeTab === 'guides'   && <GuidesTab agency={agency} isAgencyOwner={isAgencyOwner} />}
      {activeTab === 'photos'   && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1"><Camera className="w-5 h-5 text-muted-foreground" /><div><p className="text-sm font-medium">Agency Background Photos</p><p className="text-xs text-muted-foreground">Proof photos submitted by the agency</p></div></div>
          <AgencyGallery photos={galleryPhotos} />
        </div>
      )}
      {activeTab === 'trust' && (
        <div className="space-y-4">
          <TrustPanel agency={agency} agencyPlan={agencyPlan} />
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Info className="w-4 h-4 text-primary" />How to stay safe when booking</p>
            {[
              { tip: 'Always chat the agency first', desc: 'Ask questions and gauge their professionalism before booking.' },
              { tip: 'Check background photos', desc: 'Legit agencies upload trip photos, permits, and team photos.' },
              { tip: 'Look for verified badge', desc: 'Agencies verified by Melotrip have submitted identity documents.' },
              { tip: 'Book through the platform', desc: "Never pay outside the app. All bookings are logged and protected." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                <div><p className="font-medium">{item.tip}</p><p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PACKAGE DETAILS MODAL ── */}
      <Dialog open={!!pkgDetailsView} onOpenChange={() => setPkgDetailsView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{pkgDetailsView?.title}</DialogTitle></DialogHeader>
          {pkgDetailsView && (
            <div className="space-y-4">
              <img src={pkgDetailsView.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800'} alt="" className="w-full h-64 object-cover rounded-xl" />
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded-lg p-2"><p className="text-muted-foreground text-xs">Destination</p><p className="font-semibold">{pkgDetailsView.mountain_name}</p></div>
                <div className="bg-muted/50 rounded-lg p-2"><p className="text-muted-foreground text-xs">Duration</p><p className="font-semibold">{pkgDetailsView.duration_days || '1'} day{pkgDetailsView.duration_days > 1 ? 's' : ''}</p></div>
                <div className="bg-muted/50 rounded-lg p-2"><p className="text-muted-foreground text-xs">Max Participants</p><p className="font-semibold">{pkgDetailsView.max_pax || 'Unlimited'} per date</p></div>
                <div className="bg-muted/50 rounded-lg p-2"><p className="text-muted-foreground text-xs">Price</p><p className="font-semibold text-lg text-primary">P{pkgDetailsView.price?.toLocaleString()}</p></div>
              </div>

              {pkgDetailsView.description && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pkgDetailsView.description}</p>
                </div>
              )}

              {pkgDetailsView.includes?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">What's Included</p>
                  <div className="flex flex-wrap gap-1">
                    {pkgDetailsView.includes.map((inc, i) => <Badge key={i} variant="outline">{inc}</Badge>)}
                  </div>
                </div>
              )}

              {pkgDetailsView.nature_spots?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Nature Spots / Itinerary</p>
                  <ul className="space-y-1">
                    {pkgDetailsView.nature_spots.map((spot, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                        <span>{spot}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pkgDetailsView.available_dates?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Available Dates</p>
                  <p className="text-sm text-muted-foreground">{pkgDetailsView.available_dates.slice(0, 5).map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })).join(', ')}{pkgDetailsView.available_dates.length > 5 ? '...' : ''}</p>
                </div>
              )}

              {pkgDetailsView.pickup_locations?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Pickup Locations</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {pkgDetailsView.pickup_locations.slice(0, 3).map((loc, i) => <li key={i}>• {loc}</li>)}
                    {pkgDetailsView.pickup_locations.length > 3 && <li>• +{pkgDetailsView.pickup_locations.length - 3} more</li>}
                  </ul>
                </div>
              )}

              {pkgDetailsView.package_photos?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {pkgDetailsView.package_photos.map((photo, i) => (
                      <img key={i} src={photo} alt="" className="w-full h-24 object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={() => { setPkgDetailsView(null); setBookingPkg(pkgDetailsView); }}>Book Now</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── BOOKING DIALOG ── */}
      <Dialog open={!!bookingPkg} onOpenChange={handleCloseBooking}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{bookingSuccess ? 'Booking Submitted!' : `Book: ${bookingPkg?.title}`}</DialogTitle></DialogHeader>
          {bookingSuccess ? (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-primary" /></div>
                <div><p className="font-semibold text-lg">Booking Received!</p><p className="text-sm text-muted-foreground mt-1">Naipadala na ang iyong request sa <span className="font-medium text-foreground">{agency?.name}</span>. Mag-aabiso sila nang malapit.</p></div>
                <div className="bg-muted rounded-xl p-4 text-left space-y-1.5 text-sm">
                  <p><span className="text-muted-foreground">Package:</span> <span className="font-medium">{bookingPkg?.title}</span></p>
                  <p><span className="text-muted-foreground">Travel Date:</span> <span className="font-medium">{bookForm.travel_date}</span></p>
                  <p><span className="text-muted-foreground">Pax:</span> <span className="font-medium">{bookForm.num_pax}</span></p>
                  {bookForm.pickup_location && <p><span className="text-muted-foreground">Pickup:</span> <span className="font-medium">{bookForm.pickup_location}</span></p>}
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />Payment Summary</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">Downpayment now (30%)</span><span className="font-bold text-emerald-700">P{downpayment.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">Balance on meetup</span><span className="font-semibold text-amber-700">P{balance.toLocaleString()}</span></div>
                    <div className="border-t border-emerald-200 pt-1 flex justify-between"><span className="text-muted-foreground text-xs">Total</span><span className="font-bold">P{totalPrice.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              {/* Downpayment receipt upload */}
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-primary flex items-center gap-2"><Receipt className="w-4 h-4" />I-upload ang Downpayment Receipt</p>
                <p className="text-xs text-muted-foreground">Para ma-confirm ng agency ang iyong booking, i-send muna ang downpayment ({bookForm.payment_method}) tapos i-upload ang screenshot dito.</p>
                {dpReceiptDone ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-800"><CheckCircle className="w-4 h-4 shrink-0" /><span className="font-medium">Receipt submitted! Agency will confirm your booking shortly.</span></div>
                ) : dpReceiptPreview ? (
                  <div className="relative rounded-xl overflow-hidden border">
                    <img src={dpReceiptPreview} alt="DP receipt" className="w-full object-contain max-h-48" />
                    <button onClick={() => { setDpReceiptFile(null); setDpReceiptPreview(null); }} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div><p className="text-xs text-muted-foreground">I-click para mag-upload ng screenshot</p><p className="text-[10px] text-muted-foreground">JPG, PNG — max 5MB</p></div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleDpReceiptFileChange} />
                  </label>
                )}
                {dpReceiptFile && !dpReceiptDone && (
                  <Button className="w-full rounded-full" onClick={handleSubmitDpReceipt} disabled={uploadingDpReceipt}>
                    {uploadingDpReceipt ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Submit Receipt</>}
                  </Button>
                )}
              </div>

              {!isAgencyOwner && <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>I-monitor ang status ng booking mo sa iyong <strong>Profile → Bookings</strong> tab. Isang group chat ang awtomatikong nagawa para sa iyong booking.</span></div>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={handleCloseBooking}>Close</Button>
                <Button className="flex-1 rounded-full" onClick={() => { handleCloseBooking(); navigate('/profile'); }}>Track Booking</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-primary">{user?.full_name?.[0] || '?'}</span></div>
                <div><p className="text-sm font-medium">{user?.full_name}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>
              </div>

              <div>
                <Label>Travel Date <span className="text-destructive">*</span></Label>
                {showDateDropdown ? (
                  <div className="space-y-1 mt-1">
                    <Select value={bookForm.travel_date} onValueChange={v => setBookForm(p => ({ ...p, travel_date: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select an available date" /></SelectTrigger>
                      <SelectContent>
                        {futureDates.map(d => {
                          const slots = availableSlotsForDate(d);
                          const full = isDateFull(d);
                          return (
                            <SelectItem key={d} value={d} disabled={full}>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${full ? 'bg-red-500' : slots !== null && slots <= 2 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                <span>{new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                {Number(bookingPkg?.max_pax) > 0 && <span className={`text-[10px] font-semibold ml-auto ${full ? 'text-red-600' : slots <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>{full ? 'FULL' : `${slots} left`}</span>}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {bookForm.travel_date && slotsLeft !== null && (
                      <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${selectedDateFull ? 'bg-red-50 text-red-700' : slotsLeft <= 2 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedDateFull ? 'bg-red-500' : slotsLeft <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {selectedDateFull ? 'Puno na ang date na ito!' : `${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} na lang ang natitira`}
                      </div>
                    )}
                    {allowCustomDates && <button onClick={() => setBookForm(p => ({ ...p, date_mode: 'custom', travel_date: '' }))} className="text-xs text-primary hover:underline">Request a custom date instead →</button>}
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    <Input type="date" min={today} value={bookForm.travel_date} onChange={e => setBookForm(p => ({ ...p, travel_date: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">{allDatesExpired ? 'All scheduled dates have passed — choose your preferred date.' : 'No fixed dates — choose your preferred date.'}</p>
                    {bookForm.travel_date && bookingPkg?.max_pax && (() => {
                      const slots = availableSlotsForDate(bookForm.travel_date);
                      const full = isDateFull(bookForm.travel_date);
                      const booked = (bookingPkg.max_pax || 0) - (slots || 0);
                      const fillPct = Math.min(Math.round((booked / bookingPkg.max_pax) * 100), 100);
                      return (
                        <div className={`rounded-xl border p-3 space-y-2 ${full ? 'bg-red-50 border-red-200' : slots <= 2 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold flex items-center gap-1.5 ${full ? 'text-red-700' : slots <= 2 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              <span className={`w-2 h-2 rounded-full ${full ? 'bg-red-500' : slots <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              {full ? 'Puno na ang date na ito!' : `${slots} slot${slots !== 1 ? 's' : ''} pa available`}
                            </span>
                            <span className={`text-[10px] ${full ? 'text-red-600' : 'text-muted-foreground'}`}>{booked}/{bookingPkg.max_pax} booked</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/60 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : fillPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${fillPct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    {futureDates.length > 0 && (
                      <button onClick={() => setBookForm(p => ({ ...p, date_mode: 'scheduled', travel_date: '' }))} className="text-xs text-primary hover:underline">← Back to scheduled dates</button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Number of Participants</Label>
                <Input type="number" min={1} max={bookingPkg?.max_pax || 99} value={bookForm.num_pax} onChange={e => setBookForm(p => ({ ...p, num_pax: Math.max(1, Math.min(Number(e.target.value), bookingPkg?.max_pax || 99)) }))} />
                {Number(bookingPkg?.max_pax) > 0 && <p className="text-xs text-muted-foreground mt-1">Max {bookingPkg.max_pax} participants</p>}
              </div>

              {pickupLocations.length > 0 && (
                <div>
                  <Label>Pickup / Meetup Location</Label>
                  <Select value={bookForm.pickup_location} onValueChange={v => setBookForm(p => ({ ...p, pickup_location: v, meetup_location: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select pickup point" /></SelectTrigger>
                    <SelectContent>{pickupLocations.map((loc, i) => <SelectItem key={i} value={loc}>{loc}</SelectItem>)}</SelectContent>
                  </Select>
                  {otherPickupLocations.length > 0 && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />Other pickup options (with additional fee)</p>
                      <div className="space-y-1">{otherPickupLocations.map((loc, i) => <div key={i} className="flex items-center gap-2"><MapPin className="w-3 h-3 text-amber-600 shrink-0" /><span className="text-xs text-amber-900">{loc}</span></div>)}</div>
                      <p className="text-[11px] text-amber-700 pt-1 border-t border-amber-200">Mention in notes or chat agency directly to arrange the extra fee.</p>
                    </div>
                  )}
                </div>
              )}

              {dropoffLocations.length > 0 && (
                <div>
                  <Label>Drop-off Location</Label>
                  <Select value={bookForm.dropoff_location} onValueChange={v => setBookForm(p => ({ ...p, dropoff_location: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select drop-off point" /></SelectTrigger>
                    <SelectContent>{dropoffLocations.map((loc, i) => <SelectItem key={i} value={loc}>{loc}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

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

              {/* Show GCash Account if GCash is selected and agency has GCash details */}
              {bookForm.payment_method === 'gcash' && agency?.gcash_number && (
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl p-4">
                  <p className="text-xs font-medium opacity-80 mb-1">I-send ang payment sa</p>
                  <p className="text-2xl font-bold tracking-widest">{agency.gcash_number}</p>
                  <p className="text-sm opacity-90 mt-0.5">{agency.gcash_name}</p>
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <p className="text-xs opacity-80">Downpayment Amount</p>
                    <p className="text-xl font-bold">₱{downpayment.toLocaleString()}</p>
                  </div>
                </div>
              )}
              {bookForm.payment_method === 'gcash' && !agency?.gcash_number && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold">GCash details hindi available</p>
                    <p className="text-xs mt-1">Chat ang agency para malaman kung saan mag-send ng payment.</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Contact Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="+63 9XX XXX XXXX" value={bookForm.contact_phone} onChange={e => setBookForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
              </div>

              <div>
                <Label>Special Requests <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea placeholder="Dietary needs, accessibility requirements, custom pickup, etc." value={bookForm.notes} onChange={e => setBookForm(p => ({ ...p, notes: e.target.value }))} className="resize-none" rows={3} />
              </div>

              <div className="bg-muted rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-muted-foreground">Total Package Price</p><p className="text-2xl font-bold text-primary">P{totalPrice.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">P{bookingPkg?.price?.toLocaleString()} x {bookForm.num_pax} pax</p></div>
                  <Badge variant="outline" className="mt-1">{bookForm.payment_method}</Badge>
                </div>
                {totalPrice > 0 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs font-semibold">Payment Schedule</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">Downpayment now (30%)</span></div><span className="text-sm font-bold text-emerald-700">P{downpayment.toLocaleString()}</span></div>
                      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-muted-foreground">Balance on meetup day</span></div><span className="text-sm font-semibold text-amber-700">P{balance.toLocaleString()}</span></div>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-[11px] text-blue-800">Downpayment lang ang babayaran muna. Ang natitira (P{balance.toLocaleString()}) ay sa meetup na ibabayad.</div>
                  </div>
                )}
              </div>

              {formError && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{formError}</div>}
              {!bookForm.travel_date && <p className="text-xs text-muted-foreground text-center">Select a travel date to continue</p>}

              <Button className="w-full rounded-full" onClick={handleBook} disabled={isBooking || !bookForm.travel_date || selectedDateFull}>
                {isBooking && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {selectedDateFull ? 'Date is Full' : `Confirm Booking (P${downpayment.toLocaleString()} downpayment)`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {sharePkg && user && <SharePackageDialog pkg={sharePkg} agency={agency} user={user} isOwner={isAgencyOwner} onClose={() => setSharePkg(null)} />}
      {showReport && user && <ReportModal agency={agency} user={user} onClose={() => setShowReport(false)} />}
    </div>
  );
}