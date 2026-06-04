import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { uploadFile } from '@/lib/uploadFile';
import { Star, Loader2, Upload } from 'lucide-react';
import { unlockAchievement } from '@/lib/achievements';

export default function TripReviewDialog({ trip, open, onOpenChange, onReviewed }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [content, setContent] = useState('');
  const [tips, setTips] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const xpEarned = Math.min(200,
    50 + (content.length > 100 ? 30 : 0) + (content.length > 300 ? 30 : 0) +
    (tips.length > 50 ? 30 : 0) + (photos.length > 0 ? 30 : 0) + (photos.length > 1 ? 30 : 0)
  );

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.slice(0, 3).map(f => uploadFile(f, 'trip-reviews')));
      setPhotos(prev => [...prev, ...urls].slice(0, 3));
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    const { error } = await supabase.from('trip_reviews').insert({
      trip_id: trip.id,
      trip_title: trip.title,
      mountain_name: trip.mountain_name,
      reviewer_email: user.email,
      reviewer_name: user.full_name,
      rating,
      content,
      tips,
      difficulty_actual: difficulty || null,
      photos,
      xp_awarded: xpEarned,
    });
    if (error) { console.error(error); setSubmitting(false); return; }
    await unlockAchievement(user.email, user.full_name, 'trip_reviewer', {
      title: 'Trail Writer',
      description: 'Submitted a trip review',
      icon: '📝',
      xp_earned: xpEarned,
      badge_color: 'bronze',
    });
    setSubmitting(false);
    setDone(true);
    onReviewed?.();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{done ? 'Review Submitted!' : `Review: ${trip?.title}`}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">🏆</div>
            <p className="font-semibold">Thanks for your review!</p>
            <p className="text-sm text-muted-foreground">You earned <span className="font-bold text-primary">+{xpEarned} XP</span></p>
            <Button className="rounded-full w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Overall Rating <span className="text-destructive">*</span></Label>
              <div className="flex gap-1 mt-1">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(s)}>
                    <Star className={`w-8 h-8 transition-colors ${s <= (hovered || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Your Experience</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="How was the trip? What did you enjoy?" rows={3} className="resize-none mt-1" />
            </div>

            <div>
              <Label>Tips for Future Hikers</Label>
              <Textarea value={tips} onChange={e => setTips(e.target.value)} placeholder="What should others know before going?" rows={2} className="resize-none mt-1" />
            </div>

            <div>
              <Label>Actual Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="How was the difficulty?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easier_than_expected">Easier than expected</SelectItem>
                  <SelectItem value="as_expected">As expected</SelectItem>
                  <SelectItem value="harder_than_expected">Harder than expected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Photos (up to 3)</Label>
              <label className="flex items-center gap-2 mt-1 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : photos.length > 0 ? `${photos.length} photo(s) added` : 'Add photos'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={photos.length >= 3 || uploading} />
              </label>
              {photos.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {photos.map((p, i) => <img key={i} src={p} alt="" className="w-16 h-16 rounded-lg object-cover" />)}
                </div>
              )}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">XP you'll earn</span>
              <span className="font-bold text-primary">+{xpEarned} XP</span>
            </div>

            <Button className="w-full rounded-full" onClick={handleSubmit} disabled={!rating || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Review
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}