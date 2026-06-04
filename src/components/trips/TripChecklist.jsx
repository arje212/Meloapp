import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/api/supabaseClient";
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus, Trash2, Loader2 } from 'lucide-react';

const DEFAULT_ITEMS = [
  'Hiking boots', 'Rain jacket', 'Headlamp + batteries', 'First aid kit',
  'Water (2L min)', 'Trail food / snacks', 'Trekking poles', 'Sunscreen',
  'Gloves', 'Sleeping bag', 'Tent', 'Extra clothes',
];

export default function TripChecklist({ trip }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['trip-checklist', trip?.id, user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_checklist_items')
        .select('*')
        .eq('trip_id', trip.id)
        .eq('user_email', user.email)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id && !!user?.email,
  });

  const checkedCount = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const handleSeedDefaults = async () => {
    setIsAdding(true);
    const existing = new Set(items.map(i => i.label?.toLowerCase()));
    const toAdd = DEFAULT_ITEMS
      .filter(d => !existing.has(d.toLowerCase()))
      .map(label => ({ trip_id: trip.id, user_email: user.email, label, checked: false }));

    if (toAdd.length > 0) {
      const { error } = await supabase.from('trip_checklist_items').insert(toAdd);
      if (error) console.error(error);
    }
    qc.invalidateQueries({ queryKey: ['trip-checklist', trip.id, user.email] });
    setIsAdding(false);
  };

  const handleAdd = async () => {
    const label = newItem.trim();
    if (!label) return;
    setAdding(true);
    const { error } = await supabase.from('trip_checklist_items').insert({
      trip_id: trip.id,
      user_email: user.email,
      label,
      checked: false,
    });
    if (error) console.error(error);
    setNewItem('');
    qc.invalidateQueries({ queryKey: ['trip-checklist', trip.id, user.email] });
    setAdding(false);
  };

  const handleToggle = async (item) => {
    const { error } = await supabase
      .from('trip_checklist_items')
      .update({ checked: !item.checked })
      .eq('id', item.id);
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-checklist', trip.id, user.email] });
  };

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('trip_checklist_items')
      .delete()
      .eq('id', id);
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-checklist', trip.id, user.email] });
  };

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Packing checklist</h3>
          {total > 0 && (
            <Badge variant="outline" className="text-xs">
              {checkedCount}/{total}
            </Badge>
          )}
        </div>
        {items.length === 0 && !isLoading && (
          <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" onClick={handleSeedDefaults} disabled={isAdding}>
            {isAdding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Load defaults
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{pct}% packed</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 group">
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => handleToggle(item)}
                id={`check-${item.id}`}
              />
              <label
                htmlFor={`check-${item.id}`}
                className={`flex-1 text-sm cursor-pointer select-none transition-all ${
                  item.checked ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {item.label}
              </label>
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Add item..."
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-8 text-sm"
        />
        <Button size="sm" className="rounded-full h-8 px-3" onClick={handleAdd} disabled={!newItem.trim() || adding}>
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}