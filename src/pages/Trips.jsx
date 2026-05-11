import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Plus, Loader2, Mountain, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';

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
      id,
      organizer_id,
      mountain_name,
      title,
      description,
      start_date,
      end_date,
      max_participants,
      current_participants,
      difficulty,
      price,
      status,
      is_public,
      created_date,
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
  const [tab, setTab] = useState('all');

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

  const filtered = tab === 'all'
    ? trips.filter(t => t.is_public !== false)
    : trips.filter(t => t.organizer_id === user?.id || myTripIds.has(t.id));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Hiking Trips</h1>
          <p className="text-muted-foreground text-sm">Plan and join group adventures</p>
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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No trips yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first hiking trip!</p>
          <Button variant="outline" onClick={() => navigate('/trips/new')}>Create Trip</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(trip => {
            const organizerName = trip.profiles?.full_name || trip.profiles?.email || 'Unknown';
            return (
              <Link key={trip.id} to={`/trips/${trip.id}`}>
                <div className="bg-card border rounded-2xl p-5 hover:shadow-md transition-all">
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
                    by {organizerName}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}