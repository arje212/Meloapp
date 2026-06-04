import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Plus, Trash2, Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = ['Transportation', 'Food', 'Accommodation', 'Guide fee', 'Permits', 'Equipment rental', 'Emergency fund', 'Other'];

export default function TripExpenses({ trip, members = [], isOrganizer }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', category: 'Transportation', paid_by: '' });
  const [saving, setSaving] = useState(false);

  const goingMembers = members.filter(m => m.status === 'going');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['trip-expenses', trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_expenses')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id,
  });

  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const perPerson = goingMembers.length > 0 ? totalAmount / goingMembers.length : 0;

  const paidByMember = {};
  expenses.forEach(e => {
    const name = e.paid_by || 'Unknown';
    paidByMember[name] = (paidByMember[name] || 0) + (Number(e.amount) || 0);
  });

  const handleAdd = async () => {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    const { error } = await supabase.from('trip_expenses').insert({
      trip_id: trip.id,
      trip_title: trip.title,
      description: form.description.trim(),
      amount: Number(form.amount),
      category: form.category,
      paid_by: form.paid_by || user.full_name || user.email,
      added_by_email: user.email,
    });
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-expenses', trip.id] });
    setForm({ description: '', amount: '', category: 'Transportation', paid_by: '' });
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('trip_expenses').delete().eq('id', id);
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-expenses', trip.id] });
  };

  const grouped = {};
  expenses.forEach(e => {
    const cat = e.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(e);
  });

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Expense tracker</h3>
        </div>
        {isOrganizer && !showForm && (
          <Button size="sm" variant="outline" className="rounded-full h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3 h-3" /> Add expense
          </Button>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">₱{totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-muted rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Per person ({goingMembers.length})</p>
            <p className="text-lg font-bold">₱{perPerson.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-muted rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Description</Label>
              <Input placeholder="e.g. Jeepney rental" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1 h-8 text-sm bg-background" />
            </div>
            <div>
              <Label className="text-xs">Amount (₱)</Label>
              <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="mt-1 h-8 text-sm bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Paid by</Label>
              <Select value={form.paid_by || user.full_name || user.email} onValueChange={v => setForm(p => ({ ...p, paid_by: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {goingMembers.length > 0 ? goingMembers.map(m => (
                    <SelectItem key={m.id} value={m.user_name || m.user_email}>{m.user_name || m.user_email}</SelectItem>
                  )) : (
                    <SelectItem value={user.full_name || user.email}>{user.full_name || user.email}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={handleAdd} disabled={!form.description.trim() || !form.amount || saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Add
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No expenses logged yet.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
              <div className="space-y-2">
                {items.map(e => (
                  <div key={e.id} className="flex items-center gap-2 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">Paid by {e.paid_by}</p>
                    </div>
                    <p className="text-sm font-bold text-primary shrink-0">₱{Number(e.amount).toLocaleString()}</p>
                    {isOrganizer && (
                      <button onClick={() => handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {expenses.length > 0 && goingMembers.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <button className="flex items-center gap-1 text-xs text-primary font-medium mb-2" onClick={() => setShowSplit(p => !p)}>
            <Users className="w-3.5 h-3.5" />
            Split breakdown
            {showSplit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSplit && (
            <div className="space-y-2">
              {goingMembers.map(m => {
                const name = m.user_name || m.user_email;
                const paid = paidByMember[name] || 0;
                const balance = paid - perPerson;
                return (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate text-sm">{name}</span>
                    <span className="text-xs text-muted-foreground">paid ₱{paid.toLocaleString()}</span>
                    <span className={`text-xs font-semibold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {balance > 0 ? `+₱${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : balance < 0 ? `-₱${Math.abs(balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'settled'}
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground mt-1">+ = gets back, − = still owes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}