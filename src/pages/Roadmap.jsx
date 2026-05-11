import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Map, Target, CheckCircle2, Clock, Loader2, Globe, Lock, Trash2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { unlockAchievement } from '@/lib/achievements';
import AchievementPopup from '@/components/achievements/AchievementPopup';

const statusConfig = {
  planned: { label: 'Planned', color: 'bg-blue-100 text-blue-700', icon: Clock },
  ongoing: { label: 'Ongoing', color: 'bg-yellow-100 text-yellow-700', icon: Target },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

export default function Roadmap() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [tab, setTab] = useState('my'); // 'my' | 'public'
  const [form, setForm] = useState({ title: '', description: '', status: 'planned', is_public: true, target_year: new Date().getFullYear() + 1, destinations: [] });
  const [destInput, setDestInput] = useState({ name: '', target_date: '', notes: '' });

  const { data: myRoadmaps = [], isLoading: loadingMine } = useQuery({
    queryKey: ['roadmaps', 'mine'],
    queryFn: () => base44.entities.Roadmap.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: publicRoadmaps = [], isLoading: loadingPublic } = useQuery({
    queryKey: ['roadmaps', 'public'],
    queryFn: () => base44.entities.Roadmap.filter({ is_public: true }, '-created_date', 20),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Roadmap.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['roadmaps'] });
      setShowCreate(false);
      setForm({ title: '', description: '', status: 'planned', is_public: true, target_year: new Date().getFullYear() + 1, destinations: [] });
      // Achievement
      if (myRoadmaps.length === 0) {
        const a = await unlockAchievement(user.email, user.full_name, 'first_roadmap');
        if (a) setNewAchievement(a);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Roadmap.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmaps'] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Roadmap.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmaps'] }),
  });

  const addDestination = () => {
    if (!destInput.name) return;
    setForm(f => ({ ...f, destinations: [...(f.destinations || []), { ...destInput, status: 'planned' }] }));
    setDestInput({ name: '', target_date: '', notes: '' });
  };

  const removeDestination = (i) => {
    setForm(f => ({ ...f, destinations: f.destinations.filter((_, idx) => idx !== i) }));
  };

  const handleCreate = () => {
    const progress = form.destinations.length
      ? Math.round((form.destinations.filter(d => d.status === 'completed').length / form.destinations.length) * 100)
      : 0;
    createMutation.mutate({ ...form, user_email: user.email, user_name: user.full_name, progress_percent: progress });
  };

  const displayList = tab === 'my' ? myRoadmaps : publicRoadmaps;
  const isLoading = tab === 'my' ? loadingMine : loadingPublic;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AchievementPopup achievement={newAchievement} onClose={() => setNewAchievement(null)} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Adventure Roadmaps</h1>
          <p className="text-sm text-muted-foreground">Plan your hiking and travel goals</p>
        </div>
        <Button className="rounded-full" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Roadmap
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['my', 'public'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'my' ? 'My Roadmaps' : 'Community'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-16">
          <Map className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">{tab === 'my' ? "No roadmaps yet" : "No public roadmaps"}</h3>
          <p className="text-sm text-muted-foreground mb-4">{tab === 'my' ? "Create your first adventure plan" : "Be the first to share yours"}</p>
          {tab === 'my' && <Button className="rounded-full" onClick={() => setShowCreate(true)}>Create Roadmap</Button>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayList.map(rm => {
            const sc = statusConfig[rm.status];
            const Icon = sc.icon;
            const isOwner = rm.user_email === user?.email;
            return (
              <div key={rm.id} className="bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-all">
                {rm.cover_image && <img src={rm.cover_image} alt="" className="w-full h-32 object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{rm.title}</h3>
                        {rm.is_public ? <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </div>
                      {rm.user_name && tab === 'public' && (
                        <p className="text-xs text-muted-foreground mt-0.5">by {rm.user_name}</p>
                      )}
                      {rm.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{rm.description}</p>}
                    </div>
                    <Badge className={`${sc.color} border-0 shrink-0 text-xs`}>
                      <Icon className="w-3 h-3 mr-1" />{sc.label}
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{rm.destinations?.length || 0} destinations</span>
                      <span>{rm.progress_percent || 0}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${rm.progress_percent || 0}%` }} />
                    </div>
                  </div>

                  {/* Destinations preview */}
                  {rm.destinations?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rm.destinations.slice(0, 3).map((d, i) => (
                        <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full border ${d.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground'}`}>
                          {d.status === 'completed' ? '✓ ' : ''}{d.name}
                        </span>
                      ))}
                      {rm.destinations.length > 3 && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">+{rm.destinations.length - 3}</span>}
                    </div>
                  )}

                  {isOwner && (
                    <div className="flex gap-2 mt-3">
                      <Select value={rm.status} onValueChange={v => updateStatusMutation.mutate({ id: rm.id, status: v })}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(rm.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Adventure Roadmap</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Top Mountains of Luzon 2026" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="What's this adventure about?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Year</Label>
                <Input type="number" value={form.target_year} onChange={e => setForm(f => ({ ...f, target_year: Number(e.target.value) }))} min={2025} max={2035} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="public" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <Label htmlFor="public">Make this roadmap public</Label>
            </div>

            {/* Destinations */}
            <div>
              <Label>Destinations / Mountains</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="Destination name" value={destInput.name} onChange={e => setDestInput(d => ({ ...d, name: e.target.value }))} />
                <Input type="date" value={destInput.target_date} onChange={e => setDestInput(d => ({ ...d, target_date: e.target.value }))} className="w-36" />
                <Button type="button" size="icon" variant="outline" onClick={addDestination}><Plus className="w-4 h-4" /></Button>
              </div>
              {form.destinations?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {form.destinations.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="flex-1">{d.name}</span>
                      {d.target_date && <span className="text-xs text-muted-foreground">{d.target_date}</span>}
                      <button onClick={() => removeDestination(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button className="w-full rounded-full" onClick={handleCreate} disabled={!form.title || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Roadmap
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}