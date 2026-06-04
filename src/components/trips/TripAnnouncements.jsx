import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Megaphone, Loader2, Trash2, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TAG_OPTIONS = ['General', 'Reminder', 'Urgent', 'Schedule change', 'Weather alert'];
const TAG_COLORS = {
  General: 'bg-blue-100 text-blue-700',
  Reminder: 'bg-yellow-100 text-yellow-700',
  Urgent: 'bg-red-100 text-red-700',
  'Schedule change': 'bg-purple-100 text-purple-700',
  'Weather alert': 'bg-cyan-100 text-cyan-700',
};

export default function TripAnnouncements({ trip, isOrganizer }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('General');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['trip-announcements', trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_announcements')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id,
  });

  const handlePost = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('trip_announcements').insert({
      trip_id: trip.id,
      trip_title: trip.title,
      author_email: user.email,
      author_name: user.full_name || user.email,
      content: content.trim(),
      tag,
    });
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-announcements', trip.id] });
    setContent('');
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('trip_announcements').delete().eq('id', id);
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-announcements', trip.id] });
  };

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Announcements</h3>
          {announcements.length > 0 && (
            <span className="text-xs text-muted-foreground">({announcements.length})</span>
          )}
        </div>
        {isOrganizer && !showForm && (
          <Button size="sm" variant="outline" className="rounded-full h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3 h-3" /> Post
          </Button>
        )}
      </div>

      {isOrganizer && showForm && (
        <div className="bg-muted rounded-xl p-4 mb-4 space-y-3">
          <Textarea
            placeholder="Write your announcement..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            className="resize-none bg-background"
          />
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  tag === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => { setShowForm(false); setContent(''); }}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={handlePost} disabled={!content.trim() || saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Post
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {isOrganizer ? 'No announcements yet. Post one to notify members!' : 'No announcements yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann, i) => (
            <div
              key={ann.id}
              className={`rounded-xl p-3 border ${i === 0 ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {ann.tag && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[ann.tag] || 'bg-muted text-muted-foreground'}`}>
                        {ann.tag}
                      </span>
                    )}
                    {i === 0 && <span className="text-xs text-primary font-medium">Latest</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {ann.author_name} · {ann.created_at ? formatDistanceToNow(new Date(ann.created_at), { addSuffix: true }) : ''}
                  </p>
                </div>
                {isOrganizer && (
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}