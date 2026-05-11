import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function CreateTrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);

  const [form, setForm] = useState({
    mountain_id: urlParams.get('mountain') || null,
    mountain_name: urlParams.get('name') || '',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    max_participants: 10,
    difficulty: '',
    price: '',
    is_public: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: mountains = [] } = useQuery({
    queryKey: ['mountains-select'],
    queryFn: () => base44.entities.Mountain.list('name', 200),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const mountain = mountains.find(m => m.id === form.mountain_id);

      const trip = await base44.entities.Trip.create({
        organizer_id: authUser.id,
        mountain_id: form.mountain_id || null,
        mountain_name: mountain?.name || form.mountain_name,
        title: form.title,
        description: form.description,
        start_date: form.start_date,
        end_date: form.end_date || null,
        max_participants: Number(form.max_participants),
        current_participants: 1,
        difficulty: form.difficulty || null,
        price: form.price ? Number(form.price) : null,
        is_public: form.is_public,
        status: 'open',
      });

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
          <Input placeholder="e.g. Mt. Pulag Sunrise Hike" value={form.title} onChange={e => updateField('title', e.target.value)} required />
        </div>

        <div>
          <Label>Mountain</Label>
          <Select value={form.mountain_id || ''} onValueChange={v => updateField('mountain_id', v)}>
            <SelectTrigger><SelectValue placeholder="Select a mountain" /></SelectTrigger>
            <SelectContent>
              {mountains.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea placeholder="Trip details, what to bring, etc." value={form.description} onChange={e => updateField('description', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)} required />
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

        <div className="flex items-center justify-between py-2">
          <Label>Public Trip (anyone can join)</Label>
          <Switch checked={form.is_public} onCheckedChange={v => updateField('is_public', v)} />
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