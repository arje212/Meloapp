import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

export default function AdminMountains() {
  const queryClient = useQueryClient();
  const [editMtn, setEditMtn] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: mountains = [], isLoading } = useQuery({
    queryKey: ['admin-mountains'],
    queryFn: () => base44.entities.Mountain.list('name', 200),
  });

  const emptyForm = {
    name: '',
    location: '',
    region: '',
    elevation: '',
    difficulty: 'beginner',
    trail_length: '',
    estimated_time: '',
    description: '',
    image_url: '',
    latitude: '',
    longitude: '',
    status: 'open',
  };

  const openNew = () => { setEditMtn(emptyForm); setIsOpen(true); };
  const openEdit = (m) => {
    setEditMtn({
      ...m,
      elevation: String(m.elevation || ''),
      trail_length: String(m.trail_length || ''),
      latitude: String(m.latitude || ''),
      longitude: String(m.longitude || ''),
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = {
        name: editMtn.name,
        location: editMtn.location,
        region: editMtn.region,
        elevation: Number(editMtn.elevation) || 0,
        difficulty: editMtn.difficulty,
        trail_length: editMtn.trail_length ? Number(editMtn.trail_length) : null,
        estimated_time: editMtn.estimated_time || null,
        description: editMtn.description,
        image_url: editMtn.image_url,
        latitude: editMtn.latitude ? Number(editMtn.latitude) : null,
        longitude: editMtn.longitude ? Number(editMtn.longitude) : null,
        status: editMtn.status || 'open',
      };

      if (editMtn.id) {
        await base44.entities.Mountain.update(editMtn.id, data);
      } else {
        await base44.entities.Mountain.create(data);
      }
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-mountains'] });
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving: ' + (err.message || JSON.stringify(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this mountain?')) return;
    await base44.entities.Mountain.delete(id);
    queryClient.invalidateQueries({ queryKey: ['admin-mountains'] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold">Mountains ({mountains.length})</h2>
        <Button onClick={openNew} className="rounded-full"><Plus className="w-4 h-4 mr-2" /> Add Mountain</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Elevation</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mountains.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-sm">{m.location}</TableCell>
                <TableCell className="text-sm">{m.region}</TableCell>
                <TableCell>{m.elevation?.toLocaleString()}m</TableCell>
                <TableCell><Badge variant="outline">{m.difficulty}</Badge></TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    m.status === 'open' ? 'text-green-600 border-green-300' :
                    m.status === 'closed' ? 'text-red-600 border-red-300' :
                    'text-yellow-600 border-yellow-300'
                  }>
                    {m.status || 'open'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {mountains.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No mountains yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editMtn?.id ? 'Edit' : 'Add'} Mountain</DialogTitle></DialogHeader>
          {editMtn && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editMtn.name} onChange={e => setEditMtn(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Location</Label><Input value={editMtn.location} onChange={e => setEditMtn(p => ({ ...p, location: e.target.value }))} /></div>
              <div><Label>Region</Label><Input value={editMtn.region} onChange={e => setEditMtn(p => ({ ...p, region: e.target.value }))} placeholder="e.g. Calabarzon" /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Elevation (m)</Label><Input type="number" value={editMtn.elevation} onChange={e => setEditMtn(p => ({ ...p, elevation: e.target.value }))} /></div>
                <div>
                  <Label>Difficulty</Label>
                  <Select value={editMtn.difficulty} onValueChange={v => setEditMtn(p => ({ ...p, difficulty: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Trail Length (km)</Label><Input type="number" step="0.1" value={editMtn.trail_length} onChange={e => setEditMtn(p => ({ ...p, trail_length: e.target.value }))} /></div>
                <div><Label>Estimated Time</Label><Input value={editMtn.estimated_time} onChange={e => setEditMtn(p => ({ ...p, estimated_time: e.target.value }))} placeholder="e.g. 4-6 hours" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Latitude</Label><Input type="number" step="any" value={editMtn.latitude} onChange={e => setEditMtn(p => ({ ...p, latitude: e.target.value }))} placeholder="e.g. 14.0706" /></div>
                <div><Label>Longitude</Label><Input type="number" step="any" value={editMtn.longitude} onChange={e => setEditMtn(p => ({ ...p, longitude: e.target.value }))} placeholder="e.g. 120.6558" /></div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={editMtn.status || 'open'} onValueChange={v => setEditMtn(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div><Label>Image URL</Label><Input value={editMtn.image_url} onChange={e => setEditMtn(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>Description</Label><Textarea value={editMtn.description} onChange={e => setEditMtn(p => ({ ...p, description: e.target.value }))} rows={4} /></div>

              <Button className="w-full rounded-full" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editMtn.id ? 'Update' : 'Create'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}