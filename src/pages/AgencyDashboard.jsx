import ImageField from '@/components/ImageField';
import GcashModeFields from '@/components/payments/GcashModeFields';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Store, Package, CalendarDays, MessageCircle, BookOpen, Plus, Loader2,
  Trash2, CheckCircle, XCircle, AlertCircle, Mountain, Users,
  CreditCard, Edit, PenSquare, TrendingUp, ImagePlus, Megaphone,
  Heart, Star, X, Lock, Camera, ClipboardCheck,
  Upload, Clock, Receipt, Info, Search, UserPlus, UsersRound,
  Image, Flag, Globe, Facebook, Instagram, Phone, MapPin, Sparkles,
  Wallet, FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import FinancialSummary from '@/components/agency/FinancialSummary';
import { uploadFile } from '@/lib/uploadFile';
import { fetchMyChatRooms, findExistingGroupChat, fetchProfileNamesForEmails } from '@/lib/chatHelpers';
import { uploadAgencyDocument } from '@/lib/agencyDocuments';
import { ADMIN_GCASH_NUMBER, ADMIN_GCASH_NAME } from '@/lib/config';
import { isCommissionConfirmed } from '@/lib/commission';
import { PLAN_COMMISSION, pickActiveSubscription, isSubscriptionExpired, daysUntil, planRank } from '@/lib/plans';
import AgencyAnalytics from '@/components/agencies/AgencyAnalytics';
import SharePackageDialog from '@/components/agencies/SharePackageDialog';


const PLAN_CONFIG = {
  free:    { maxPackages: 3,        commission: PLAN_COMMISSION.free, label: 'Free',    color: 'bg-gray-100 text-gray-700' },
  starter: { maxPackages: 5,        commission: PLAN_COMMISSION.starter, label: 'Starter', color: 'bg-blue-100 text-blue-700' },
  weekly:  { maxPackages: 5,        commission: PLAN_COMMISSION.weekly,  label: 'Starter', color: 'bg-blue-100 text-blue-700' },
  pro:     { maxPackages: Infinity, commission: PLAN_COMMISSION.pro, label: 'Pro',     color: 'bg-primary/10 text-primary' },
  yearly:  { maxPackages: Infinity, commission: PLAN_COMMISSION.yearly, label: 'Yearly',  color: 'bg-purple-100 text-purple-700' },
};
const getPlanConfig = (p) => PLAN_CONFIG[p] ?? PLAN_CONFIG[p?.toLowerCase()] ?? PLAN_CONFIG.free;
const PAID_PLANS = new Set(['starter', 'weekly', 'pro', 'yearly']);

const bookingStatusColors = {
  pending:              'bg-yellow-100 text-yellow-800',
  confirmed:            'bg-blue-100 text-blue-800',
  paid:                 'bg-green-100 text-green-800',
  completed:            'bg-primary/10 text-primary',
  commission_sent:      'bg-orange-100 text-orange-800',
  commission_confirmed: 'bg-green-100 text-green-800',
  cancelled:            'bg-red-100 text-red-800',
};

const PROMO_TYPES = [
  { key: 'agency_promo',   label: '📢 General Promo',  desc: 'Announce promos, discounts, deals' },
  { key: 'tour_highlight', label: '🏔️ Tour Highlight', desc: 'Showcase a specific tour package' },
  { key: 'travel_tip',     label: '💡 Travel Tip',     desc: 'Share travel tips and advice' },
  { key: 'photo_feature',  label: '📸 Photo Feature',  desc: 'Share beautiful destination photos' },
  { key: 'agency_update',  label: '📣 Agency Update',  desc: 'News about your agency' },
];

const PROMO_TYPE_COLORS = {
  agency_promo:   'bg-orange-100 text-orange-700',
  tour_highlight: 'bg-green-100 text-green-700',
  travel_tip:     'bg-blue-100 text-blue-700',
  photo_feature:  'bg-purple-100 text-purple-700',
  agency_update:  'bg-yellow-100 text-yellow-700',
};

const BANNER_TYPES = [
  { key: 'promo',    label: '🏷️ Promo Banner',   desc: 'Discount or sale announcement' },
  { key: 'event',    label: '📅 Event Banner',    desc: 'Upcoming trip or event' },
  { key: 'seasonal', label: '🌿 Seasonal Banner', desc: 'Season-specific campaign' },
  { key: 'alert',    label: '📌 Announcement',    desc: 'Important agency notice' },
];

const BANNER_COLORS = {
  promo:    { bg: 'from-orange-500 to-red-500',   badge: 'bg-orange-100 text-orange-700' },
  event:    { bg: 'from-blue-500 to-indigo-600',  badge: 'bg-blue-100 text-blue-700' },
  seasonal: { bg: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-100 text-emerald-700' },
  alert:    { bg: 'from-yellow-400 to-amber-500', badge: 'bg-yellow-100 text-yellow-700' },
};

// ─────────────────────────────────────────────────────────────
// Group Chat Dialog
// ─────────────────────────────────────────────────────────────
function GroupChatDialog({ open, onClose, booking, agency, user, navigate }) {
  const qc = useQueryClient();
  const [groupName,     setGroupName]     = useState('');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [invited,       setInvited]       = useState([]);
  const [creating,      setCreating]      = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (booking) {
      setGroupName(`${booking.package_title} – ${booking.travel_date || 'Group'}`);
      setInvited([{ email: booking.user_email, name: booking.user_name || 'Hiker' }]);
    }
  }, [booking]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setError('');
    try {
      const { data: byName, error: searchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .ilike('full_name', `%${searchQuery.trim()}%`)
        .limit(20);
      if (searchError) throw searchError;
      setSearchResults((byName || []).filter(u =>
        u.full_name && u.email !== user.email && !invited.find(i => i.email === u.email)
      ));
    } catch { setError('Search failed. Try again.'); }
    finally { setSearching(false); }
  };

  const addMember = (u) => {
    if (invited.find(i => i.email === u.email)) return;
    setInvited(p => [...p, { email: u.email, name: u.full_name || 'Hiker' }]);
    setSearchResults(p => p.filter(r => r.email !== u.email));
  };
  const removeMember = (email) => {
    if (booking && email === booking.user_email) return;
    setInvited(p => p.filter(i => i.email !== email));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { setError('Group name is required.'); return; }
    if (invited.length === 0) { setError('Add at least one member.'); return; }
    setCreating(true); setError('');
    try {
      const participants = [...new Set([user.email, ...invited.map(i => i.email)])];
      const existingRooms = await fetchMyChatRooms(user.email);
      const existingRoom = findExistingGroupChat(existingRooms, {
        name: groupName,
        participants,
        bookingId: booking?.id,
      });
      if (existingRoom) {
        qc.invalidateQueries({ queryKey: ['agency-chats'] });
        onClose();
        navigate(`/chat/${existingRoom.id}`);
        return;
      }

      const room = await base44.entities.ChatRoom.create({
        name: groupName.trim(), type: 'group',
        participants,
        participant_names: [agency.name, ...invited.map(i => i.name)],
        agency_id: agency.id, booking_id: booking?.id || undefined,
        package_title: booking?.package_title || undefined,
        created_by: user.email, is_group: true,
      });
      qc.invalidateQueries({ queryKey: ['agency-chats'] });
      onClose();
      navigate(`/chat/${room.id}`);
    } catch (err) { setError(err.message || 'Could not create group chat.'); }
    finally { setCreating(false); }
  };

  const handleClose = () => {
    setGroupName(''); setSearchQuery(''); setSearchResults([]);
    setInvited(booking ? [{ email: booking.user_email, name: booking.user_name || 'Hiker' }] : []);
    setError(''); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!creating && !v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UsersRound className="w-4 h-4 text-primary" /> Create Group Chat</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Group Name *</Label><Input className="mt-1" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Mt. Pulag Trip June 2025" /></div>
          {booking && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
              <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="text-xs"><span className="font-medium text-primary">{booking.package_title}</span>{booking.travel_date && <span className="text-muted-foreground"> · {booking.travel_date}</span>}</div>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Members ({invited.length + 1})</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{agency?.name?.[0]}</span></div>
                <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{agency?.name}</p><p className="text-[10px] text-muted-foreground">You (admin)</p></div>
              </div>
              {invited.map(m => (
                <div key={m.email} className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-green-700">{(m.name || 'Hiker')[0].toUpperCase()}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{m.name}</p></div>
                  {booking && m.email === booking.user_email ? <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">booker</Badge> : <button onClick={() => removeMember(m.email)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Invite More Participants</Label>
            <div className="flex gap-2">
              <Input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="flex-1 text-sm" />
              <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="rounded-xl shrink-0">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-xl divide-y overflow-hidden">
                {searchResults.map(u => (
                  <div key={u.email} className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-blue-700">{u.full_name[0].toUpperCase()}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{u.full_name}</p></div>
                    <button onClick={() => addMember(u)} className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1 hover:bg-primary/5 transition-colors shrink-0"><UserPlus className="w-3 h-3" /> Add</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full" onClick={handleClose} disabled={creating}>Cancel</Button>
            <Button className="flex-1 rounded-full" onClick={handleCreate} disabled={creating || !groupName.trim() || invited.length === 0}>
              {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : <><UsersRound className="w-4 h-4 mr-2" />Create Group</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <div className="text-center py-10"><Icon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{msg}</p></div>
  );
}

export default function AgencyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [pkgDialog,  setPkgDialog]  = useState(false);
  const [editPkg,    setEditPkg]    = useState(null);
  const [sharePackage, setSharePackage] = useState(null);
  const [tripDialog, setTripDialog] = useState(false);
  const [postDialog, setPostDialog] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState('');
  const [uploadingPromo, setUploadingPromo] = useState(false);

  const [editProfileDialog,   setEditProfileDialog]   = useState(false);
  const [profileForm,         setProfileForm]         = useState({ logo_url: '', cover_url: '', gallery_photos: [], description: '', location: '', contact_phone: '', contact_email: '', gcash_qr_url: '', gcash_display: '', website: '', facebook_url: '', instagram_url: '', years_operating: '', gcash_number: '', gcash_name: '', business_reg_document_path: '', permit_document_path: '' });
  const [uploadingProfileImg, setUploadingProfileImg] = useState(null);
  const [profileTab,          setProfileTab]          = useState('images');

  const [completionDialog,  setCompletionDialog]  = useState(false);
  const [completionBooking, setCompletionBooking] = useState(null);
  const [completionForm,    setCompletionForm]    = useState({ actual_pax: '', proof_url: '', notes: '' });
  const [uploadingProof,    setUploadingProof]    = useState(false);

  const [receiptDialog,    setReceiptDialog]    = useState(false);
  const [receiptBooking,   setReceiptBooking]   = useState(null);
  const [receiptFile,      setReceiptFile]      = useState(null);
  const [receiptPreview,   setReceiptPreview]   = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [groupChatDialog,  setGroupChatDialog]  = useState(false);
  const [groupChatBooking, setGroupChatBooking] = useState(null);

  const [bannerDialog,   setBannerDialog]   = useState(false);
  const [bannerForm,     setBannerForm]     = useState({ title: '', subtitle: '', cta_text: '', banner_type: 'promo', image_url: '', link_url: '', is_active: true });
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [banners,         setBanners]         = useState([]);
  const [loadingBanners,  setLoadingBanners]  = useState(false);

  const emptyPkgForm = { title: '', description: '', mountain_name: '', price: '', currency: 'PHP', duration_days: '', max_pax: '', includes: '', image_url: '', available_dates: '', nature_spots: '', open_for: '', promo_text: '', pickup_locations: '', dropoff_locations: '', other_pickup_locations: '', allow_custom_dates: true, package_photos: [] };
  const [pkgForm,  setPkgForm]  = useState(emptyPkgForm);
  const [uploadingPkgPhoto, setUploadingPkgPhoto] = useState(false);
  const [tripForm, setTripForm] = useState({ title: '', description: '', mountain_name: '', start_date: '', end_date: '', max_participants: 10, budget_estimate: '', is_public: true });
  const [postForm, setPostForm] = useState({ content: '', post_type: 'agency_promo', image_url: null, media_type: null });

  // Queries
  const { data: agencies = [], isLoading: loadingAgency } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn:  () => base44.entities.Agency.filter({ owner_email: user?.email }),
    enabled:  !!user?.email,
  });
  const agency = agencies[0];

  const { data: subs = [] } = useQuery({
    queryKey: ['my-subs', agency?.id],
    queryFn:  () => base44.entities.AgencySubscription.filter({ agency_id: agency.id, status: 'verified' }),
    enabled:  !!agency?.id,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['agency-packages', agency?.id],
    queryFn:  () => base44.entities.TourPackage.filter({ agency_id: agency.id }),
    enabled:  !!agency?.id,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['agency-bookings', agency?.id],
    queryFn:  () => base44.entities.Booking.filter({ agency_id: agency.id }, '-created_date', 1000),
    enabled:  !!agency?.id,
    refetchInterval: 30_000,
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['agency-trips', agency?.id],
    queryFn: async () => {
      const [byAgency, byOrganizer] = await Promise.all([
        // trips has no agency_id column (it has agency_name) and no created_at (it has created_date);
        // the old filters always failed and the error was swallowed, so this list was always empty
        base44.entities.Trip.filter({ agency_name: agency.name }, '-created_date').catch(() => []),
        base44.entities.Trip.filter({ organizer_id: user.id }, '-created_date').catch(() => []),
      ]);
      return [...new Map([...byAgency, ...byOrganizer].map(t => [t.id, t])).values()]
        .filter(t => t.agency_id === agency.id || t.agency_name === agency.name || t.organizer_id === user.id);
    },
    enabled: !!agency?.id && !!user?.id,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['agency-posts', user?.email],
    queryFn:  () => base44.entities.Post.filter({ author_id: user.id, status: 'active' }, '-created_date'),
    enabled:  !!user?.id,
  });

  const { data: chatRooms = [] } = useQuery({
    queryKey: ['agency-chats', user?.email],
    queryFn: async () => {
      const rooms = await fetchMyChatRooms(user.email);
      const missingNames = rooms.flatMap(room =>
        (room.participants || []).filter((email, index) =>
          !room.participant_names?.[index] ||
          room.participant_names[index].toLowerCase() === email.toLowerCase()
        )
      );
      const profileNames = await fetchProfileNamesForEmails(missingNames);
      return rooms.map(room => ({
        ...room,
        participant_names: (room.participants || []).map((email, index) => {
          const existingName = room.participant_names?.[index];
          return profileNames[email] ||
            (existingName && existingName.toLowerCase() !== email.toLowerCase() ? existingName : 'Hiker');
        }),
      }));
    },
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (!agency?.id) return;
    setLoadingBanners(true);
    base44.entities.AgencyBanner
      ?.filter({ agency_id: agency.id }, '-created_date')
      .then(res => setBanners(res || []))
      .catch(() => setBanners([]))
      .finally(() => setLoadingBanners(false));
  }, [agency?.id]);

  // Derived
  const activeSub      = pickActiveSubscription(subs);
  const currentPlan    = activeSub?.plan ?? 'free';
  const planConfig     = getPlanConfig(currentPlan);
  const maxPackages    = planConfig.maxPackages;
  const commissionRate = planConfig.commission;
  const paidExpired    = subs.find(s => s.status === 'verified' && s.plan !== 'free' && isSubscriptionExpired(s));
  const daysToEnd      = activeSub && activeSub.plan !== 'free' && activeSub.end_date ? daysUntil(activeSub.end_date) : null;
  const expiryNotice   = (paidExpired && (!activeSub || activeSub.plan === 'free'))
    ? `Your ${paidExpired.plan} plan expired on ${paidExpired.end_date}. You are on the Free plan (${PLAN_CONFIG.free.commission}% commission, max ${PLAN_CONFIG.free.maxPackages} packages).`
    : (daysToEnd != null && daysToEnd <= 30 ? `Your ${activeSub.plan} plan ends on ${activeSub.end_date} (${Math.max(0, daysToEnd)} day(s) left).` : '');
  const atPackageLimit = packages.length >= maxPackages;
  const isPaidPlan     = PAID_PLANS.has(currentPlan?.toLowerCase());

  const completedBookings     = bookings.filter(b => ['completed','commission_sent','commission_confirmed'].includes(b.status));
  const bookingTotal          = (b) => Number(b.actual_total_price ?? b.total_price) || 0;
  const totalRevenue          = completedBookings.reduce((s, b) => s + bookingTotal(b), 0);
  // Use each booking's STORED fee/rate; the old code re-applied today's plan rate to all history.
  const totalCommission       = completedBookings.reduce((s, b) => s + (b.platform_fee ?? Math.round(bookingTotal(b) * (b.commission_rate ?? commissionRate) / 100)), 0);
  const netRevenue            = totalRevenue - totalCommission;
  const pendingReceiptCount   = bookings.filter(b => b.status === 'completed' && !isCommissionConfirmed(b)).length;
  const pendingDpReceiptCount = bookings.filter(b => b.status === 'pending' && b.dp_receipt_url).length;

  // ── All upload calls now use shared uploadFile from @/lib/uploadFile ──

  const handleProfileImageUpload = async (file, type) => {
    setUploadingProfileImg(type); setSaveError('');
    try {
      const url = await uploadFile(file);
      if (type === 'gallery') setProfileForm(p => ({ ...p, gallery_photos: [...(p.gallery_photos || []), url] }));
      else setProfileForm(p => ({ ...p, [`${type}_url`]: url }));
    } catch (err) { setSaveError('Upload failed: ' + err.message); }
    finally { setUploadingProfileImg(null); }
  };

  const handleAgencyDocumentUpload = async (file, field) => {
    if (!file) return;
    setUploadingProfileImg(field);
    setSaveError('');
    try {
      const path = await uploadAgencyDocument(file, user.id, agency.id);
      setProfileForm(current => ({ ...current, [field]: path }));
    } catch (err) {
      setSaveError(err.message || 'Agency document upload failed.');
    } finally {
      setUploadingProfileImg(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true); setSaveError('');
    try {
      const bizEmail = String(profileForm.contact_email || '').trim();
      if (bizEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bizEmail)) {
        setSaveError('Enter a valid business email (e.g. info@agency.com).'); setSaving(false); return;
      }
      const updates = {};
      const fields = ['logo_url','cover_url','gallery_photos','description','location','contact_phone','website','facebook_url','instagram_url','years_operating','gcash_number','gcash_name','gcash_qr_url','gcash_display','contact_email','business_reg_document_path','permit_document_path'];
      // An emptied box now clears the saved value (before, it was skipped and the old text came back)
      const numeric = new Set(['years_operating']);
      fields.forEach(f => {
        if (profileForm[f] === undefined) return;
        if (profileForm[f] === '') updates[f] = null;
        else updates[f] = numeric.has(f) ? Number(profileForm[f]) : profileForm[f];
      });
      
      try {
        const updatedAgency = await base44.entities.Agency.update(agency.id, updates);
        for (const field of ['business_reg_document_path', 'permit_document_path']) {
          if (updates[field] !== undefined && !Object.prototype.hasOwnProperty.call(updatedAgency || {}, field)) {
            throw new Error('Agency document storage is not configured. Ask an administrator to apply the latest database migration.');
          }
        }
      } catch (updateErr) {
        // A new column is missing in the database: say so instead of pretending it was saved
        const errMsg = `${updateErr?.message || ''} ${updateErr?.details || ''}`;
        if (/column|does not exist/i.test(errMsg)) {
          throw new Error('A new field is not set up in the database yet (contact email / GCash options). Ask the admin to run the latest migration.');
        }
        throw updateErr;
      }

      qc.invalidateQueries({ queryKey: ['my-agency'] });
      setEditProfileDialog(false);
    } catch (err) { setSaveError(err.message || 'Unable to save profile.'); }
    finally { setSaving(false); }
  };

  const handlePromoMediaUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingPromo(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const url = await uploadFile(file);
      setPostForm(p => ({ ...p, image_url: url, media_type: isVideo ? 'video' : 'image' }));
    } catch (err) { setSaveError('Upload failed: ' + err.message); }
    finally { setUploadingPromo(false); }
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingProof(true); setSaveError('');
    try { const url = await uploadFile(file, 'trip-proofs'); setCompletionForm(p => ({ ...p, proof_url: url })); }
    catch (err) { setSaveError('Upload failed: ' + err.message); }
    finally { setUploadingProof(false); }
  };

  const handleBannerImageUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingBanner(true);
    try { const url = await uploadFile(file, 'banners'); setBannerForm(p => ({ ...p, image_url: url })); }
    catch (err) { setSaveError('Upload failed: ' + err.message); }
    finally { setUploadingBanner(false); }
  };

  const handleSaveBanner = async () => {
    if (!bannerForm.title.trim()) { setSaveError('Banner title is required.'); return; }
    setSaving(true); setSaveError('');
    try {
      const created = await base44.entities.AgencyBanner.create({ agency_id: agency.id, agency_name: agency.name, title: bannerForm.title.trim(), subtitle: bannerForm.subtitle.trim() || undefined, cta_text: bannerForm.cta_text.trim() || undefined, banner_type: bannerForm.banner_type, image_url: bannerForm.image_url || undefined, link_url: bannerForm.link_url.trim() || undefined, is_active: true });
      setBanners(p => [created, ...p]);
      setBannerDialog(false);
      setBannerForm({ title: '', subtitle: '', cta_text: '', banner_type: 'promo', image_url: '', link_url: '', is_active: true });
    } catch (err) { setSaveError(err.message || 'Unable to save banner.'); }
    finally { setSaving(false); }
  };

  const handleDeleteBanner = async (id) => {
    try { await base44.entities.AgencyBanner.delete(id); setBanners(p => p.filter(b => b.id !== id)); }
    catch (err) { setSaveError('Could not delete banner.'); }
  };

  const openCompletionDialog = (booking) => {
    setCompletionBooking(booking);
    setCompletionForm({ actual_pax: String(booking.num_pax || ''), proof_url: '', notes: '' });
    setSaveError(''); setCompletionDialog(true);
  };

  const handleMarkCompleted = async () => {
    if (!completionForm.proof_url) { setSaveError('A proof photo is required before completing the trip.'); return; }
    if (!completionForm.actual_pax || Number(completionForm.actual_pax) < 1) { setSaveError('Enter the actual number of participants who came.'); return; }
    setSaving(true); setSaveError('');
    try {
      const actualPax = Number(completionForm.actual_pax);
      const pricePerPax = completionBooking.total_price / (completionBooking.num_pax || 1);
      const actualTotal = pricePerPax * actualPax;
      // use the rate STORED on the booking (what the guest was quoted); the database enforces this too
      const bookingRate = completionBooking.commission_rate ?? commissionRate;
      const platformFee = Math.round(actualTotal * bookingRate / 100);
      const agencyEarnings = actualTotal - platformFee;
      await base44.entities.Booking.update(completionBooking.id, { status: 'completed', completion_proof_url: completionForm.proof_url, actual_pax: actualPax, completed_at: new Date().toISOString(), completion_notes: completionForm.notes.trim() || undefined, actual_total_price: actualTotal, platform_fee: platformFee, agency_earnings: agencyEarnings });
      qc.invalidateQueries({ queryKey: ['agency-bookings'] });
      setCompletionDialog(false); setCompletionBooking(null);
    } catch (err) { setSaveError(err.message || 'Unable to complete booking.'); }
    finally { setSaving(false); }
  };

  const openReceiptDialog = (booking) => { setReceiptBooking(booking); setReceiptFile(null); setReceiptPreview(null); setSaveError(''); setReceiptDialog(true); };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { setSaveError('Please choose an image file (JPG, PNG).'); return; }
    if (file.size > 5 * 1024 * 1024) { setSaveError('Maximum file size is 5MB.'); return; }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmitReceipt = async () => {
    if (!receiptFile || !receiptBooking) return;
    setUploadingReceipt(true); setSaveError('');
    try {
      const url = await uploadFile(receiptFile, 'gcash-receipts');
      await base44.entities.Booking.update(receiptBooking.id, { gcash_receipt_url: url, status: 'commission_sent', commission_sent_date: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ['agency-bookings'] });
      setReceiptDialog(false);
    } catch (err) { setSaveError('Upload failed. Please try again.'); }
    finally { setUploadingReceipt(false); }
  };

  const handleSavePkg = async () => {
    if (atPackageLimit && !editPkg) { setSaveError(`Package limit reached for ${planConfig.label} plan. Upgrade to add more.`); return; }
    
    // Validate required fields
    const itineraryStops = pkgForm.nature_spots ? pkgForm.nature_spots.split('\n').map(s => s.trim()).filter(Boolean) : [];
    if (!pkgForm.title.trim()) { setSaveError('Package title is required.'); return; }
    if (!pkgForm.mountain_name.trim()) { setSaveError('Destination is required.'); return; }
    if (!pkgForm.price) { setSaveError('Price is required.'); return; }
    if (itineraryStops.length === 0) { setSaveError('Itinerary (nature spots) is required. Please add at least one stop.'); return; }
    
    setSaving(true); setSaveError('');
    try {
      let data = {
        title: pkgForm.title.trim(), description: pkgForm.description.trim() || undefined, mountain_name: pkgForm.mountain_name.trim(), image_url: pkgForm.image_url.trim() || undefined,
        currency: pkgForm.currency || 'PHP', agency_id: agency.id, agency_name: agency.name, owner_id: user.id, owner_email: user.email, price: Number(pkgForm.price),
        duration_days: Number(pkgForm.duration_days) || undefined, max_pax: Number(pkgForm.max_pax) || undefined,
        includes: pkgForm.includes ? pkgForm.includes.split('\n').map(s => s.trim()).filter(Boolean) : [],
        available_dates: pkgForm.available_dates ? pkgForm.available_dates.split('\n').map(s => s.trim()).filter(Boolean) : [],
        nature_spots: itineraryStops,
        open_for: pkgForm.open_for ? pkgForm.open_for.split('\n').map(s => s.trim()).filter(Boolean) : [],
        pickup_locations: pkgForm.pickup_locations ? pkgForm.pickup_locations.split('\n').map(s => s.trim()).filter(Boolean) : [],
        dropoff_locations: pkgForm.dropoff_locations ? pkgForm.dropoff_locations.split('\n').map(s => s.trim()).filter(Boolean) : [],
        other_pickup_locations: pkgForm.other_pickup_locations ? pkgForm.other_pickup_locations.split('\n').map(s => s.trim()).filter(Boolean) : [],
        promo_text: pkgForm.promo_text.trim() || undefined, allow_custom_dates: !!pkgForm.allow_custom_dates, status: 'active',
        package_photos: pkgForm.package_photos?.filter(p => typeof p === 'string') || [],
      };

      try {
        if (editPkg) await base44.entities.TourPackage.update(editPkg.id, data);
        else         await base44.entities.TourPackage.create(data);
      } catch (err) {
        // If schema mismatch, try with only core fields
        const errMsg = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
        if (errMsg.includes('schema') || errMsg.includes('column') || errMsg.includes('does not exist')) {
          const coreData = {
            title: data.title,
            description: data.description,
            mountain_name: data.mountain_name,
            price: data.price,
            agency_id: data.agency_id,
            agency_name: data.agency_name,
          };
          if (data.image_url) coreData.image_url = data.image_url;
          if (data.duration_days) coreData.duration_days = data.duration_days;
          if (data.max_pax) coreData.max_pax = data.max_pax;
          if (data.includes?.length) coreData.includes = data.includes;
          if (data.available_dates?.length) coreData.available_dates = data.available_dates;
          if (data.nature_spots?.length) coreData.nature_spots = data.nature_spots;
          if (data.status) coreData.status = data.status;
          
          if (editPkg) await base44.entities.TourPackage.update(editPkg.id, coreData);
          else         await base44.entities.TourPackage.create(coreData);
        } else {
          throw err;
        }
      }

      qc.invalidateQueries({ queryKey: ['agency-packages'] });
      setPkgDialog(false); setEditPkg(null); setPkgForm(emptyPkgForm);
    } catch (err) { setSaveError(err.message || 'Unable to save package.'); }
    finally { setSaving(false); }
  };

  const handleSaveTrip = async () => {
    setSaving(true); setSaveError('');
    try {
      const data = { title: tripForm.title.trim(), description: tripForm.description.trim() || undefined, mountain_name: tripForm.mountain_name.trim(), start_date: tripForm.start_date, end_date: tripForm.end_date || undefined, organizer_id: user.id, organizer_email: user.email, organizer_name: user.full_name || agency.name || user.email, agency_id: agency.id, agency_name: agency.name, max_participants: Number(tripForm.max_participants) || 10, current_participants: 1, budget_estimate: Number(tripForm.budget_estimate) || undefined, is_public: true, status: 'open' };
      
      try {
        const trip = await base44.entities.Trip.create(data);
        try { await base44.entities.TripMember.create({ trip_id: trip.id, user_email: user.email, user_name: user.full_name || agency.name || user.email, status: 'going', role: 'organizer' }); }
        catch (memberErr) { console.warn('Organizer membership could not be created:', memberErr); }
      } catch (err) {
        // If schema mismatch, try with core fields
        const errMsg = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
        if (errMsg.includes('schema') || errMsg.includes('column') || errMsg.includes('does not exist')) {
          const coreData = {
            title: data.title,
            description: data.description,
            mountain_name: data.mountain_name,
            start_date: data.start_date,
            organizer_id: data.organizer_id,
            organizer_email: data.organizer_email,
            organizer_name: data.organizer_name,
            status: data.status,
          };
          const trip = await base44.entities.Trip.create(coreData);
          try { await base44.entities.TripMember.create({ trip_id: trip.id, user_email: user.email, user_name: user.full_name || agency.name || user.email, status: 'going', role: 'organizer' }); }
          catch (memberErr) { console.warn('Organizer membership could not be created:', memberErr); }
        } else {
          throw err;
        }
      }

      qc.invalidateQueries({ queryKey: ['agency-trips', 'my-trips'] });
      setTripDialog(false);
      setTripForm({ title: '', description: '', mountain_name: '', start_date: '', end_date: '', max_participants: 10, budget_estimate: '', is_public: true });
    } catch (err) { setSaveError(err.message || 'Unable to save trip.'); }
    finally { setSaving(false); }
  };

  const handleSavePost = async () => {
    setSaving(true); setSaveError('');
    try {
      await base44.entities.Post.create({ content: postForm.content.trim(), author_id: user.id, author_email: user.email, author_name: agency?.name || user.full_name || user.email, post_type: postForm.post_type, image_url: postForm.image_url || null, media_type: postForm.media_type || null, status: 'active' });
      qc.invalidateQueries({ queryKey: ['agency-posts', 'posts'] });
      setPostDialog(false);
      setPostForm({ content: '', post_type: 'agency_promo', image_url: null, media_type: null });
    } catch (err) { setSaveError(err.message || 'Unable to save post.'); }
    finally { setSaving(false); }
  };

  const handleUpdateBooking = async (id, status) => {
    setSaveError('');
    try {
      await base44.entities.Booking.update(id, { status });
      qc.invalidateQueries({ queryKey: ['agency-bookings'] });
    } catch (err) { setSaveError(err.message || 'Unable to update booking.'); }
  };

  const openEditPkg = (pkg) => {
    setEditPkg(pkg);
    setPkgForm({ title: pkg.title, description: pkg.description || '', mountain_name: pkg.mountain_name, price: String(pkg.price), currency: pkg.currency || 'PHP', duration_days: String(pkg.duration_days || ''), max_pax: String(pkg.max_pax || ''), includes: (pkg.includes || []).join('\n'), image_url: pkg.image_url || '', available_dates: (pkg.available_dates || []).join('\n'), nature_spots: (pkg.nature_spots || []).join('\n'), open_for: (pkg.open_for || []).join('\n'), promo_text: pkg.promo_text || '', pickup_locations: (pkg.pickup_locations || []).join('\n'), dropoff_locations: (pkg.dropoff_locations || []).join('\n'), other_pickup_locations: (pkg.other_pickup_locations || []).join('\n'), allow_custom_dates: pkg.allow_custom_dates !== false, package_photos: pkg.package_photos || [] });
    setPkgDialog(true);
  };

  const openEditProfile = () => {
    setProfileForm({ logo_url: agency.logo_url || '', cover_url: agency.cover_url || '', gallery_photos: agency.gallery_photos || [], description: agency.description || '', location: agency.location || '', contact_phone: agency.contact_phone || '', contact_email: agency.contact_email || '', gcash_qr_url: agency.gcash_qr_url || '', gcash_display: agency.gcash_display || '', website: agency.website || '', facebook_url: agency.facebook_url || '', instagram_url: agency.instagram_url || '', years_operating: String(agency.years_operating || ''), gcash_number: agency.gcash_number || '', gcash_name: agency.gcash_name || '', business_reg_document_path: agency.business_reg_document_path || '', permit_document_path: agency.permit_document_path || '' });
    setProfileTab('images'); setSaveError(''); setEditProfileDialog(true);
  };

  if (loadingAgency) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agency) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center"><Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" /><h2 className="font-display text-xl font-bold mb-2">No Agency Found</h2><p className="text-sm text-muted-foreground mb-4">Register your agency to access the dashboard.</p><Button className="rounded-full" onClick={() => navigate('/agency-register')}>Register Agency</Button></div>
  );
  if (agency.status === 'pending') return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center"><AlertCircle className="w-16 h-16 text-yellow-500/60 mx-auto mb-4" /><h2 className="font-display text-xl font-bold mb-2">Under Review</h2><p className="text-sm text-muted-foreground">Your agency registration is pending admin approval.</p></div>
  );
  if (agency.status === 'rejected') return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center"><XCircle className="w-16 h-16 text-destructive/60 mx-auto mb-4" /><h2 className="font-display text-xl font-bold mb-2">Application Rejected</h2><p className="text-sm text-muted-foreground">Contact support for more information.</p></div>
  );

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

      {/* Agency Header Card */}
      <div className="bg-card border rounded-2xl overflow-hidden mb-4">
        <div className="h-28 bg-gradient-to-br from-primary/20 to-primary/5 relative">{agency.cover_url && <img src={agency.cover_url} alt="" className="w-full h-full object-cover" />}</div>
        <div className="px-4 pb-4 -mt-6 relative">
          <div className="flex items-end justify-between gap-2 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-card border-2 border-background shadow-md flex items-center justify-center overflow-hidden">{agency.logo_url ? <img src={agency.logo_url} className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-primary" />}</div>
            <div className="flex gap-2 flex-wrap justify-end pb-1">
              <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={openEditProfile}><Edit className="w-3 h-3 mr-1" /> Edit Profile</Button>
              {!isPaidPlan && <Button size="sm" className="rounded-full text-xs" onClick={() => navigate('/agency-subscribe')}>Upgrade Plan</Button>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-lg font-bold">{agency.name}</h1>
            {agency.is_verified && <Badge className="bg-green-100 text-green-700 border-0 text-xs">✓ Verified</Badge>}
            <Badge className={`border-0 text-xs ${planConfig.color}`}>{planConfig.label} Plan</Badge>
          </div>
          {expiryNotice && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              <span>{expiryNotice}</span>
              <button type="button" className="shrink-0 font-semibold underline" onClick={() => navigate('/agency-subscribe')}>Renew</button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{agency.location}{agency.contact_phone && ` · ${agency.contact_phone}`}</p>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[{ label: 'Packages', value: packages.length, icon: Package }, { label: 'Trips', value: trips.length, icon: Mountain }, { label: 'Bookings', value: bookings.length, icon: BookOpen }, { label: 'Messages', value: chatRooms.length, icon: MessageCircle }].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-muted rounded-xl p-2 text-center"><p className="text-lg font-bold text-primary">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
            ))}
          </div>
          {pendingReceiptCount > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
              <Receipt className="w-4 h-4 text-orange-500 shrink-0" />
              <p className="text-xs text-orange-800 flex-1"><span className="font-semibold">{pendingReceiptCount} booking{pendingReceiptCount > 1 ? 's' : ''}</span> completed — send the GCash commission receipt.</p>
            </div>
          )}
          {pendingDpReceiptCount > 0 && (
            <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Wallet className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-800 flex-1"><span className="font-semibold">{pendingDpReceiptCount} booking{pendingDpReceiptCount > 1 ? 's' : ''}</span> with a submitted downpayment receipt — review and confirm.</p>
            </div>
          )}
        </div>
      </div>

      {/* Commission Reminder */}
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800"><p className="font-semibold">Commission Reminder</p><p>Send <strong>{commissionRate}% commission</strong> to GCash <strong>{ADMIN_GCASH_NUMBER}</strong> ({ADMIN_GCASH_NAME}) within <strong>3 days</strong> after each completed booking.</p></div>
      </div>

      {saveError && <div className="mb-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}

      <Tabs defaultValue="bookings">
        <TabsList className="w-full flex h-auto justify-start gap-1 overflow-x-auto p-1 mb-4">
          <TabsTrigger value="marketing" className="shrink-0 px-3 text-xs py-2"><Megaphone className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Market</span></TabsTrigger>
          <TabsTrigger value="banners" className="shrink-0 px-3 text-xs py-2"><Flag className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Banners</span></TabsTrigger>
          <TabsTrigger value="finance" className="shrink-0 px-3 text-xs py-2"><TrendingUp className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Finance</span></TabsTrigger>
          <TabsTrigger value="bookings" className="relative shrink-0 px-3 text-xs py-2">
            Bookings
            {(pendingReceiptCount + pendingDpReceiptCount) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{pendingReceiptCount + pendingDpReceiptCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="packages" className="shrink-0 px-3 text-xs py-2">Packages</TabsTrigger>
          <TabsTrigger value="messages" className="shrink-0 px-3 text-xs py-2">Chats</TabsTrigger>
        </TabsList>

        {/* MARKETING */}
        <TabsContent value="marketing" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { type: 'agency_promo',   label: 'Post a Promo',   sub: 'Announce deals & discounts', icon: Megaphone,  bg: 'from-orange-50 to-orange-100 border-orange-200', iconBg: 'bg-orange-500' },
              { type: 'tour_highlight', label: 'Tour Highlight', sub: 'Showcase your best tours',   icon: Mountain,   bg: 'from-green-50 to-green-100 border-green-200',   iconBg: 'bg-green-500' },
              { type: 'photo_feature',  label: 'Photo Feature',  sub: 'Share destination photos',   icon: ImagePlus,  bg: 'from-purple-50 to-purple-100 border-purple-200', iconBg: 'bg-purple-500' },
              { type: 'travel_tip',     label: 'Travel Tip',     sub: 'Share travel advice',        icon: Star,       bg: 'from-blue-50 to-blue-100 border-blue-200',       iconBg: 'bg-blue-500' },
            ].map(item => { const Icon = item.icon; return (
              <button key={item.type} onClick={() => { setSaveError(''); setPostForm(p => ({ ...p, post_type: item.type })); setPostDialog(true); }}
                className={`flex flex-col items-center gap-2 p-4 bg-gradient-to-br ${item.bg} border rounded-2xl hover:shadow-md transition-all text-left`}>
                <div className={`w-10 h-10 ${item.iconBg} rounded-xl flex items-center justify-center`}><Icon className="w-5 h-5 text-white" /></div>
                <div><p className="font-semibold text-sm">{item.label}</p><p className="text-[10px] text-muted-foreground">{item.sub}</p></div>
              </button>
            ); })}
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><PenSquare className="w-4 h-4 text-primary" /> Your Posts ({posts.length})</h3>
            {posts.length === 0 ? <EmptyState icon={Megaphone} msg="No posts yet. Start marketing your agency!" /> : (
              <div className="space-y-3">
                {posts.map(post => (
                  <div key={post.id} className="bg-card border rounded-xl overflow-hidden">
                    {post.image_url && <div className="aspect-video bg-black">{post.media_type === 'video' ? <video src={post.image_url} className="w-full h-full object-cover" controls /> : <img src={post.image_url} alt="" className="w-full h-full object-cover" />}</div>}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PROMO_TYPE_COLORS[post.post_type] || 'bg-muted text-muted-foreground'}`}>{PROMO_TYPES.find(t => t.key === post.post_type)?.label || post.post_type}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{post.created_date ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true }) : ''}</span>
                      </div>
                      <p className="text-sm line-clamp-3">{post.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likes_count || 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments_count || 0}</span>
                        <button className="ml-auto text-destructive hover:text-destructive/80" onClick={async () => { await base44.entities.Post.delete(post.id); qc.invalidateQueries({ queryKey: ['agency-posts'] }); }}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* BANNERS */}
        <TabsContent value="banners" className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-semibold text-sm">Agency Banners</p><p className="text-xs text-muted-foreground">Create promo banners shown on your agency page</p></div>
            <Button size="sm" className="rounded-full text-xs" onClick={() => { setSaveError(''); setBannerDialog(true); }}><Plus className="w-3.5 h-3.5 mr-1" /> New Banner</Button>
          </div>
          {loadingBanners && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
          {!loadingBanners && banners.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center"><Flag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">No banners yet</p><Button size="sm" className="mt-3 rounded-full text-xs" onClick={() => setBannerDialog(true)}><Sparkles className="w-3.5 h-3.5 mr-1" /> Create First Banner</Button></div>
          )}
          <div className="space-y-3">
            {banners.map(banner => {
              const colors = BANNER_COLORS[banner.banner_type] || BANNER_COLORS.promo;
              return (
                <div key={banner.id} className="rounded-2xl border overflow-hidden">
                  <div className={`relative h-28 bg-gradient-to-r ${colors.bg} flex items-center px-5 gap-4`}>
                    {banner.image_url && <img src={banner.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                    <div className="relative z-10 flex-1 min-w-0"><p className="text-white font-bold text-base leading-tight">{banner.title}</p>{banner.subtitle && <p className="text-white/80 text-xs mt-0.5">{banner.subtitle}</p>}{banner.cta_text && <span className="inline-block mt-2 bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">{banner.cta_text}</span>}</div>
                    <span className={`relative z-10 text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${colors.badge}`}>{banner.banner_type}</span>
                  </div>
                  <div className="px-4 py-2 bg-muted/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{banner.created_date ? format(new Date(banner.created_date), 'MMM d, yyyy') : ''}</span>
                    <button onClick={() => handleDeleteBanner(banner.id)} className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* FINANCE */}
        <TabsContent value="finance" className="space-y-4">
          <div className="rounded-2xl p-4 border bg-card">
            <div className="flex items-center justify-between mb-3"><div><p className="text-xs text-muted-foreground">Current Plan</p><p className="font-bold text-lg">{planConfig.label}</p></div><Badge className={`${planConfig.color} border-0 text-sm px-3 py-1`}>{commissionRate}% commission</Badge></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground mb-1">Gross Revenue</p><p className="font-bold text-primary">P{totalRevenue.toLocaleString()}</p></div>
              <div className="bg-muted rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground mb-1">Platform Fee</p><p className="font-bold text-destructive">-P{totalCommission.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{commissionRate}%</p></div>
              <div className="bg-muted rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground mb-1">Net Earnings</p><p className="font-bold text-green-600">P{netRevenue.toLocaleString()}</p></div>
            </div>
            {!isPaidPlan && <div className="mt-3 flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl p-3"><p className="text-xs text-yellow-800">Upgrade to cut your commission rate</p><Button size="sm" className="rounded-full h-7 text-xs" onClick={() => navigate('/agency-subscribe')}>Upgrade</Button></div>}
          </div>

          <AgencyAnalytics
            bookings={bookings}
            locked={planRank(activeSub?.plan) < 2}
            onUpgrade={() => navigate('/agency-subscribe')}
          />

          {/* GCash Account Setup */}
          <div className={`rounded-2xl p-4 border ${(agency?.gcash_number || agency?.gcash_qr_url) ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${(agency?.gcash_number || agency?.gcash_qr_url) ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}>₱</div>
                <div>
                  <p className={`font-semibold text-sm ${(agency?.gcash_number || agency?.gcash_qr_url) ? 'text-blue-900' : 'text-amber-900'}`}>GCash Account</p>
                  <p className={`text-xs ${(agency?.gcash_number || agency?.gcash_qr_url) ? 'text-blue-700' : 'text-amber-700'}`}>{(agency?.gcash_number || agency?.gcash_qr_url) ? 'Customers will send downpayment here' : 'Setup your GCash account to receive payments'}</p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className={`rounded-full h-7 text-xs ${(agency?.gcash_number || agency?.gcash_qr_url) ? 'text-blue-600 border-blue-200' : 'text-amber-600 border-amber-200'}`}
                onClick={() => setEditProfileDialog(true)}
              >
                {(agency?.gcash_number || agency?.gcash_qr_url) ? 'Edit' : 'Setup'}
              </Button>
            </div>
            {(agency?.gcash_number || agency?.gcash_qr_url) && (
              <div className="rounded-lg bg-white/50 p-3 border border-blue-100">
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-xs text-blue-700">Customers see:</span>{' '}
                    <span className="font-bold text-blue-900">
                      {(agency.gcash_display === 'qr' || (!agency.gcash_display && agency.gcash_qr_url && !agency.gcash_number)) ? 'QR code' : agency.gcash_number}
                    </span>
                  </div>
                  {agency.gcash_name && <div><span className="text-xs text-blue-700">Account Name:</span> <span className="font-semibold text-blue-900">{agency.gcash_name}</span></div>}
                </div>
              </div>
            )}
          </div>

          <FinancialSummary bookings={bookings} packages={packages} commissionRate={commissionRate} />
        </TabsContent>

        {/* BOOKINGS */}
        <TabsContent value="bookings" className="space-y-3">
          {bookings.length === 0 ? <EmptyState icon={BookOpen} msg="No bookings yet." /> : bookings.map(b => (
            <div key={b.id} className="bg-card border rounded-xl p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm">{b.package_title}</p>
                  <p className="text-xs text-muted-foreground">{b.user_name} · {b.user_email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${bookingStatusColors[b.status] || 'bg-muted text-muted-foreground'}`}>
                  {b.status === 'commission_sent' ? 'Receipt Sent' : b.status === 'commission_confirmed' ? 'Commission ✓' : b.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
                {b.travel_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{b.travel_date}</span>}
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.num_pax} pax</span>
                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{b.payment_method?.replace('_', ' ')}</span>
                <span className="font-bold text-primary">P{b.total_price?.toLocaleString()}</span>
                {Number(b.downpayment_amount) > 0 && <span className="text-green-700 font-medium flex items-center gap-1"><Wallet className="w-3 h-3" />DP: P{b.downpayment_amount?.toLocaleString()}</span>}
                {b.balance_amount > 0 && <span className="text-amber-700 flex items-center gap-1">Balance: P{b.balance_amount?.toLocaleString()}</span>}
              </div>

              {b.pickup_location && (
                <div className="mb-2 flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-blue-800">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span><strong>Meetup/Pickup:</strong> {b.pickup_location}</span>
                </div>
              )}

              {b.notes && <p className="text-xs text-muted-foreground mb-2 italic">"{b.notes}"</p>}

              {/* User downpayment receipt */}
              {b.dp_receipt_url && (
                <div className="mb-3 rounded-xl overflow-hidden border border-blue-200">
                  <div className="px-3 py-1.5 bg-blue-50 flex items-center gap-2 text-xs text-blue-800 font-medium">
                    <Receipt className="w-3 h-3 shrink-0" /> Downpayment receipt from the user
                  </div>
                  <img src={b.dp_receipt_url} alt="DP receipt" className="w-full h-28 object-cover object-top" />
                  <div className="px-3 py-1.5 bg-blue-50 text-[11px] text-blue-700">
                    Submitted: {b.dp_receipt_submitted_at ? format(new Date(b.dp_receipt_submitted_at), 'MMM d, yyyy h:mm a') : '—'}
                  </div>
                </div>
              )}

              {b.completion_proof_url && (
                <div className="mb-3 rounded-xl overflow-hidden border">
                  <img src={b.completion_proof_url} alt="Trip proof" className="w-full h-32 object-cover" />
                  <div className="p-2 bg-muted flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-green-700 font-medium">Verified · {b.actual_pax} pax attended</span>
                    {b.completed_at && <span className="ml-auto">{format(new Date(b.completed_at), 'MMM d, yyyy')}</span>}
                  </div>
                </div>
              )}

              {b.gcash_receipt_url && (
                <div className="mb-3 rounded-xl overflow-hidden border">
                  <img src={b.gcash_receipt_url} alt="GCash receipt" className="w-full h-24 object-cover object-top" />
                  <div className="p-2 bg-muted flex items-center gap-2 text-xs">
                    <Receipt className="w-3 h-3 text-blue-600" />
                    {b.status === 'commission_confirmed'
                      ? <span className="text-green-700 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Admin confirmed your payment</span>
                      : <span className="text-orange-700 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Waiting for admin confirmation</span>}
                  </div>
                </div>
              )}

              {b.status === 'pending' && (
                <div className="space-y-2">
                  {b.use_downpayment && !b.dp_receipt_url && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-800">
                      <Clock className="w-3 h-3 shrink-0" /> Waiting for the user's downpayment receipt before the booking can be confirmed.
                    </div>
                  )}
                  {b.dp_receipt_url && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-800">
                      <CheckCircle className="w-3 h-3 shrink-0" /> The user submitted a downpayment receipt — you can confirm the booking.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-full h-9 text-xs flex-1" disabled={!!b.use_downpayment && !b.dp_receipt_url} onClick={() => handleUpdateBooking(b.id, 'confirmed')}><CheckCircle className="w-3 h-3 mr-1" /> Confirm</Button>
                    <Button size="sm" variant="outline" className="rounded-full h-9 text-xs flex-1" onClick={() => handleUpdateBooking(b.id, 'cancelled')}><XCircle className="w-3 h-3 mr-1" /> Decline</Button>
                  </div>
                </div>
              )}

              {b.status === 'confirmed' && (
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="rounded-full h-9 text-xs w-full border-primary/30 text-primary hover:bg-primary/5" onClick={() => { setGroupChatBooking(b); setGroupChatDialog(true); }}><UsersRound className="w-3 h-3 mr-1" /> Create Group Chat</Button>
                  <Button size="sm" className="rounded-full h-9 text-xs w-full bg-green-600 hover:bg-green-700" onClick={() => openCompletionDialog(b)}><ClipboardCheck className="w-3 h-3 mr-1" /> Mark as Completed</Button>
                </div>
              )}

              {b.status === 'completed' && !isCommissionConfirmed(b) && (
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="rounded-full h-9 text-xs w-full border-primary/30 text-primary hover:bg-primary/5" onClick={() => { setGroupChatBooking(b); setGroupChatDialog(true); }}><UsersRound className="w-3 h-3 mr-1" /> Create Group Chat</Button>
                  <Button size="sm" className="rounded-full h-9 text-xs w-full bg-blue-600 hover:bg-blue-700" onClick={() => openReceiptDialog(b)}><Upload className="w-3 h-3 mr-1" /> Send GCash Commission Receipt</Button>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* PACKAGES */}
        <TabsContent value="packages" className="space-y-3">
          <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><span className="text-sm font-medium">{packages.length} / {maxPackages === Infinity ? '∞' : maxPackages} packages</span><Badge className={`${planConfig.color} border-0 text-xs`}>{planConfig.label}</Badge></div>
            {atPackageLimit && !isPaidPlan && <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" onClick={() => navigate('/agency-subscribe')}>Upgrade</Button>}
          </div>
          <Button className="w-full rounded-full" disabled={atPackageLimit && !editPkg}
            onClick={() => { if (atPackageLimit) { setSaveError(`Package limit reached for ${planConfig.label} plan (max ${maxPackages}). Please upgrade.`); return; } setSaveError(''); setEditPkg(null); setPkgDialog(true); }}>
            {atPackageLimit ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}{atPackageLimit ? 'Limit Reached — Upgrade to Add More' : 'Add Tour Package'}
          </Button>
          {packages.length === 0 ? <EmptyState icon={Package} msg="No packages yet." /> : packages.map(pkg => (
            <div key={pkg.id} className="bg-card border rounded-xl p-3 flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">{pkg.image_url && <img src={pkg.image_url} className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{pkg.title}</p>
                <p className="text-xs text-muted-foreground">{pkg.mountain_name}</p>
                <p className="text-primary font-bold text-sm mt-1">P{pkg.price?.toLocaleString()}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {pkg.available_dates?.length > 0 && <Badge variant="outline" className="text-[10px]">{pkg.available_dates.length} dates</Badge>}
                  {pkg.pickup_locations?.length > 0 && <Badge variant="outline" className="text-[10px]">{pkg.pickup_locations.length} pickups</Badge>}
                  {pkg.allow_custom_dates !== false && <Badge variant="outline" className="text-[10px]">custom date</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {(!pkg.status || pkg.status === 'active') && <Button size="sm" variant="outline" aria-label={`Share ${pkg.title} to Feed`} title="Share package to Feed" className="h-7 rounded-lg px-2 text-primary" onClick={() => setSharePackage(pkg)}><Megaphone className="h-3.5 w-3.5" /></Button>}
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => openEditPkg(pkg)}><Edit className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-destructive" onClick={async () => { await base44.entities.TourPackage.delete(pkg.id); qc.invalidateQueries({ queryKey: ['agency-packages'] }); }}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* MESSAGES */}
        <TabsContent value="messages" className="space-y-1">
          {chatRooms.length === 0 ? <EmptyState icon={MessageCircle} msg="No conversations yet." /> : chatRooms.map(room => {
            const isGroup  = room.is_group || room.type === 'group';
            const otherIdx = room.participants?.indexOf(user.email) === 0 ? 1 : 0;
            const name     = isGroup ? (room.name || 'Group Chat') : (room.participant_names?.[otherIdx] || 'Hiker');
            return (
              <Link key={room.id} to={`/chat/${room.id}`} className="block">
                <div className="flex items-center gap-3 p-3 bg-card border rounded-xl hover:bg-muted transition-colors">
                  <Avatar className="w-10 h-10 shrink-0"><AvatarFallback className={`text-sm font-bold ${isGroup ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>{isGroup ? <UsersRound className="w-5 h-5" /> : name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5"><p className="text-sm font-semibold truncate">{name}</p>{isGroup && <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">group · {room.participants?.length}</Badge>}</div>
                    {room.package_title && <p className="text-[10px] text-primary flex items-center gap-1"><Mountain className="w-2.5 h-2.5" />{room.package_title}</p>}
                    {room.last_message && <p className="text-xs text-muted-foreground truncate">{room.last_message}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <GroupChatDialog open={groupChatDialog} onClose={() => { setGroupChatDialog(false); setGroupChatBooking(null); }} booking={groupChatBooking} agency={agency} user={user} navigate={navigate} />
      {sharePackage && agency && user && <SharePackageDialog pkg={sharePackage} agency={agency} user={user} onClose={() => setSharePackage(null)} />}

      {/* Banner Dialog */}
      <Dialog open={bannerDialog} onOpenChange={v => { if (!saving) { setBannerDialog(v); if (!v) setSaveError(''); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Flag className="w-4 h-4 text-primary" /> Create Agency Banner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {bannerForm.title && (
              <div className={`relative h-24 rounded-xl overflow-hidden bg-gradient-to-r ${BANNER_COLORS[bannerForm.banner_type]?.bg || 'from-orange-500 to-red-500'} flex items-center px-4 gap-3`}>
                {bannerForm.image_url && <img src={bannerForm.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                <div className="relative z-10 flex-1 min-w-0"><p className="text-white font-bold text-sm leading-tight">{bannerForm.title}</p>{bannerForm.subtitle && <p className="text-white/80 text-xs mt-0.5">{bannerForm.subtitle}</p>}{bannerForm.cta_text && <span className="inline-block mt-1.5 bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full">{bannerForm.cta_text}</span>}</div>
              </div>
            )}
            <div><Label className="text-xs text-muted-foreground mb-2 block">Banner Type</Label><div className="grid grid-cols-2 gap-1.5">{BANNER_TYPES.map(t => (<button key={t.key} onClick={() => setBannerForm(p => ({ ...p, banner_type: t.key }))} className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${bannerForm.banner_type === t.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}><span className="text-base">{t.label.split(' ')[0]}</span><div><p className="text-xs font-medium">{t.label.split(' ').slice(1).join(' ')}</p><p className="text-[10px] text-muted-foreground">{t.desc}</p></div></button>))}</div></div>
            <div><Label>Banner Title *</Label><Input className="mt-1" value={bannerForm.title} onChange={e => setBannerForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. 20% OFF this June!" /></div>
            <div><Label>Subtitle <span className="text-muted-foreground text-xs">(optional)</span></Label><Input className="mt-1" value={bannerForm.subtitle} onChange={e => setBannerForm(p => ({ ...p, subtitle: e.target.value }))} placeholder="e.g. Limited slots available" /></div>
            <div><Label>Call-to-Action Text <span className="text-muted-foreground text-xs">(optional)</span></Label><Input className="mt-1" value={bannerForm.cta_text} onChange={e => setBannerForm(p => ({ ...p, cta_text: e.target.value }))} placeholder="e.g. Book Now, Learn More" /></div>
            <div><Label>Banner Image <span className="text-muted-foreground text-xs">(optional)</span></Label>
              {bannerForm.image_url ? (<div className="relative mt-1 h-24 rounded-xl overflow-hidden border"><img src={bannerForm.image_url} alt="" className="w-full h-full object-cover" /><button onClick={() => setBannerForm(p => ({ ...p, image_url: '' }))} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center"><X className="w-3.5 h-3.5" /></button></div>)
              : (<label className="flex items-center gap-3 mt-1 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">{uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Image className="w-4 h-4 text-muted-foreground" />}<span className="text-xs text-muted-foreground">{uploadingBanner ? 'Uploading...' : 'Upload background image'}</span><input type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} /></label>)}
            </div>
            <div><Label>Link URL <span className="text-muted-foreground text-xs">(optional)</span></Label><Input className="mt-1" value={bannerForm.link_url} onChange={e => setBannerForm(p => ({ ...p, link_url: e.target.value }))} placeholder="https://..." /></div>
            {saveError && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}
            <Button className="w-full rounded-full" onClick={handleSaveBanner} disabled={!bannerForm.title.trim() || saving || uploadingBanner}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}Publish Banner</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileDialog} onOpenChange={v => { if (!saving && !uploadingProfileImg) setEditProfileDialog(v); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-4 h-4 text-primary" /> Edit Agency Profile</DialogTitle></DialogHeader>
          <div className="flex gap-1 bg-muted rounded-xl p-1 mb-1">{[{ id: 'images', label: 'Photos & Logo' }, { id: 'info', label: 'Agency Info' }].map(t => (<button key={t.id} onClick={() => setProfileTab(t.id)} className={`flex-1 text-xs rounded-lg py-1.5 font-medium transition-all ${profileTab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t.label}</button>))}</div>
          <div className="space-y-4">
            {profileTab === 'images' && (<>
              <div><Label>Cover Photo</Label>
                {profileForm.cover_url ? (<div className="relative mt-1 h-32 rounded-xl overflow-hidden border"><img src={profileForm.cover_url} alt="Cover" className="w-full h-full object-cover" /><button onClick={() => setProfileForm(p => ({ ...p, cover_url: '' }))} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"><X className="w-4 h-4" /></button></div>)
                : (<label className="flex items-center gap-3 mt-1 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">{uploadingProfileImg === 'cover' ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ImagePlus className="w-5 h-5 text-muted-foreground" />}<div><p className="text-sm text-muted-foreground">{uploadingProfileImg === 'cover' ? 'Uploading...' : 'Upload cover photo'}</p><p className="text-[10px] text-muted-foreground">Landscape recommended (1200x400)</p></div><input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleProfileImageUpload(e.target.files[0], 'cover')} /></label>)}
              </div>
              <div><Label>Agency Logo</Label>
                {profileForm.logo_url ? (<div className="flex items-center gap-3 mt-1"><div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted border"><img src={profileForm.logo_url} alt="Logo" className="w-full h-full object-cover" /><button onClick={() => setProfileForm(p => ({ ...p, logo_url: '' }))} className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"><X className="w-3 h-3" /></button></div><p className="text-xs text-green-600 font-medium">✓ Logo uploaded</p></div>)
                : (<label className="flex items-center gap-3 mt-1 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">{uploadingProfileImg === 'logo' ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ImagePlus className="w-5 h-5 text-muted-foreground" />}<div><p className="text-sm text-muted-foreground">{uploadingProfileImg === 'logo' ? 'Uploading...' : 'Upload agency logo'}</p><p className="text-[10px] text-muted-foreground">Square recommended (400x400)</p></div><input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleProfileImageUpload(e.target.files[0], 'logo')} /></label>)}
              </div>
              <div><Label>Background Photos <span className="text-muted-foreground text-xs">(proof of legitimacy)</span></Label>
                <p className="text-[11px] text-muted-foreground mb-2">Upload trip photos, group shots, summit proofs, or permits.</p>
                {(profileForm.gallery_photos || []).length > 0 && (<div className="grid grid-cols-3 gap-2 mb-2">{profileForm.gallery_photos.map((photo, i) => (<div key={i} className="relative aspect-square rounded-xl overflow-hidden border"><img src={photo} alt="" className="w-full h-full object-cover" /><button onClick={() => setProfileForm(p => ({ ...p, gallery_photos: p.gallery_photos.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"><X className="w-2.5 h-2.5" /></button></div>))}</div>)}
                <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">{uploadingProfileImg === 'gallery' ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}<div><p className="text-xs text-muted-foreground">{uploadingProfileImg === 'gallery' ? 'Uploading...' : 'Add background photo'}</p><p className="text-[10px] text-muted-foreground">Multiple uploads supported</p></div><input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleProfileImageUpload(e.target.files[0], 'gallery')} /></label>
              </div>
            </>)}
            {profileTab === 'info' && (<>
              <div><Label>Agency Description</Label><Textarea className="mt-1 resize-none" rows={3} value={profileForm.description} onChange={e => setProfileForm(p => ({ ...p, description: e.target.value }))} placeholder="Tell clients about your agency..." /></div>
              <div><Label>Location</Label><div className="relative mt-1"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={profileForm.location} onChange={e => setProfileForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Baguio City, Benguet" /></div></div>
              <div><Label>Contact Phone</Label><div className="relative mt-1"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={profileForm.contact_phone} onChange={e => setProfileForm(p => ({ ...p, contact_phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" /></div></div>
              <div><Label>Business Email <span className="text-muted-foreground text-xs">(visible to customers)</span></Label><Input className="mt-1" type="email" inputMode="email" placeholder="info@youragency.com" value={profileForm.contact_email} onChange={e => setProfileForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
              <div><Label>Years in Business</Label><Input className="mt-1" type="number" min="0" value={profileForm.years_operating} onChange={e => setProfileForm(p => ({ ...p, years_operating: e.target.value }))} placeholder="e.g. 5" /></div>
              <div><Label>Website</Label><div className="relative mt-1"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={profileForm.website} onChange={e => setProfileForm(p => ({ ...p, website: e.target.value }))} placeholder="https://yourwebsite.com" /></div></div>
              <div><Label>Facebook Page URL</Label><div className="relative mt-1"><Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={profileForm.facebook_url} onChange={e => setProfileForm(p => ({ ...p, facebook_url: e.target.value }))} placeholder="https://facebook.com/yourpage" /></div></div>
              <div><Label>Instagram URL</Label><div className="relative mt-1"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={profileForm.instagram_url} onChange={e => setProfileForm(p => ({ ...p, instagram_url: e.target.value }))} placeholder="https://instagram.com/yourhandle" /></div></div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Verification documents</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Private files visible only to your account and Melotrip admins. PDF, JPG, PNG, or WebP up to 10MB.</p>
                </div>
                {[
                  { field: 'business_reg_document_path', label: 'Business Registration' },
                  { field: 'permit_document_path', label: 'DOLE / Operating Permit' },
                ].map(({ field, label }) => (
                  <div key={field} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {profileForm[field] ? 'Document uploaded' : 'Not submitted'}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted shrink-0">
                      {uploadingProfileImg === field
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Upload className="w-3.5 h-3.5" />}
                      {profileForm[field] ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={!!uploadingProfileImg}
                        onChange={event => {
                          handleAgencyDocumentUpload(event.target.files?.[0], field);
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {profileForm[field] && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${label}`}
                        onClick={() => setProfileForm(current => ({ ...current, [field]: null }))}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* GCash Payment Account */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">₱</div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">GCash Account for Customers</p>
                    <p className="text-[11px] text-blue-700">Customers will send their downpayment to this account</p>
                  </div>
                </div>
                <GcashModeFields tone="blue" value={profileForm} onChange={(patch) => setProfileForm(p => ({ ...p, ...patch }))} onBusyChange={(busy) => setUploadingProfileImg(busy ? 'gcash_qr' : null)} />
              </div>
            </>)}
            {saveError && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}
            <Button className="w-full rounded-full" onClick={handleSaveProfile} disabled={saving || !!uploadingProfileImg}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GCash Receipt Dialog */}
      <Dialog open={receiptDialog} onOpenChange={v => { if (!uploadingReceipt) { setReceiptDialog(v); if (!v) { setReceiptFile(null); setReceiptPreview(null); setSaveError(''); } } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-4 h-4 text-blue-600" /> Send GCash Commission Receipt</DialogTitle></DialogHeader>
          {receiptBooking && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p className="font-semibold">{receiptBooking.package_title}</p>
                <p className="text-xs text-muted-foreground">{receiptBooking.user_name} · {receiptBooking.travel_date}</p>
                <div className="flex justify-between pt-1 border-t mt-1"><span className="text-muted-foreground text-xs">Commission amount</span><span className="font-bold text-blue-700">P{Math.round((receiptBooking.actual_total_price || receiptBooking.total_price || 0) * commissionRate / 100).toLocaleString()} <span className="font-normal text-muted-foreground">({commissionRate}%)</span></span></div>
              </div>
              <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">Send the commission to the admin's GCash number, then screenshot the receipt and upload it here so the admin can confirm.</p>
              <div>
                <Label className="text-sm mb-2 block">GCash Receipt Screenshot *</Label>
                {receiptPreview ? (
                  <div className="relative rounded-xl overflow-hidden border"><img src={receiptPreview} alt="Receipt preview" className="w-full object-contain max-h-64" /><button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"><X className="w-4 h-4" /></button><div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Receipt ready</div></div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"><Upload className="w-8 h-8 text-muted-foreground mb-2" /><span className="text-sm text-muted-foreground">Click to upload a screenshot</span><span className="text-xs text-muted-foreground mt-1">JPG, PNG — max 5MB</span><input type="file" accept="image/*" className="hidden" onChange={handleReceiptFileChange} /></label>
                )}
              </div>
              {saveError && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={() => setReceiptDialog(false)} disabled={uploadingReceipt}>Cancel</Button>
                <Button className="flex-1 rounded-full bg-blue-600 hover:bg-blue-700" onClick={handleSubmitReceipt} disabled={!receiptFile || uploadingReceipt}>{uploadingReceipt ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Submit Receipt</>}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trip Completion Dialog */}
      <Dialog open={completionDialog} onOpenChange={v => { if (!saving && !uploadingProof) { setCompletionDialog(v); if (!v) { setCompletionBooking(null); setSaveError(''); } } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-green-600" /> Mark Trip as Completed</DialogTitle></DialogHeader>
          {completionBooking && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p className="font-semibold">{completionBooking.package_title}</p>
                <p className="text-xs text-muted-foreground">{completionBooking.user_name} · {completionBooking.travel_date}</p>
                <p className="text-xs text-muted-foreground">Booked: {completionBooking.num_pax} pax · P{completionBooking.total_price?.toLocaleString()}</p>
              </div>
              <div><Label className="text-sm">Actual Number of Participants *</Label><p className="text-[10px] text-muted-foreground mb-1">How many people actually came?</p><Input type="number" min="1" value={completionForm.actual_pax} onChange={e => setCompletionForm(p => ({ ...p, actual_pax: e.target.value }))} className="mt-1" placeholder={`e.g. ${completionBooking.num_pax}`} /></div>
              <div>
                <Label className="text-sm">Group / Trip Proof Photo *</Label><p className="text-[10px] text-muted-foreground mb-1">Upload a group photo or summit photo as proof</p>
                {completionForm.proof_url ? (
                  <div className="relative mt-1 rounded-xl overflow-hidden border aspect-video bg-muted"><img src={completionForm.proof_url} alt="Proof" className="w-full h-full object-cover" /><button onClick={() => setCompletionForm(p => ({ ...p, proof_url: '' }))} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"><X className="w-4 h-4" /></button><div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Photo uploaded</div></div>
                ) : (
                  <label className="flex items-center gap-3 mt-1 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">{uploadingProof ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Camera className="w-5 h-5 text-muted-foreground" />}<div><p className="text-sm text-muted-foreground">{uploadingProof ? 'Uploading...' : 'Upload proof photo'}</p><p className="text-[10px] text-muted-foreground">Group photo, summit shot, etc.</p></div><input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} /></label>
                )}
              </div>
              <div><Label className="text-sm">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea value={completionForm.notes} onChange={e => setCompletionForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any remarks about the trip..." className="resize-none mt-1 text-sm" /></div>
              {completionForm.actual_pax && Number(completionForm.actual_pax) > 0 && (() => {
                const pax = Number(completionForm.actual_pax);
                const pricePerPax = completionBooking.total_price / (completionBooking.num_pax || 1);
                const actualTotal = pricePerPax * pax;
                const fee = Math.round(actualTotal * commissionRate / 100);
                const earnings = actualTotal - fee;
                return (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-green-800">Commission Preview</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-xs font-bold text-green-700">P{actualTotal.toLocaleString()}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Platform ({commissionRate}%)</p><p className="text-xs font-bold text-destructive">-P{fee.toLocaleString()}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Your Earnings</p><p className="text-xs font-bold text-green-600">P{earnings.toLocaleString()}</p></div>
                    </div>
                  </div>
                );
              })()}
              {saveError && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}
              <Button className="w-full rounded-full bg-green-600 hover:bg-green-700" onClick={handleMarkCompleted} disabled={saving || uploadingProof || !completionForm.proof_url || !completionForm.actual_pax}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}Confirm Trip Completion</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Marketing Post Dialog */}
      <Dialog open={postDialog} onOpenChange={v => { if (!saving) { setPostDialog(v); if (!v) setPostForm({ content: '', post_type: 'agency_promo', image_url: null, media_type: null }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Create Marketing Post</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-2 block">Post Type</Label><div className="grid grid-cols-1 gap-1.5">{PROMO_TYPES.map(type => (<button key={type.key} onClick={() => setPostForm(p => ({ ...p, post_type: type.key }))} className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${postForm.post_type === type.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}><span className="text-lg">{type.label.split(' ')[0]}</span><div><p className="text-xs font-medium">{type.label.split(' ').slice(1).join(' ')}</p><p className="text-[10px] text-muted-foreground">{type.desc}</p></div>{postForm.post_type === type.key && <CheckCircle className="w-4 h-4 text-primary ml-auto shrink-0" />}</button>))}</div></div>
            <div><Label>Content *</Label><Textarea value={postForm.content} onChange={e => setPostForm(p => ({ ...p, content: e.target.value }))} rows={4} placeholder="Write your post..." className="resize-none mt-1" /></div>
            <div><Label>Photo / Video <span className="text-muted-foreground text-xs">(optional)</span></Label>
              {postForm.image_url ? (<div className="relative mt-1 rounded-xl overflow-hidden bg-muted aspect-video">{postForm.media_type === 'video' ? <video src={postForm.image_url} className="w-full h-full object-cover" controls /> : <img src={postForm.image_url} alt="" className="w-full h-full object-cover" />}<button onClick={() => setPostForm(p => ({ ...p, image_url: null, media_type: null }))} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"><X className="w-4 h-4" /></button></div>)
              : (<label className="flex items-center gap-3 mt-1 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">{uploadingPromo ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ImagePlus className="w-5 h-5 text-muted-foreground" />}<span className="text-sm text-muted-foreground">{uploadingPromo ? 'Uploading...' : 'Add photo or video'}</span><input type="file" accept="image/*,video/*" className="hidden" onChange={handlePromoMediaUpload} /></label>)}
            </div>
            <Button className="w-full rounded-full" onClick={handleSavePost} disabled={!postForm.content.trim() || saving || uploadingPromo}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />} Post to Feed</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Package Dialog */}
      <Dialog open={pkgDialog} onOpenChange={v => { if (!saving) { setPkgDialog(v); if (!v) setEditPkg(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPkg ? 'Edit Package' : 'New Tour Package'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Package Title *</Label><Input value={pkgForm.title} onChange={e => setPkgForm(p => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
            <div><Label>Destination *</Label><Input value={pkgForm.mountain_name} onChange={e => setPkgForm(p => ({ ...p, mountain_name: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Price (P) *</Label><Input type="number" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))} className="mt-1" /></div><div><Label>Duration (days)</Label><Input type="number" value={pkgForm.duration_days} onChange={e => setPkgForm(p => ({ ...p, duration_days: e.target.value }))} className="mt-1" /></div></div>
            <div><Label>Max Participants</Label><Input type="number" value={pkgForm.max_pax} onChange={e => setPkgForm(p => ({ ...p, max_pax: e.target.value }))} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} rows={2} className="resize-none mt-1" /></div>
            <div><Label>Inclusions (one per line)</Label><Textarea value={pkgForm.includes} onChange={e => setPkgForm(p => ({ ...p, includes: e.target.value }))} placeholder="Meals&#10;Guide&#10;Tent" rows={3} className="resize-none mt-1" /></div>
            <div><Label>Itinerary / Nature Stops *</Label><Textarea value={pkgForm.nature_spots} onChange={e => setPkgForm(p => ({ ...p, nature_spots: e.target.value }))} placeholder="Stop 1\nStop 2\nStop 3" rows={4} className="resize-none mt-1" /><p className="text-xs text-muted-foreground mt-1">Required - List the hiking trails, viewpoints, or destinations included in this package (one per line)</p></div>
            <div><Label>Open For (one per line)</Label><Textarea value={pkgForm.open_for} onChange={e => setPkgForm(p => ({ ...p, open_for: e.target.value }))} placeholder="Solo Travelers&#10;Couples&#10;Barkada" rows={3} className="resize-none mt-1" /></div>
            <div><Label>Promo / Group Deal</Label><Input value={pkgForm.promo_text} onChange={e => setPkgForm(p => ({ ...p, promo_text: e.target.value }))} placeholder="13+1 FREE" className="mt-1" /></div>
            <div><Label>Available Dates (one per line, YYYY-MM-DD)</Label><Textarea value={pkgForm.available_dates} onChange={e => setPkgForm(p => ({ ...p, available_dates: e.target.value }))} placeholder="2025-06-01&#10;2025-06-08" rows={2} className="resize-none mt-1" /></div>
            <label className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm"><input type="checkbox" checked={pkgForm.allow_custom_dates} onChange={e => setPkgForm(p => ({ ...p, allow_custom_dates: e.target.checked }))} className="mt-1" /><span><span className="font-medium">Allow user-requested custom dates</span><span className="block text-xs text-muted-foreground">Users can choose their own preferred date if scheduled dates do not fit.</span></span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Pickup Locations (one per line)</Label><Textarea value={pkgForm.pickup_locations} onChange={e => setPkgForm(p => ({ ...p, pickup_locations: e.target.value }))} placeholder="Greenfield, Mandaluyong&#10;Cubao, QC" rows={4} className="resize-none mt-1" /></div>
              <div><Label>Dropoff Locations (one per line)</Label><Textarea value={pkgForm.dropoff_locations} onChange={e => setPkgForm(p => ({ ...p, dropoff_locations: e.target.value }))} placeholder="Same as pickup&#10;Greenfield" rows={4} className="resize-none mt-1" /></div>
            </div>
            <div><Label>Other Pickup Options / Add Fee Notes</Label><Textarea value={pkgForm.other_pickup_locations} onChange={e => setPkgForm(p => ({ ...p, other_pickup_locations: e.target.value }))} placeholder="Cavite - add fee&#10;Laguna - add fee" rows={3} className="resize-none mt-1" /></div>
            
            <div>
              <Label>Package Photos (Optional - to entice bookings!)</Label>
              <div className="mt-2 space-y-3">
                {pkgForm.package_photos?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {pkgForm.package_photos.map((photo, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border bg-muted h-20">
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPkgForm(p => ({ ...p, package_photos: p.package_photos.filter((_, idx) => idx !== i) }))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 rounded-lg border-2 border-dashed bg-muted/40 p-3 cursor-pointer hover:bg-muted/60 transition-colors">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload location photos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setUploadingPkgPhoto(true);
                      try {
                        for (const file of files) {
                          if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5MB)'); continue; }
                          const url = await uploadFile(file, 'package-photos');
                          setPkgForm(p => ({ ...p, package_photos: [...(p.package_photos || []), url] }));
                        }
                      } catch (err) { alert('Upload failed: ' + err.message); }
                      finally { setUploadingPkgPhoto(false); }
                    }}
                    disabled={uploadingPkgPhoto}
                    className="hidden"
                  />
                </label>
                {uploadingPkgPhoto && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Uploading...</p>}
                <p className="text-xs text-muted-foreground">Add 3-5 nice location photos to increase bookings. Max 5MB per photo.</p>
              </div>
            </div>
            
            <ImageField label="Cover photo" folder="packages" value={pkgForm.image_url} onChange={(url) => setPkgForm(p => ({ ...p, image_url: url }))} />
            {saveError && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}
            <Button className="w-full rounded-full" onClick={handleSavePkg} disabled={!pkgForm.title || !pkgForm.price || !pkgForm.mountain_name || !pkgForm.nature_spots?.trim() || saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} {editPkg ? 'Save Changes' : 'Create Package'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trip Dialog */}
      <Dialog open={tripDialog} onOpenChange={v => { if (!saving) setTripDialog(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Organize a Trip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Trip Title *</Label><Input value={tripForm.title} onChange={e => setTripForm(p => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
            <div><Label>Destination *</Label><Input value={tripForm.mountain_name} onChange={e => setTripForm(p => ({ ...p, mountain_name: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Start Date *</Label><Input type="date" value={tripForm.start_date} onChange={e => setTripForm(p => ({ ...p, start_date: e.target.value }))} className="mt-1" /></div><div><Label>End Date</Label><Input type="date" value={tripForm.end_date} onChange={e => setTripForm(p => ({ ...p, end_date: e.target.value }))} className="mt-1" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Max Participants</Label><Input type="number" value={tripForm.max_participants} onChange={e => setTripForm(p => ({ ...p, max_participants: e.target.value }))} className="mt-1" /></div><div><Label>Budget Estimate (P)</Label><Input type="number" value={tripForm.budget_estimate} onChange={e => setTripForm(p => ({ ...p, budget_estimate: e.target.value }))} className="mt-1" /></div></div>
            <div><Label>Description</Label><Textarea value={tripForm.description} onChange={e => setTripForm(p => ({ ...p, description: e.target.value }))} rows={3} className="resize-none mt-1" /></div>
            {saveError && <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{saveError}</div>}
            <Button className="w-full rounded-full" onClick={handleSaveTrip} disabled={!tripForm.title || !tripForm.mountain_name || !tripForm.start_date || saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Trip</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}