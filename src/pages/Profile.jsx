import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { uploadFile } from '@/lib/uploadFile';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mountain, CalendarDays, MapPin, Settings, LogOut, Loader2, Store, Users, CreditCard, Trophy, Bell, Star, UserCheck, LayoutDashboard, Map, Wallet, Receipt, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PostCard from '@/components/feed/PostCard';
import CommentsSheet from '@/components/feed/CommentsSheet';
import TripReviewDialog from '@/components/trips/TripReviewDialog';
import { Link, useNavigate } from 'react-router-dom';
import { calcLevel } from '@/lib/achievements';

const bookingStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-primary/10 text-primary border-primary/20',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ bio: user?.bio || '', location: user?.location || '', full_name: user?.full_name || '', avatar_url: user?.avatar_url || '' });
  const [isSaving, setIsSaving] = useState(false);
  const [commentPost, setCommentPost] = useState(null);
  const [reviewTrip, setReviewTrip] = useState(null);

  const { data: savedPosts = [] } = useQuery({
    queryKey: ['saved-posts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('saved_posts').select('post_id, created_date').eq('user_id', user.id).order('created_date', { ascending: false }).limit(100);
      if (error) throw error;
      const ids = (data || []).map((r) => r.post_id);
      return ids.length ? base44.entities.Post.filter({ id: ids }, '-created_date', 100) : [];
    },
  });

  const { data: myPosts = [] } = useQuery({
    queryKey: ['my-posts', user?.id],
    queryFn: () => base44.entities.Post.filter({ author_id: user?.id }, '-created_date'),
    enabled: !!user?.id,
  });

  const { data: myTrips = [] } = useQuery({
    queryKey: ['my-trips', user?.email],
    queryFn: () => base44.entities.Trip.filter({ organizer_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my-memberships', user?.email],
    queryFn: () => base44.entities.TripMember.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: myAgencies = [] } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn: () => base44.entities.Agency.filter({ owner_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-bookings', user?.email],
    queryFn: () => base44.entities.Booking.filter({ user_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: myAchievements = [] } = useQuery({
    queryKey: ['achievements', user?.email],
    queryFn: () => base44.entities.Achievement.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: unreadNotifs = [] } = useQuery({
    queryKey: ['unread-notifs', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_email: user?.email, is_read: false }),
    enabled: !!user?.email,
  });

  const { data: myReviews = [] } = useQuery({
    queryKey: ['my-reviews', user?.email],
    queryFn: () => base44.entities.TripReview.filter({ reviewer_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: following = [] } = useQuery({
    queryKey: ['following', user?.email],
    queryFn: () => base44.entities.Follow.filter({ follower_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ['followers', user?.email],
    queryFn: () => base44.entities.Follow.filter({ following_email: user.email }),
    enabled: !!user?.email,
  });

  const reviewedTripIds = new Set(myReviews.map(r => r.trip_id));
  const completedTrips = myTrips.filter(t => t.status === 'completed' && !reviewedTripIds.has(t.id));

  const totalXp = myAchievements.reduce((sum, a) => sum + (a.xp_earned || 0), 0);
  const { level, percent, xpInLevel, xpNeeded } = calcLevel(totalXp);
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';

  const notifyAgencyOwner = async (b, title, message) => {
    try {
      const { data: ag } = await supabase.from('agencies').select('owner_email').eq('id', b.agency_id).maybeSingle();
      await notifyUser({ toEmail: ag?.owner_email, fromEmail: user.email, title, message, type: 'booking', link: '/agency-dashboard', icon: '\uD83D\uDCCB' });
    } catch (err) { console.warn('Agency notification failed:', err); }
  };

  // Only PENDING bookings can be cancelled here. Confirmed bookings involve a down payment, so the
  // user is told to message the agency instead (no refund rules are invented).
  const handleCancelBooking = async (b) => {
    if (b.status !== 'pending') return;
    if (!window.confirm(`Cancel your booking for "${b.package_title}"?`)) return;
    setBusyBookingId(b.id);
    try {
      await base44.entities.Booking.update(b.id, { status: 'cancelled' });
      await notifyAgencyOwner(b, 'Booking cancelled by guest', `${user.full_name || user.email} cancelled "${b.package_title}"${b.travel_date ? ` (${b.travel_date})` : ''}.`);
      queryClient.invalidateQueries({ queryKey: ['my-bookings', user?.email] });
    } catch (err) {
      console.error('Cancel booking failed:', err);
      alert('Could not cancel the booking. Please try again.');
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleUploadDpReceipt = async (b, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { alert('Choose an image up to 5MB.'); return; }
    setBusyBookingId(b.id);
    try {
      const url = await uploadFile(file, 'dp-receipts');
      await base44.entities.Booking.update(b.id, { dp_receipt_url: url });
      await notifyAgencyOwner(b, 'Down payment receipt uploaded', `${user.full_name || user.email} uploaded a DP receipt for "${b.package_title}".`);
      queryClient.invalidateQueries({ queryKey: ['my-bookings', user?.email] });
    } catch (err) {
      console.error('DP receipt upload failed:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setSaveError('Choose an image up to 5MB.');
      return;
    }
    setSaveError('');
    setAvatarUploading(true);
    try {
      const url = await uploadFile(file, 'avatars');
      setEditForm(p => ({ ...p, avatar_url: url }));
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setSaveError('Upload failed. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      // Only these four fields are ever sent (never role or email).
      const { bio, location, full_name, avatar_url } = editForm;
      await base44.auth.updateMe({ bio, location, full_name: full_name?.trim() || user?.full_name, avatar_url });
      await checkUserAuth?.();
      setEditOpen(false);
    } catch (err) {
      console.error('Save profile failed:', err);
      setSaveError('Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const approvedAgency = myAgencies.find(a => a.status === 'approved');

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Profile Header */}
      <div className="bg-card border rounded-2xl p-4 sm:p-6 mb-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar className="w-14 h-14 sm:w-16 sm:h-16 shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              : <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
            }
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-bold truncate">{user?.full_name}</h1>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            {user?.bio && <p className="text-sm mt-1 line-clamp-2">{user.bio}</p>}
            {user?.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 shrink-0" /> {user.location}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{user?.role || 'user'}</Badge>
              <Badge className="bg-primary/10 text-primary border-0 text-xs">Lv{level} · {totalXp} XP</Badge>
              <span className="text-xs text-muted-foreground">{myPosts.length} posts</span>
              <span className="text-xs text-muted-foreground">{following.length} following</span>
              <span className="text-xs text-muted-foreground">{followers.length} followers</span>
            </div>
          </div>
        </div>

        {/* XP Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Level {level}</span>
            <span>{xpInLevel} / {xpNeeded} XP</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Link to="/notifications">
            <Button variant="outline" className="rounded-full h-8 text-xs px-3" size="sm">
              <Bell className="w-3.5 h-3.5 mr-1" />
              Notifications
              {unreadNotifs.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                </span>
              )}
            </Button>
          </Link>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full h-8 text-xs px-3 flex-1" size="sm">
                <Settings className="w-3.5 h-3.5 mr-1" /> Edit Profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="relative w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center cursor-pointer shrink-0">
                    {editForm.avatar_url
                      ? <img src={editForm.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <Camera className="w-6 h-6 text-primary" />}
                    {avatarUploading && <span className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></span>}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                  <div className="flex-1"><Label>Display name</Label><Input value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} maxLength={60} /></div>
                </div>
                <div><Label>Bio</Label><Textarea value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} placeholder="Tell us about yourself..." className="mt-1" /></div>
                <div><Label>Location</Label><Input value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Manila, Philippines" className="mt-1" /></div>
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                <Button className="w-full rounded-full" onClick={handleSaveProfile} disabled={isSaving || avatarUploading}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="rounded-full h-8 text-xs px-3" size="sm" onClick={() => base44.auth.logout()}>
            <LogOut className="w-3.5 h-3.5 mr-1" /> Logout
          </Button>
        </div>

        {/* Agency shortcut - approved */}
        {approvedAgency && (
          <div className="mt-3 bg-secondary/10 border border-secondary/20 rounded-xl p-3 flex items-center gap-3">
            <Store className="w-5 h-5 text-secondary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{approvedAgency.name}</p>
              <p className="text-xs text-muted-foreground">Agency owner</p>
            </div>
            <Link to="/agency-dashboard">
              <Button size="sm" variant="outline" className="rounded-full text-xs h-7 shrink-0">
                <LayoutDashboard className="w-3 h-3 mr-1" /> Dashboard
              </Button>
            </Link>
          </div>
        )}

        {/* Agency shortcut - pending/rejected */}
        {!approvedAgency && myAgencies.length > 0 && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
            <Store className="w-5 h-5 text-yellow-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{myAgencies[0].name}</p>
              <p className="text-xs text-yellow-700 capitalize">Application {myAgencies[0].status}</p>
            </div>
            <Link to="/agency-register">
              <Button size="sm" variant="outline" className="rounded-full text-xs h-7 shrink-0 border-yellow-300">
                View Status
              </Button>
            </Link>
          </div>
        )}

        {/* Agency role but no registration yet */}
        {myAgencies.length === 0 && (user?.role === 'agency' || user?.role === 'admin') && (
          <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
            <Store className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Register Your Agency</p>
              <p className="text-xs text-muted-foreground">Set up your agency profile to offer tour packages</p>
            </div>
            <Link to="/agency-register">
              <Button size="sm" className="rounded-full text-xs h-7 shrink-0">
                Register
              </Button>
            </Link>
          </div>
        )}

        {/* Review nudge */}
        {completedTrips.length > 0 && (
          <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
            <Star className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Review your completed trips</p>
              <p className="text-xs text-muted-foreground">Earn XP for detailed feedback!</p>
            </div>
            <Button size="sm" className="rounded-full text-xs h-7 shrink-0" onClick={() => setReviewTrip(completedTrips[0])}>
              Review
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" onValueChange={(value) => {
        if (value === 'roadmap') {
          navigate('/roadmap');
        }
      }}>
        <TabsList className="w-full grid grid-cols-7 h-auto p-1">
          <TabsTrigger value="posts" className="text-xs py-1.5">Posts</TabsTrigger>
          <TabsTrigger value="saved" className="text-xs py-1.5">Saved</TabsTrigger>
          <TabsTrigger value="trips" className="text-xs py-1.5">Trips</TabsTrigger>
          <TabsTrigger value="bookings" className="text-xs py-1.5">Bookings</TabsTrigger>
          <TabsTrigger value="roadmap" className="text-xs py-1.5">
            <Map className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Roadmap</span>
          </TabsTrigger>
          <TabsTrigger value="following" className="text-xs py-1.5">
            <UserCheck className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Following</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="text-xs py-1.5">
            <Trophy className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Badges</span>
          </TabsTrigger>
        </TabsList>

        {/* Posts */}
        <TabsContent value="posts" className="mt-3 space-y-3">
          {myPosts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No posts yet</p>}
          {myPosts.map(post => (
            <PostCard key={post.id} post={post} onComment={setCommentPost} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['my-posts'] })} />
          ))}
        </TabsContent>

        {/* Trips */}
        {/* Saved posts */}
        <TabsContent value="saved" className="mt-3 space-y-3">
          {savedPosts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nothing saved yet. Tap the ... on a post and choose Save post.</p>}
          {savedPosts.map(post => (
            <PostCard key={post.id} post={post} onComment={setCommentPost} />
          ))}
        </TabsContent>

        <TabsContent value="trips" className="mt-3 space-y-3">
          {myTrips.length === 0 && myMemberships.length === 0 && (
            <div className="text-center py-10">
              <Mountain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No trips yet. <Link to="/trips" className="text-primary underline">Browse trips</Link></p>
            </div>
          )}
          {myTrips.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Organized by You</p>
              <div className="space-y-2">
                {myTrips.map(trip => (
                  <div key={trip.id} className="bg-card border rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/trips/${trip.id}`} className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{trip.title}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mountain className="w-3 h-3 shrink-0" />{trip.mountain_name}</p>
                        {trip.start_date && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><CalendarDays className="w-3 h-3 shrink-0" />{trip.start_date}</p>}
                      </Link>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs capitalize">{trip.status}</Badge>
                        {trip.status === 'completed' && !reviewedTripIds.has(trip.id) && (
                          <button onClick={() => setReviewTrip(trip)} className="text-[10px] text-primary underline font-medium">Write review</button>
                        )}
                        {reviewedTripIds.has(trip.id) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />Reviewed</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {myMemberships.filter(m => !myTrips.find(t => t.id === m.trip_id)).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Joined Trips</p>
              <div className="space-y-2">
                {myMemberships.filter(m => !myTrips.find(t => t.id === m.trip_id)).map(m => (
                  <Link key={m.id} to={`/trips/${m.trip_id}`} className="block">
                    <div className="bg-card border rounded-xl p-3 hover:shadow-sm flex items-center justify-between">
                      <p className="text-sm font-medium">Trip #{m.trip_id.slice(-6)}</p>
                      <Badge variant="secondary" className="text-xs capitalize">{m.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Bookings */}
        <TabsContent value="bookings" className="mt-3 space-y-3">
          {myBookings.length === 0 && (
            <div className="text-center py-10">
              <Store className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No bookings yet. <Link to="/agencies" className="text-primary underline">Browse packages</Link></p>
            </div>
          )}
          {myBookings.map(b => (
            <div key={b.id} className="bg-card border rounded-xl p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{b.package_title}</h3>

                  {/* Agency name — clickable link to agency page */}
                  {b.agency_id ? (
                    <Link
                      to={`/agencies/${b.agency_id}`}
                      className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:underline"
                    >
                      <Store className="w-3 h-3 shrink-0" />{b.agency_name}
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Store className="w-3 h-3 shrink-0" />{b.agency_name}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize shrink-0 ${bookingStatusColors[b.status] || 'bg-muted text-muted-foreground'}`}>
                  {b.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                {b.travel_date && (
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{b.travel_date}</span>
                )}
                {Number(b.num_pax) > 0 && (
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.num_pax} pax</span>
                )}
                {b.payment_method && (
                  <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{b.payment_method.replace('_', ' ')}</span>
                )}
              </div>

              {/* Price + downpayment breakdown */}
              <div className="mt-2 pt-2 border-t space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-primary">₱{b.total_price?.toLocaleString()}</p>
                  {b.status === 'pending' && (
                    <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
                  )}
                </div>

                {Number(b.downpayment_amount) > 0 && (
                  <div className="flex flex-wrap gap-x-3 text-xs">
                    <span className="text-green-700 flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      DP: ₱{b.downpayment_amount.toLocaleString()}
                    </span>
                    {b.balance_amount > 0 && (
                      <span className="text-amber-700">
                        Balance on meetup: ₱{b.balance_amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {b.status === 'pending' && b.use_downpayment && !b.dp_receipt_url && (
                <label className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-full border border-dashed border-primary/50 text-primary py-2 cursor-pointer hover:bg-primary/5">
                  {busyBookingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
                  Upload down payment receipt
                  <input type="file" accept="image/*" className="hidden" disabled={busyBookingId === b.id} onChange={(e) => handleUploadDpReceipt(b, e.target.files?.[0])} />
                </label>
              )}
              {b.status === 'pending' && (
                <Button size="sm" variant="outline" className="mt-2 w-full rounded-full h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5" disabled={busyBookingId === b.id} onClick={() => handleCancelBooking(b)}>
                  Cancel booking
                </Button>
              )}
              {b.status === 'confirmed' && (
                <p className="mt-2 text-[11px] text-muted-foreground">To cancel a confirmed booking, please message the agency.</p>
              )}

              {/* DP receipt thumbnail */}
              {b.dp_receipt_url && (
                <div className="mt-2 rounded-xl overflow-hidden border border-emerald-200">
                  <img
                    src={b.dp_receipt_url}
                    alt="Downpayment receipt"
                    className="w-full h-20 object-cover object-top"
                  />
                  <div className="px-3 py-1 bg-emerald-50 flex items-center gap-1.5 text-xs text-emerald-800">
                    <Receipt className="w-3 h-3 shrink-0" />
                    Downpayment receipt submitted
                  </div>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* Roadmap */}
        <TabsContent value="roadmap" className="mt-3" />

        {/* Following */}
        <TabsContent value="following" className="mt-3">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-card border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{following.length}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div className="bg-card border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{followers.length}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
          </div>
          {following.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Not following anyone yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Follow hikers from their posts in the Feed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">People You Follow</p>
              {following.map(f => (
                <div key={f.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{f.following_name?.[0] || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.following_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.following_email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {followers.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Your Followers</p>
              {followers.map(f => (
                <div key={f.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-secondary">{f.follower_name?.[0] || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.follower_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.follower_email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="mt-3">
          {myAchievements.length === 0 ? (
            <div className="text-center py-10">
              <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No achievements yet. Start exploring!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {myAchievements.map(a => (
                <div key={a.id} className="bg-card border rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center gap-2">
                  <span className="text-3xl">{a.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">+{a.xp_earned} XP</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CommentsSheet post={commentPost} open={!!commentPost} onOpenChange={() => setCommentPost(null)} />
      {reviewTrip && (
        <TripReviewDialog
          trip={reviewTrip}
          open={!!reviewTrip}
          onOpenChange={v => { if (!v) setReviewTrip(null); }}
          onReviewed={() => {
            queryClient.invalidateQueries({ queryKey: ['my-reviews', user?.email] });
            queryClient.invalidateQueries({ queryKey: ['achievements', user?.email] });
          }}
        />
      )}
    </div>
  );
}