import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImagePlus, MapPin, Loader2, X, Film, Images, Globe, Users, Lock, Smile, Star, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { unlockAchievement } from '@/lib/achievements';

const MODES = [
  { key: 'photo',      label: 'Photo / Album', icon: Images, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  { key: 'reel',       label: 'Reel / Vlog',   icon: Film,   color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'experience', label: 'Experience',     icon: Smile,  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
];

const DIFFICULTY_LEVELS = ['Easy', 'Moderate', 'Difficult', 'Very Difficult', 'Technical'];
const TRAIL_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Dangerous'];

export default function CreatePostDialog({ open, onOpenChange, onCreated, initialMode = 'photo' }) {
  const { user } = useAuth();
  const [postMode, setPostMode] = useState(initialMode);
  const [content, setContent] = useState('');
  const [mountainId, setMountainId] = useState('');
  const [mediaList, setMediaList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState('public');

  // Experience-specific fields
  const [difficulty, setDifficulty] = useState('');
  const [trailCondition, setTrailCondition] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [gearTips, setGearTips] = useState('');
  const [bestSeason, setBestSeason] = useState('');

  useEffect(() => {
    if (open) {
      setPostMode(initialMode);
      setContent('');
      setMediaList([]);
      setMountainId('');
      setError('');
      setDifficulty('');
      setTrailCondition('');
      setRating(0);
      setGearTips('');
      setBestSeason('');
    }
  }, [open, initialMode]);

  // Fetch mountains via supabase directly
  const { data: mountains = [] } = useQuery({
    queryKey: ['mountains-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mountains')
        .select('id, name')
        .order('name')
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const uploadFile = async (file) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) throw new Error('Please choose an image or video file.');
    const path = `uploads/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('files').upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('files').getPublicUrl(path);
    return { url: data.publicUrl, type: isVideo ? 'video' : 'image', name: file.name };
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (postMode === 'reel') {
      const file = files[0];
      if (!file.type.startsWith('video/')) { setError('Reels must be a video file.'); return; }
      setUploadingCount(1); setError('');
      try {
        const uploaded = await uploadFile(file);
        setMediaList([uploaded]);
      } catch (err) { setError('Upload failed: ' + err.message); }
      finally { setUploadingCount(0); }
      return;
    }

    const remaining = 10 - mediaList.length;
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) return;
    setUploadingCount(toUpload.length); setError('');
    try {
      const uploaded = await Promise.all(toUpload.map(uploadFile));
      setMediaList(prev => [...prev, ...uploaded]);
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setUploadingCount(0); }
  };

  const removeMedia = (index) => setMediaList(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!content.trim() && !mediaList.length && postMode !== 'experience') return;
    if (postMode === 'experience' && !content.trim()) return;
    setIsSubmitting(true); setError('');
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const mountain = mountains.find(m => m.id === mountainId);
      const isReel = postMode === 'reel';
      const isExperience = postMode === 'experience';
      const isCarousel = mediaList.length > 1;
      const firstMedia = mediaList[0] || null;

      let finalContent = content.trim();
      if (isExperience) {
        const meta = [];
        if (rating > 0)       meta.push(`Rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`);
        if (difficulty)       meta.push(`Difficulty: ${difficulty}`);
        if (trailCondition)   meta.push(`Trail Condition: ${trailCondition}`);
        if (bestSeason)       meta.push(`Best Season: ${bestSeason}`);
        if (gearTips.trim())  meta.push(`Gear Tips: ${gearTips.trim()}`);
        if (meta.length > 0) {
          finalContent = `${finalContent}\n\n${meta.join(' · ')}`;
        }
      }

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          author_id: authUser.id,
          content: finalContent,
          image_url: firstMedia?.url || null,
          media_type: firstMedia?.type || null,
          post_images: mediaList.map(m => m.url),
          post_type: isReel ? 'reel' : isExperience ? 'experience' : isCarousel ? 'carousel' : firstMedia ? 'photo' : 'experience',
          is_reel: isReel,
          mountain_id: mountainId || null,
          mountain_name: mountain?.name || null,
          status: 'active',
          audience,
          likes_count: 0,
          comments_count: 0,
          trip_data: null,
        });

      if (insertError) throw insertError;

      try { unlockAchievement(user.email, user.full_name, 'first_post'); } catch (_) {}

      setContent(''); setMediaList([]); setMountainId(''); setPostMode('photo');
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error('Post error:', err);
      setError(err.message || JSON.stringify(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUploading = uploadingCount > 0;
  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const audienceIcons = { public: Globe, friends: Users, private: Lock };
  const AudienceIcon = audienceIcons[audience];

  const canSubmit = () => {
    if (isSubmitting || isUploading) return false;
    if (postMode === 'reel') return mediaList.length > 0;
    if (postMode === 'photo') return content.trim() || mediaList.length > 0;
    if (postMode === 'experience') return content.trim().length > 0;
    return false;
  };

  const submitLabel = () => {
    if (isSubmitting) return <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Posting...</>;
    if (postMode === 'reel') return 'Post Reel';
    if (postMode === 'experience') return 'Share Experience';
    return 'Post Photos';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Share Your Adventure</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Author row + audience picker */}
          <div className="flex items-center gap-3">
            <Avatar className="w-11 h-11 shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{userInitials}</AvatarFallback>
              }
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{user?.full_name || user?.email}</p>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="h-7 text-xs w-32 mt-0.5 rounded-lg">
                  <AudienceIcon className="w-3 h-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public"><Globe className="w-3.5 h-3.5 inline mr-1.5" />Public</SelectItem>
                  <SelectItem value="friends"><Users className="w-3.5 h-3.5 inline mr-1.5" />Friends</SelectItem>
                  <SelectItem value="private"><Lock className="w-3.5 h-3.5 inline mr-1.5" />Only me</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            {MODES.map(m => {
              const Icon = m.icon;
              const active = postMode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => { setPostMode(m.key); setMediaList([]); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? `bg-card shadow ${m.color}`
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* ── PHOTO MODE ── */}
          {postMode === 'photo' && (
            <>
              <Textarea
                placeholder="Write a caption for your photos..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[90px] resize-none text-sm"
              />
              <Select value={mountainId} onValueChange={setMountainId}>
                <SelectTrigger>
                  <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Tag a destination (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {mountains.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {mediaList.length === 0 && (
                <div className="border-2 border-dashed border-green-200 rounded-2xl p-6 text-center bg-green-50/50">
                  <Images className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-700 mb-1">Upload photos or videos</p>
                  <p className="text-xs text-green-500 mb-3">Up to 10 files supported</p>
                  <label className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer hover:bg-green-700 transition-colors">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
                    {isUploading ? 'Uploading...' : 'Choose Files'}
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
                  </label>
                </div>
              )}

              {mediaList.length > 0 && (
                <div className={`grid gap-2 ${mediaList.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  {mediaList.map((m, i) => (
                    <div key={i} className={`relative rounded-xl overflow-hidden bg-black ${mediaList.length === 1 ? 'aspect-video' : 'aspect-square'}`}>
                      {m.type === 'video'
                        ? <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                        : <img src={m.url} alt="" className="w-full h-full object-cover" />
                      }
                      <button onClick={() => removeMedia(i)} className="absolute top-2 right-2 w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center hover:bg-black/90">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {i === 0 && mediaList.length > 1 && (
                        <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">Cover</span>
                      )}
                      {m.type === 'video' && (
                        <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">VIDEO</span>
                      )}
                    </div>
                  ))}
                  {mediaList.length < 10 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all gap-1">
                      <ImagePlus className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Add more</span>
                      <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
                    </label>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── REEL MODE ── */}
          {postMode === 'reel' && (
            <>
              <Textarea
                placeholder="Describe your vlog or reel..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
              />
              <Select value={mountainId} onValueChange={setMountainId}>
                <SelectTrigger>
                  <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Tag a destination (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {mountains.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {mediaList.length === 0 && (
                <div className="border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center bg-purple-50/50">
                  <Film className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-purple-700 mb-1">Upload your vlog or reel</p>
                  <p className="text-xs text-purple-500 mb-3">Vertical video recommended (9:16) — Max 500MB</p>
                  <label className="inline-flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer hover:bg-purple-700 transition-colors">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                    {isUploading ? 'Uploading...' : 'Choose Video'}
                    <input type="file" accept="video/*" className="hidden" onChange={handleMediaUpload} />
                  </label>
                </div>
              )}

              {mediaList.length > 0 && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video src={mediaList[0].url} className="w-full h-full object-cover" muted playsInline />
                  <button onClick={() => removeMedia(0)} className="absolute top-2 right-2 w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center hover:bg-black/90">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">VIDEO</span>
                </div>
              )}
            </>
          )}

          {/* ── EXPERIENCE MODE ── */}
          {postMode === 'experience' && (
            <>
              <Select value={mountainId} onValueChange={setMountainId}>
                <SelectTrigger>
                  <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Which destination did you visit?" />
                </SelectTrigger>
                <SelectContent>
                  {mountains.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Star Rating */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Overall Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="text-xs text-muted-foreground ml-2 self-center">
                      {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Difficulty + Trail Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Trail Difficulty</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIFFICULTY_LEVELS.map(d => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d === difficulty ? '' : d)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                          difficulty === d
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-muted-foreground/30 text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Trail Condition</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TRAIL_CONDITIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setTrailCondition(c === trailCondition ? '' : c)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                          trailCondition === c
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-muted-foreground/30 text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Best Season */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Best Season to Climb</p>
                <div className="flex gap-2">
                  {['Dry Season', 'Wet Season', 'Year Round'].map(s => (
                    <button
                      key={s}
                      onClick={() => setBestSeason(s === bestSeason ? '' : s)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                        bestSeason === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-muted-foreground/30 text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                placeholder="Describe your experience — trail conditions, what to expect, memorable moments..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[110px] resize-none text-sm"
              />

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Gear Tips (optional)</p>
                <Textarea
                  placeholder="What gear did you bring? What would you recommend?"
                  value={gearTips}
                  onChange={e => setGearTips(e.target.value)}
                  className="min-h-[70px] resize-none text-sm"
                />
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Your experience report helps fellow travelers plan better trips. Be honest about difficulty and conditions.
                </p>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            {mediaList.length > 0 && postMode !== 'experience' && (
              <span className="text-xs text-muted-foreground">
                {mediaList.length} file{mediaList.length > 1 ? 's' : ''} selected
              </span>
            )}
            {(mediaList.length === 0 || postMode === 'experience') && <div />}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="rounded-full px-6 ml-auto font-semibold"
            >
              {submitLabel()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
