import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Archive, CalendarDays, Plus, Loader2, Mountain, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { isTripExpired } from '@/lib/tripDates';

const statusColors = {
  planning: 'bg-blue-100 text-blue-700',
  open: 'bg-green-100 text-green-700',
  full: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-700',
};

async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      profiles (
        full_name,
        email,
        avatar_url
      )
    `)
    .order('start_date', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

async function fetchMyMemberships(userEmail) {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_email', userEmail);
  if (error) return [];
  return data || [];
}

export default function Trips() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');
  const [archivingTripId, setArchivingTripId] = useState(null);
  const [tripActionError, setTripActionError] = useState('');
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setToday(new Date()), nextDay.getTime() - now.getTime() + 50);
    return () => window.clearTimeout(timer);
  }, [today]);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: fetchTrips,
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my-memberships', user?.email],
    queryFn: () => fetchMyMemberships(user.email),
    enabled: !!user?.email,
  });

  const myTripIds = new Set(myMemberships.map(m => m.trip_id));

  const handleArchiveTrip = async (trip) => {
    if (trip.organizer_id !== user?.id) return;
    if (!window.confirm(`Mark "${trip.title}" as completed and remove it from public trips? The trip history and chat will be kept.`)) return;
    setArchivingTripId(trip.id);
    setTripActionError('');
    try {
      await base44.entities.Trip.update(trip.id, { status: 'completed', is_public: false });
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      await queryClient.invalidateQueries({ queryKey: ['my-trips'] });
      await queryClient.invalidateQueries({ queryKey: ['agency-trips'] });
    } catch (error) {
      setTripActionError(error.message || 'Could not archive this trip.');
    } finally {
      setArchivingTripId(null);
    }
  };

  const filtered = trips.filter(trip => {
    if (isTripExpired(trip, today)) return false;
    if (tab === 'all') return trip.is_public !== false;
    return (trip.organizer_id === user?.id || myTripIds.has(trip.id)) &&
      !(trip.organizer_id === user?.id && trip.status === 'completed' && trip.is_public === false);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Trips</h1>
          <p className="text-muted-foreground text-sm">Plan and join beach, city, mountain, and group adventures</p>
        </div>
        <Button className="rounded-full" onClick={() => navigate('/trips/new')}>
          <Plus className="w-4 h-4 mr-2" /> New Trip
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Trips</TabsTrigger>
          <TabsTrigger value="mine">My Trips</TabsTrigger>
        </TabsList>
      </Tabs>

      {tripActionError && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {tripActionError}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No trips yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first travel plan!</p>
          <Button variant="outline" onClick={() => navigate('/trips/new')}>Create Trip</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(trip => {
            const organizerName = trip.agency_name || trip.organizer_name || trip.profiles?.full_name || trip.profiles?.email || 'Unknown';
            const organizerLabel = trip.agency_name ? `by agency ${trip.agency_name}` : `by ${organizerName}`;
            return (
              <div key={trip.id} className="bg-card border rounded-2xl p-5 hover:shadow-md transition-all">
                <Link to={`/trips/${trip.id}`} className="block">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-base">{trip.title}</h3>
                    <Badge className={statusColors[trip.status] || ''}>{trip.status}</Badge>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mountain className="w-4 h-4" />
                      <span>{trip.mountain_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      <span>{trip.start_date ? format(new Date(trip.start_date), 'MMM d, yyyy') : 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Max {trip.max_participants || '∞'} participants</span>
                    </div>
                  </div>
                  {/* ✅ organizer name from profiles JOIN */}
                  <p className="text-xs text-muted-foreground mt-3">
                    {organizerLabel}
                  </p>
                </Link>
                {tab === 'mine' && trip.organizer_id === user?.id && (trip.status !== 'completed' || trip.is_public !== false) && (
                  <div className="mt-4 border-t pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10 w-full rounded-xl"
                      onClick={() => handleArchiveTrip(trip)}
                      disabled={archivingTripId === trip.id}
                    >
                      {archivingTripId === trip.id
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Archive className="w-4 h-4 mr-2" />}
                      Mark completed & remove from public trips
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
