import { useState } from 'react';
import { todayStr } from '@/lib/plans';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function CreateTrip() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const urlParams   = new URLSearchParams(window.location.search);

  const [form, setForm] = useState({
    mountain_id:      urlParams.get('mountain') || null,
    mountain_name:    urlParams.get('name')     || '',
    title:            '',
    description:      '',
    start_date:       '',
    end_date:         '',
    max_participants: 10,
    difficulty:       '',
    price:            '',
    is_public:        false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState('');

  const { data: mountains = [] } = useQuery({
    queryKey: ['mountains-select'],
    queryFn:  () => base44.entities.Mountain.list('name', 200),
  });

  const { data: myAgencies = [] } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn:  () => base44.entities.Agency.filter({ owner_email: user.email }),
    enabled:  !!user?.email,
  });

  const myAgency    = myAgencies.find(a => a.status === 'approved');
  const isAgencyTrip = !!myAgency;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); setError('');
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const mountain = mountains.find(m => m.id === form.mountain_id);

      // 1. Create the trip
      const trip = await base44.entities.Trip.create({
        organizer_id:     authUser.id,
        organizer_email:  user.email,
        organizer_name:   isAgencyTrip ? myAgency.name : (user.full_name || user.email),
        agency_id:        isAgencyTrip ? myAgency.id   : undefined,
        agency_name:      isAgencyTrip ? myAgency.name : undefined,
        mountain_id:      form.mountain_id   || null,
        mountain_name:    mountain?.name     || form.mountain_name,
        title:            form.title,
        description:      form.description,
        start_date:       form.start_date,
        end_date:         form.end_date      || null,
        max_participants: Number(form.max_participants),
        current_participants: 1,
        difficulty:       form.difficulty    || null,
        price:            form.price ? Number(form.price) : null,
        is_public:        isAgencyTrip ? true : !!form.is_public,
        status:           'open',
      });

      // 2. Add organizer as first member
      try {
        await base44.entities.TripMember.create({
          trip_id:    trip.id,
          user_email: user.email,
          user_name:  user.full_name || (isAgencyTrip ? myAgency.name : user.email),
          status:     'going',
          role:       'organizer',
        });
      } catch (memberErr) {
        console.warn('Organizer membership could not be created:', memberErr);
      }

      // 3. AUTO-CREATE group chat for the trip
      try {
        await base44.entities.ChatRoom.create({
          type:              'group',
          trip_id:           trip.id,
          trip_title:        trip.title,
          name:              `${mountain?.name || form.mountain_name || trip.title} Trip`,
          participants:      [user.email],
          participant_names: [user.full_name || (isAgencyTrip ? myAgency.name : user.email)],
          last_message:      '🏔️ Trip group chat created! Invite your members.',
          last_message_time: new Date().toISOString(),
          created_by:        user.email,
          is_group:          true,
        });
      } catch (chatErr) {
        console.warn('Auto group chat creation failed:', chatErr);
      }

      navigate('/trips');
    } catch (err) {
      console.error('Create trip error:', err);
      setError(err.message || JSON.stringify(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="font-display text-2xl font-bold mb-6">Create a Trip</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Trip Name</Label>
          <Input
            placeholder="e.g. La Union beach weekend, Mt. Pulag sunrise"
            value={form.title}
            onChange={e => updateField('title', e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Destination</Label>
          <Select value={form.mountain_id || ''} onValueChange={v => updateField('mountain_id', v)}>
            <SelectTrigger><SelectValue placeholder="Select a saved destination" /></SelectTrigger>
            <SelectContent>
              {mountains.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            placeholder="Trip details, itinerary, what to bring, meeting point, etc."
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <Input type="date" min={todayStr()} value={form.start_date} onChange={e => updateField('start_date', e.target.value)} required />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={form.end_date} onChange={e => updateField('end_date', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Max Participants</Label>
            <Input type="number" min={1} value={form.max_participants} onChange={e => updateField('max_participants', Number(e.target.value))} />
          </div>
          <div>
            <Label>Price (PHP) <span className="text-muted-foreground text-xs">optional</span></Label>
            <Input type="number" placeholder="0" value={form.price} onChange={e => updateField('price', e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Difficulty <span className="text-muted-foreground text-xs">optional</span></Label>
          <Select value={form.difficulty} onValueChange={v => updateField('difficulty', v)}>
            <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <Label htmlFor="trip-public">{isAgencyTrip || form.is_public ? 'Public trip' : 'Private trip'}</Label>
            <p className="text-xs text-muted-foreground">
              {isAgencyTrip
                ? 'Agency trips are automatically visible to everyone.'
                : form.is_public
                  ? 'Everyone can see it in Trips and the Feed, and can join.'
                  : 'Only you and the people you invite can see it.'}
            </p>
          </div>
          <Switch
            id="trip-public"
            checked={isAgencyTrip ? true : !!form.is_public}
            disabled={isAgencyTrip}
            onCheckedChange={(v) => updateField('is_public', v)}
          />
        </div>

        {/* Info about auto group chat */}
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5 text-xs text-primary">
          <span className="text-base shrink-0">💬</span>
          <span>A group chat will be automatically created for this trip. Members who RSVP as "going" will be auto-added.</span>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Trip
        </Button>
      </form>
    </div>
  );
}