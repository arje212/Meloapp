import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft, Mountain, CalendarDays, Users, Wallet, Loader2,
  Check, HelpCircle, X, MessageCircle, UserPlus, Store, AlertCircle,
  MessagesSquare, Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { unlockAchievement } from '@/lib/achievements';
import TripReviewSection from '@/components/trips/TripReviewSection';
import TripBookingSection from '@/components/trips/TripBookingSection';
import TripChecklist from '@/components/trips/TripChecklist';
import TripWeather from '@/components/trips/TripWeather';
import TripAnnouncements from '@/components/trips/TripAnnouncements';
import TripExpenses from '@/components/trips/TripExpenses';
import TripEmergencyContacts from '@/components/trips/TripEmergencyContacts';
import TripGallery from '@/components/trips/TripGallery';
import TripPaymentSetup from '@/components/trips/TripPaymentSetup';
import TripPaymentUser from '@/components/trips/TripPaymentUser';
import TripPaymentMonitor from '@/components/trips/TripPaymentMonitor';
import {
  shareRsvpGoingToFeed,
  shareTripManually,
} from '@/lib/TripFeedShare';

const statusIcons  = { going: Check, maybe: HelpCircle, not_going: X, invited: HelpCircle };
const statusColors = {
  going:     'text-green-600',
  maybe:     'text-yellow-600',
  not_going: 'text-red-600',
  invited:   'text-muted-foreground',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendNotification({ userEmail, title, message, type = 'system', link = '', icon = '🔔' }) {
  try {
    await supabase.from('notifications').insert({
      user_email: userEmail,
      title,
      message,
      type,
      link,
      icon,
      is_read: false,
    });
  } catch (err) {
    console.warn('Notification send failed:', err);
  }
}

/**
 * Get the existing group chat for a trip, or create one if it doesn't exist yet.
 * Auto-adds all current "going" members as participants.
 */
async function getOrCreateTripGroupChat(trip, members, currentUser) {
  const goingMembers = members.filter(m => m.status === 'going');

  // Check if a group chat already exists for this trip
  const allRooms = await base44.entities.ChatRoom.filter({ trip_id: trip.id }, '-updated_date', 200);
  const existing = allRooms.find(r => r.trip_id === trip.id && r.type === 'group');
  if (existing) return existing;

  // Build unique participant list
  const participantEmails = [
    ...new Set([
      trip.organizer_email,
      currentUser.email,
      ...goingMembers.map(m => m.user_email).filter(Boolean),
    ]),
  ].filter(Boolean);

  const participantNames = participantEmails.map(email => {
    if (email === currentUser.email)    return currentUser.full_name || email;
    if (email === trip.organizer_email) return trip.organizer_name || trip.agency_name || email;
    const m = members.find(m => m.user_email === email);
    return m?.user_name || email;
  });

  return base44.entities.ChatRoom.create({
    type:              'group',
    trip_id:           trip.id,
    trip_title:        trip.title,
    name:              `${trip.mountain_name || trip.title} Trip`,
    participants:      participantEmails,
    participant_names: participantNames,
    last_message:      'Group chat created 🏔️',
    last_message_time: new Date().toISOString(),
  });
}

/**
 * Add a single member to the existing trip group chat (if it exists).
 */
async function addMemberToTripGroupChat(trip, memberEmail, memberName) {
  try {
    const allRooms = await base44.entities.ChatRoom.filter({ trip_id: trip.id }, '-updated_date', 200);
    const groupChat = allRooms.find(r => r.trip_id === trip.id && r.type === 'group');
    if (!groupChat || groupChat.participants?.includes(memberEmail)) return;
    await base44.entities.ChatRoom.update(groupChat.id, {
      participants:      [...(groupChat.participants      || []), memberEmail],
      participant_names: [...(groupChat.participant_names || []), memberName],
    });
  } catch (err) {
    console.warn('Failed to add member to group chat:', err);
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TripDetail() {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const queryClient  = useQueryClient();
  const { id: tripId } = useParams();   // was parsed from window.location, which broke on a trailing slash

  const [inviteEmail,        setInviteEmail]        = useState('');
  const [inviteName,         setInviteName]         = useState('');
  const [inviteError,        setInviteError]        = useState('');
  const [isInviting,         setIsInviting]         = useState(false);
  const [isMessaging,        setIsMessaging]        = useState(false);
  const [isCreatingGroupChat,setIsCreatingGroupChat]= useState(false);
  const [isSharing,          setIsSharing]          = useState(false);
  const [shareSuccess,       setShareSuccess]       = useState(false);
  const [joinError,          setJoinError]          = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['trip-members', tripId],
    queryFn:  () => base44.entities.TripMember.filter({ trip_id: tripId }),
    enabled:  !!tripId,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const myMembership      = members.find(m => m.user_email === user?.email);
  const isOrganizer       = user?.email === trip?.organizer_email;
  const canAccessGroupChat= isOrganizer || myMembership?.status === 'going';
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');
  const isPublicTrip = trip?.is_public !== false;
  // Organizer can switch a personal trip between public and private any time (agency trips stay public)
  const handleVisibility = async (makePublic) => {
    setVisibilityBusy(true); setVisibilityError('');
    try {
      await base44.entities.Trip.update(trip.id, { is_public: makePublic });
      await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (err) {
      console.error('Trip visibility update failed:', err);
      setVisibilityError('Hindi ma-update ang visibility. Subukan ulit.');
    } finally {
      setVisibilityBusy(false);
    }
  };
  const goingCount        = members.filter(m => m.status === 'going').length;
  const organizerName     = trip?.agency_name || trip?.organizer_name || trip?.organizer_email || 'Unknown organizer';
  const organizerEmail    = trip?.organizer_email;

  // ── RSVP ──────────────────────────────────────────────────────────────────
  const handleJoin = async (status) => {
    setJoinError('');
    const alreadyGoing = myMembership?.status === 'going';
    if (status === 'going' && !alreadyGoing && trip?.max_participants && goingCount >= Number(trip.max_participants)) {
      setJoinError(`This trip is full (${goingCount}/${trip.max_participants}).`);
      return;
    }
    try {
    const wasAlreadyGoing = myMembership?.status === 'going';

    if (myMembership) {
      await base44.entities.TripMember.update(myMembership.id, { status });
    } else {
      await base44.entities.TripMember.create({
        trip_id:    tripId,
        user_email: user.email,
        user_name:  user.full_name,
        status,
        role: 'member',
      });
      if (status === 'going') {
        unlockAchievement(user.email, user.full_name, 'first_mountain');
      }
    }

    // First time marking "going"
    if (status === 'going' && !wasAlreadyGoing && trip) {
      await Promise.all([
        // Auto-add to group chat
        addMemberToTripGroupChat(trip, user.email, user.full_name || user.email),
        // Share RSVP to feed
        shareRsvpGoingToFeed({ trip, user }),
      ]);

      // Notify the member they joined the chat
      await sendNotification({
        userEmail: user.email,
        title:     '👥 You joined the trip group chat!',
        message:   `You've been added to the group chat for "${trip.title}". Open the trip to access it.`,
        type:      'system',
        link:      `/trips/${tripId}`,
        icon:      '👥',
      });

      // Notify organizer someone is going
      await sendNotification({
        userEmail: trip.organizer_email,
        title:     '🎉 New member joining!',
        message:   `${user.full_name || user.email} is going on "${trip.title}".`,
        type:      'system',
        link:      `/trips/${tripId}`,
        icon:      '🎉',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
    } catch (err) {
      console.error('RSVP failed:', err);
      setJoinError(/full/i.test(err?.message || '') ? 'This trip is already full.' : 'Could not save your response. Please try again.');
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
    }
  };

  // ── Share to feed ──────────────────────────────────────────────────────────
  const handleShareToFeed = async () => {
    if (!trip || isSharing) return;
    setIsSharing(true);
    try {
      await shareTripManually({ trip, user });
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setIsSharing(false);
    }
  };

  // ── Invite ─────────────────────────────────────────────────────────────────
  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setIsInviting(true); setInviteError('');
    try {
      const existing = members.find(m => m.user_email?.toLowerCase() === email);
      if (existing) {
        await base44.entities.TripMember.update(existing.id, { status: 'invited', role: existing.role || 'member' });
      } else {
        await base44.entities.TripMember.create({
          trip_id:    tripId,
          user_email: email,
          user_name:  inviteName.trim() || email,
          status:     'invited',
          role:       'member',
        });
      }

      // Notify the invited user
      await sendNotification({
        userEmail: email,
        title:     `🏔️ You're invited to a trip!`,
        message:   `${organizerName} invited you to join "${trip?.title}". Click to view details.`,
        type:      'system',
        link:      `/trips/${tripId}`,
        icon:      '🏔️',
      });

      setInviteEmail(''); setInviteName('');
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
      queryClient.invalidateQueries({ queryKey: ['my-memberships', email] });
    } catch (error) {
      setInviteError(error.message || 'Unable to invite user.');
    } finally {
      setIsInviting(false);
    }
  };

  // ── Message organizer (DM) ─────────────────────────────────────────────────
  const handleMessageOrganizer = async () => {
    if (!organizerEmail || !user?.email) return;
    setIsMessaging(true);
    try {
      const allRooms = await base44.entities.ChatRoom.filter({ trip_id: tripId }, '-updated_date', 200);
      const existingRoom = allRooms.find(r =>
        r.trip_id === tripId &&
        r.type !== 'group' &&
        r.participants?.includes(user.email) &&
        r.participants?.includes(organizerEmail)
      );
      if (existingRoom) { navigate(`/chat/${existingRoom.id}`); return; }
      const room = await base44.entities.ChatRoom.create({
        type:              'direct',
        trip_id:           tripId,
        trip_title:        trip.title,
        participants:      [user.email, organizerEmail],
        participant_names: [user.full_name || user.email, organizerName],
        name:              organizerName,
        last_message:      `Inquiry about: ${trip.title}`,
        last_message_time: new Date().toISOString(),
      });
      navigate(`/chat/${room.id}`);
    } catch (err) {
      console.error('Message organizer error:', err);
    } finally {
      setIsMessaging(false);
    }
  };

  // ── Trip group chat ────────────────────────────────────────────────────────
  const handleOpenGroupChat = async () => {
    if (!trip) return;
    setIsCreatingGroupChat(true);
    try {
      const room = await getOrCreateTripGroupChat(trip, members, user);
      navigate(`/chat/${room.id}`);
    } catch (err) {
      console.error('Group chat error:', err);
    } finally {
      setIsCreatingGroupChat(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
  if (!trip) return <div className="text-center py-20"><p>Trip not found</p></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* ── Trip info card ── */}
      <div className="bg-card border rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-2">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex-1">{trip.title}</h1>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Badge>{trip.status}</Badge>
            {organizerEmail && user?.email !== organizerEmail && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-8 text-xs"
                onClick={handleMessageOrganizer}
                disabled={isMessaging}
              >
                {isMessaging
                  ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  : <MessageCircle className="w-3 h-3 mr-1" />}
                Message Organizer
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            {trip.agency_name
              ? <Store className="w-4 h-4 text-primary" />
              : <Users className="w-4 h-4 text-primary" />}
            <span>{trip.agency_name ? `Agency: ${trip.agency_name}` : `Organizer: ${organizerName}`}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mountain className="w-4 h-4 text-primary" />
            <span>{trip.mountain_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span>{trip.start_date ? format(new Date(trip.start_date), 'MMM d, yyyy') : 'TBD'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span>{goingCount}/{trip.max_participants || '∞'} going</span>
          </div>
          {trip.budget_estimate && (
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-primary" />
              <span>₱{trip.budget_estimate?.toLocaleString()}</span>
            </div>
          )}
          {Number(trip.price) > 0 && trip.payment_required && (
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-green-600" />
              <span className="text-green-700 font-medium">Fee: ₱{Number(trip.price).toLocaleString()}</span>
            </div>
          )}
        </div>

        {trip.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{trip.description}</p>
        )}

        {/* Share to feed */}
        <div className="border-t pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Share this trip to your feed</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-8 text-xs gap-1.5"
            onClick={handleShareToFeed}
            disabled={isSharing || shareSuccess}
          >
            {isSharing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : shareSuccess
                ? <Check className="w-3 h-3 text-green-500" />
                : <Share2 className="w-3 h-3" />}
            {shareSuccess ? 'Shared!' : 'Share to Feed'}
          </Button>
        </div>
      </div>

      {/* ── Trip Group Chat ── */}
      {canAccessGroupChat && (
        <div className="bg-card border rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessagesSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Trip Group Chat</p>
                <p className="text-xs text-muted-foreground">
                  {isOrganizer
                    ? 'Manage the trip group chat. Going members are auto-added.'
                    : 'Chat with fellow hikers and the organizer.'}
                </p>
              </div>
            </div>
            <Button
              className="rounded-full shrink-0"
              size="sm"
              onClick={handleOpenGroupChat}
              disabled={isCreatingGroupChat}
            >
              {isCreatingGroupChat
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <MessagesSquare className="w-4 h-4 mr-2" />}
              Open Chat
            </Button>
          </div>

          {isOrganizer && goingCount > 0 && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {goingCount} going member{goingCount !== 1 ? 's' : ''} in the chat:
              </span>
              <div className="flex -space-x-2">
                {members.filter(m => m.status === 'going').slice(0, 6).map(m => (
                  <Avatar key={m.id} className="w-6 h-6 ring-2 ring-background">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {m.user_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {goingCount > 6 && (
                  <div className="w-6 h-6 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
                    +{goingCount - 6}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Announcements ── */}
      <TripAnnouncements trip={trip} isOrganizer={isOrganizer} />

      {/* ── Weather ── */}
      <TripWeather trip={trip} />

      {/* ── Payment Setup (organizer) ── */}
      <TripPaymentSetup trip={trip} isOrganizer={isOrganizer} />

      {/* ── Payment Monitor (organizer sees all member payments) ── */}
      <TripPaymentMonitor trip={trip} members={members} isOrganizer={isOrganizer} />

      {/* ── Payment Upload (member) ── */}
      {!isOrganizer && myMembership?.status === 'going' && (
        <TripPaymentUser trip={trip} />
      )}

      {/* ── RSVP ── */}
      {trip.status === 'open' && (
        <div className="bg-card border rounded-2xl p-5 mt-4">
          <h3 className="font-semibold mb-3">Your response</h3>
          {joinError && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 mb-2">{joinError}</p>}
          <div className="flex gap-2">
            {['going', 'maybe', 'not_going'].map(s => (
              <Button
                key={s}
                variant={myMembership?.status === s ? 'default' : 'outline'}
                className="flex-1 rounded-full capitalize"
                onClick={() => handleJoin(s)}
              >
                {s.replace('_', ' ')}
              </Button>
            ))}
          </div>
          {!myMembership && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              💬 RSVP as <strong>going</strong> to join the group chat &amp; share to your feed
            </p>
          )}
          {myMembership?.status === 'going' && (
            <p className="text-xs text-green-600 mt-2 text-center">
              ✓ You're in the trip group chat
            </p>
          )}
          {myMembership?.status === 'going' && trip.payment_required && (
            <p className="text-xs text-amber-600 mt-1 text-center">
              ⚠ This trip requires payment. Please upload your GCash receipt below.
            </p>
          )}
        </div>
      )}

      {/* ── Visibility ── */}
      {isOrganizer && !trip?.agency_id && (
        <div className="bg-card border rounded-2xl p-5 mt-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">{isPublicTrip ? 'Public trip' : 'Private trip'}</h3>
            <p className="text-xs text-muted-foreground">
              {isPublicTrip
                ? 'Makikita ng lahat sa Trips at Feed, at puwede silang sumali.'
                : 'Ikaw at ang mga inimbitahan mo lang ang makakakita.'}
            </p>
            {visibilityError && <p className="mt-1 text-xs text-destructive">{visibilityError}</p>}
          </div>
          <Switch checked={isPublicTrip} disabled={visibilityBusy} onCheckedChange={handleVisibility} aria-label="Public trip" />
        </div>
      )}

      {/* ── Invite ── */}
      {isOrganizer && (
        <div className="bg-card border rounded-2xl p-5 mt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Invite user
          </h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              type="email"
              placeholder="user@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <Input
              placeholder="Name (optional)"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
            />
            <Button
              className="rounded-full"
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || isInviting}
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </div>
          {inviteError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3" /> {inviteError}
            </p>
          )}
        </div>
      )}

      {/* ── Members ── */}
      <div className="bg-card border rounded-2xl p-5 mt-4">
        <h3 className="font-semibold mb-4">Participants ({members.length})</h3>
        <div className="space-y-3">
          {members.map(m => {
            const Icon = statusIcons[m.status] || HelpCircle;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {m.user_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.user_name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                <Icon className={`w-4 h-4 ${statusColors[m.status] || ''}`} />
                <span className={`text-xs capitalize ${statusColors[m.status] || ''}`}>
                  {m.status?.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Packing checklist ── */}
      <TripChecklist trip={trip} />

      {/* ── Emergency contacts ── */}
      <TripEmergencyContacts trip={trip} members={members} isOrganizer={isOrganizer} />

      {/* ── Expense tracker ── */}
      <TripExpenses trip={trip} members={members} isOrganizer={isOrganizer} />

      {/* ── Tour package booking ── */}
      <TripBookingSection trip={trip} />

      {/* ── Gallery ── */}
      <TripGallery trip={trip} members={members} />

      {/* ── Reviews ── */}
      <TripReviewSection trip={trip} members={members} />
    </div>
  );
}