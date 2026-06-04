import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Phone, User, ChevronDown, ChevronUp, CheckCircle2, Loader2, Edit2 } from 'lucide-react';

const RESCUE_HOTLINES = [
  { name: 'NDRRMC', number: '911' },
  { name: 'PNP Emergency', number: '117' },
  { name: 'Red Cross PH', number: '143' },
  { name: 'DENR Emergency', number: '1-800-10-DENR-36 (3367)' },
];

export default function TripEmergencyContacts({ trip, members = [], isOrganizer }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState({ contact_name: '', contact_phone: '', relationship: '', blood_type: '' });
  const [saving, setSaving] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['trip-emergency', trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_emergency_contacts')
        .select('*')
        .eq('trip_id', trip.id);
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id,
  });

  const myContact = contacts.find(c => c.user_email === user?.email);
  const goingMembers = members.filter(m => m.status === 'going');
  const missing = goingMembers.filter(m => !contacts.find(c => c.user_email === m.user_email));

  const handleSave = async () => {
    if (!form.contact_name.trim() || !form.contact_phone.trim()) return;
    setSaving(true);
    if (myContact) {
      const { error } = await supabase
        .from('trip_emergency_contacts')
        .update({ ...form })
        .eq('id', myContact.id);
      if (error) console.error(error);
    } else {
      const { error } = await supabase.from('trip_emergency_contacts').insert({
        trip_id: trip.id,
        user_email: user.email,
        user_name: user.full_name || user.email,
        ...form,
      });
      if (error) console.error(error);
    }
    qc.invalidateQueries({ queryKey: ['trip-emergency', trip.id] });
    setEditMode(false);
    setSaving(false);
  };

  const startEdit = () => {
    if (myContact) {
      setForm({
        contact_name: myContact.contact_name || '',
        contact_phone: myContact.contact_phone || '',
        relationship: myContact.relationship || '',
        blood_type: myContact.blood_type || '',
      });
    }
    setEditMode(true);
  };

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Emergency contacts</h3>
          {goingMembers.length > 0 && (
            <span className="text-xs text-muted-foreground">{contacts.length}/{goingMembers.length} submitted</span>
          )}
        </div>
        {!editMode && (
          <Button size="sm" variant="outline" className="rounded-full h-7 text-xs gap-1" onClick={startEdit}>
            {myContact ? <><Edit2 className="w-3 h-3" /> Update</> : 'Add mine'}
          </Button>
        )}
      </div>

      {!editMode && myContact && (
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Your emergency contact is saved: <span className="font-medium">{myContact.contact_name}</span> ({myContact.contact_phone})
        </div>
      )}

      {!editMode && !myContact && (
        <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 mb-3">
          Please add your emergency contact so the organizer can reach someone if needed.
        </div>
      )}

      {editMode && (
        <div className="bg-muted rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Contact name *</Label>
              <Input placeholder="e.g. Maria Santos" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} className="mt-1 h-8 text-sm bg-background" />
            </div>
            <div>
              <Label className="text-xs">Phone number *</Label>
              <Input placeholder="09XX XXX XXXX" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="mt-1 h-8 text-sm bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Relationship</Label>
              <Input placeholder="e.g. Mother, Partner" value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} className="mt-1 h-8 text-sm bg-background" />
            </div>
            <div>
              <Label className="text-xs">Blood type</Label>
              <Input placeholder="e.g. O+" value={form.blood_type} onChange={e => setForm(p => ({ ...p, blood_type: e.target.value }))} className="mt-1 h-8 text-sm bg-background" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setEditMode(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={handleSave} disabled={!form.contact_name.trim() || !form.contact_phone.trim() || saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Save
            </Button>
          </div>
        </div>
      )}

      {isOrganizer && contacts.length > 0 && (
        <div className="mb-4">
          <button className="flex items-center gap-1 text-xs text-primary font-medium mb-2" onClick={() => setShowAll(p => !p)}>
            <User className="w-3.5 h-3.5" />
            Member contacts ({contacts.length})
            {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showAll && (
            <div className="space-y-2">
              {contacts.map(c => (
                <div key={c.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">{c.user_name}</p>
                    {c.blood_type && <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">{c.blood_type}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{c.contact_name}</span>
                    {c.relationship && <span className="text-xs">({c.relationship})</span>}
                    <span className="font-medium text-foreground">{c.contact_phone}</span>
                  </div>
                </div>
              ))}
              {missing.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Missing from: {missing.map(m => m.user_name || m.user_email).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Philippine rescue hotlines</p>
        <div className="grid grid-cols-2 gap-2">
          {RESCUE_HOTLINES.map(h => (
            <a key={h.name} href={`tel:${h.number.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-2 text-xs border rounded-lg p-2 hover:bg-muted transition-colors">
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-muted-foreground">{h.number}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}