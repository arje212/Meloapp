import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Mountain, CalendarDays, Users, Wallet, Loader2, Check, HelpCircle, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { unlockAchievement } from '@/lib/achievements';
import TripReviewSection from '@/components/trips/TripReviewSection';
import TripBookingSection from '@/components/trips/TripBookingSection';

const statusIcons = { going: Check, maybe: HelpCircle, not_going: X, invited: HelpCircle };
const statusColors = { going: 'text-green-600', maybe: 'text-yellow-600', not_going: 'text-red-600', invited: 'text-muted-foreground' };

export default function TripDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tripId = window.location.pathname.split('/trips/')[1];

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const list = await base44.entities.Trip.filter({ id: tripId });
      return list[0];
    },
    enabled: !!tripId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: () => base44.entities.TripMember.filter({ trip_id: tripId }),
    enabled: !!tripId,
  });

  const myMembership = members.find(m => m.user_email === user?.email);

  const handleJoin = async (status) => {
    if (myMembership) {
      await base44.entities.TripMember.update(myMembership.id, { status });
    } else {
      await base44.entities.TripMember.create({
        trip_id: tripId,
        user_email: user.email,
        user_name: user.full_name,
        status,
        role: 'member',
      });
      if (status === 'going') {
        unlockAchievement(user.email, user.full_name, 'first_mountain');
      }
    }
    queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!trip) return <div className="text-center py-20"><p>Trip not found</p></div>;

  const goingCount = members.filter(m => m.status === 'going').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-card border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4 gap-2">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex-1">{trip.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Badge>{trip.status}</Badge>
            {user?.email !== trip.organizer_email && (
              <Button variant="outline" size="sm" className="rounded-full h-8 text-xs" onClick={async () => {
                const existing = await base44.entities.ChatRoom.filter({ type: 'direct' });
                const mine = existing.find(r => r.participants?.includes(user.email) && r.participants?.includes(trip.organizer_email));
                if (mine) { navigate(`/chat/${mine.id}`); return; }
                const room = await base44.entities.ChatRoom.create({ type: 'direct', participants: [user.email, trip.organizer_email], participant_names: [user.full_name, trip.organizer_name || trip.organizer_email], name: `${trip.title} Chat` });
                navigate(`/chat/${room.id}`);
              }}>
                <MessageCircle className="w-3 h-3 mr-1" /> Message Organizer
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
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
        </div>

        {trip.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trip.description}</p>
        )}
      </div>

      {/* RSVP */}
      {trip.status === 'open' && (
        <div className="bg-card border rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-3">Your Response</h3>
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
        </div>
      )}

      {/* Members */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold mb-4">Participants ({members.length})</h3>
        <div className="space-y-3">
          {members.map(m => {
            const Icon = statusIcons[m.status] || HelpCircle;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{m.user_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.user_name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                <Icon className={`w-4 h-4 ${statusColors[m.status] || ''}`} />
                <span className={`text-xs capitalize ${statusColors[m.status] || ''}`}>{m.status?.replace('_', ' ')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Book a package for this trip */}
      <TripBookingSection trip={trip} />

      {/* Reviews */}
      <TripReviewSection trip={trip} members={members} />
    </div>
  );
}