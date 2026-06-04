import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { unlockAchievement } from '@/lib/achievements';

function StarRating({ value, onChange, size = 5 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={`w-${size} h-${size} transition-colors ${s <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
        </button>
      ))}
    </div>
  );
}

export default function TripReviewSection({ trip, members = [] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tips, setTips] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ['trip-reviews', trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_reviews')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id,
  });

  const myReview = reviews.find(r => r.reviewer_email === user?.email);
  const isMember = members.some(m => m.user_email === user?.email && m.status === 'going');
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;
  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

  const handleSubmit = async () => {
    if (!rating) return;
    setSaving(true);
    const xp = 20 + (content.length > 100 ? 15 : 0) + (tips ? 10 : 0) + (difficulty ? 5 : 0);
    const { error } = await supabase.from('trip_reviews').insert({
      trip_id: trip.id,
      trip_title: trip.title,
      mountain_name: trip.mountain_name,
      reviewer_email: user.email,
      reviewer_name: user.full_name,
      rating,
      content,
      difficulty_actual: difficulty || null,
      tips: tips || null,
      xp_awarded: xp,
    });
    if (error) { console.error(error); setSaving(false); return; }
    unlockAchievement(user.email, user.full_name, 'first_review');
    qc.invalidateQueries({ queryKey: ['trip-reviews', trip.id] });
    setShowForm(false);
    setRating(0); setContent(''); setDifficulty(''); setTips('');
    setSaving(false);
  };

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Reviews</h3>
          {avgRating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold">{avgRating}</span>
              <span className="text-xs text-muted-foreground">({reviews.length})</span>
            </div>
          )}
        </div>
        {isMember && !myReview && !showForm && (
          <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" onClick={() => setShowForm(true)}>
            Write a Review
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-muted rounded-xl p-4 mb-4 space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block">Your Rating *</Label>
            <StarRating value={rating} onChange={setRating} size={6} />
          </div>
          <div>
            <Label className="text-xs mb-1">Your Experience *</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="How was the trip?" rows={3} className="resize-none mt-1" />
          </div>
          <div>
            <Label className="text-xs mb-1">Difficulty vs Expectation</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {['easier_than_expected', 'as_expected', 'harder_than_expected'].map(d => (
                <button key={d} onClick={() => setDifficulty(prev => prev === d ? '' : d)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${difficulty === d ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>
                  {d === 'easier_than_expected' ? '😌 Easier' : d === 'as_expected' ? '👍 As Expected' : '😤 Harder'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1">Tips for Future Hikers</Label>
            <Textarea value={tips} onChange={e => setTips(e.target.value)} placeholder="Any advice?" rows={2} className="resize-none mt-1" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={handleSubmit} disabled={!rating || !content || saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Submit
            </Button>
          </div>
        </div>
      )}

      {myReview && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-xs text-primary">
          <Star className="w-3.5 h-3.5 fill-primary" />
          You reviewed this trip — thank you!
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No reviews yet. {isMember ? 'Be the first!' : ''}</p>
      ) : (
        <div className="space-y-4">
          {displayedReviews.map(r => (
            <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
              <div className="flex items-start gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{r.reviewer_name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{r.reviewer_name}</p>
                    <StarRating value={r.rating} size={3} />
                    <span className="text-xs text-muted-foreground">
                      {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  {r.difficulty_actual && (
                    <span className="text-xs text-muted-foreground">
                      {r.difficulty_actual === 'easier_than_expected' ? '😌 Easier than expected' : r.difficulty_actual === 'as_expected' ? '👍 As expected' : '😤 Harder than expected'}
                    </span>
                  )}
                  {r.content && <p className="text-sm mt-1 text-foreground/80">{r.content}</p>}
                  {r.tips && <p className="text-xs text-muted-foreground mt-1 italic">💡 {r.tips}</p>}
                </div>
              </div>
            </div>
          ))}
          {reviews.length > 3 && (
            <button onClick={() => setShowAll(p => !p)} className="flex items-center gap-1 text-xs text-primary font-medium mt-1">
              {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {reviews.length} reviews</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}