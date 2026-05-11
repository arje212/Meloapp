import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, MapPin, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { unlockAchievement } from '@/lib/achievements';

export default function CreatePostDialog({ open, onOpenChange, onCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mountainId, setMountainId] = useState('');
  const [imageUrl, setImageUrl] = useState(null); // single image_url (text), not array
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const { data: mountains = [] } = useQuery({
    queryKey: ['mountains-select'],
    queryFn: () => base44.entities.Mountain.list('name', 200),
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploading(true);
    setError('');
    try {
      // Only use first image since DB column is image_url (single text)
      const file = files[0];
      const path = `uploads/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('files').upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('files').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setError('Image upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const mountain = mountains.find(m => m.id === mountainId);

      // ✅ Corrected: using exact column names from the posts table
      await base44.entities.Post.create({
        author_id: authUser.id,        // ✅ was user_id
        content: content.trim(),
        image_url: imageUrl || null,   // ✅ was images (array)
        mountain_id: mountainId || null,
        mountain_name: mountain?.name || null,
        status: 'active',              // ✅ removed post_type (column doesn't exist)
      });

      unlockAchievement(user.email, user.full_name, 'first_post');
      setContent('');
      setImageUrl(null);
      setMountainId('');
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error('Post error:', err);
      setError(err.message || JSON.stringify(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Share Your Adventure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Tell the community about your hiking experience..."
            value={content}
            onChange={e => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />

          <Select value={mountainId} onValueChange={setMountainId}>
            <SelectTrigger>
              <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Tag a mountain (optional)" />
            </SelectTrigger>
            <SelectContent>
              {mountains.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Single image preview */}
          {imageUrl && (
            <div className="flex gap-2 flex-wrap">
              <div className="w-20 h-20 rounded-lg overflow-hidden relative">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center"
                >×</button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <ImagePlus className="w-5 h-5" />
              {isUploading ? 'Uploading...' : 'Add Photo'}
              {/* Single file only since DB stores one image_url */}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <Button onClick={handleSubmit} disabled={!content.trim() || isSubmitting} className="rounded-full px-6">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}