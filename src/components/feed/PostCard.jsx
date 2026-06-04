import { useState, useRef, useEffect } from 'react';
import {
  Heart, MessageCircle, Share2, MapPin, ChevronLeft, ChevronRight,
  Play, Pause, Volume2, VolumeX,
  MoreHorizontal, Bookmark, Flag, Facebook, Copy,
  Star, Thermometer, Sun, Backpack, X,
  Mountain, ShoppingBag, ArrowRight,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import FollowButton from '@/components/social/FollowButton';
import TripPostCard from '@/components/trips/TripPostCard';

const isVideoMedia = (type = '') => type === 'video';

// ── Parse experience meta ─────────────────────────────────────────────────────
function parseExperienceContent(rawContent) {
  if (!rawContent) return { body: '', meta: null };
  const parts = rawContent.split('\n\n');
  if (parts.length < 2) return { body: rawContent, meta: null };
  const metaLine = parts[parts.length - 1];
  const knownKeys = ['Rating:', 'Difficulty:', 'Trail Condition:', 'Best Season:', 'Gear Tips:'];
  if (!knownKeys.some(k => metaLine.includes(k))) return { body: rawContent, meta: null };
  const body = parts.slice(0, -1).join('\n\n');
  const meta = {};
  metaLine.split(' · ').forEach(segment => {
    const colonIdx = segment.indexOf(':');
    if (colonIdx === -1) return;
    meta[segment.slice(0, colonIdx).trim()] = segment.slice(colonIdx + 1).trim();
  });
  return { body, meta };
}

// ── Experience Meta Card ──────────────────────────────────────────────────────
function ExperienceMeta({ meta, mountainName }) {
  if (!meta && !mountainName) return null;
  const difficultyColor = {
    'Easy': 'bg-green-100 text-green-700 border-green-200',
    'Moderate': 'bg-blue-100 text-blue-700 border-blue-200',
    'Difficult': 'bg-orange-100 text-orange-700 border-orange-200',
    'Very Difficult': 'bg-red-100 text-red-700 border-red-200',
    'Technical': 'bg-purple-100 text-purple-700 border-purple-200',
  };
  const conditionColor = {
    'Excellent': 'bg-green-100 text-green-700', 'Good': 'bg-lime-100 text-lime-700',
    'Fair': 'bg-yellow-100 text-yellow-700', 'Poor': 'bg-orange-100 text-orange-700',
    'Dangerous': 'bg-red-100 text-red-700',
  };
  const safeMeta = meta || {};
  const filledStars = safeMeta['Rating'] ? (safeMeta['Rating'].match(/★/g) || []).length : 0;

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 space-y-2.5">
      {mountainName && (
        <div className="flex items-center gap-1.5 pb-2 border-b border-amber-100">
          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-sm font-bold text-primary">{mountainName}</span>
        </div>
      )}
      {filledStars > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-4 h-4 ${i <= filledStars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20 fill-muted-foreground/10'}`} />
            ))}
          </div>
          <span className="text-xs font-semibold text-amber-700">
            {['','Poor','Fair','Good','Great','Excellent'][filledStars]}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {safeMeta['Difficulty'] && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${difficultyColor[safeMeta['Difficulty']] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            <Thermometer className="w-3 h-3" />{safeMeta['Difficulty']}
          </span>
        )}
        {safeMeta['Trail Condition'] && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${conditionColor[safeMeta['Trail Condition']] || 'bg-gray-100 text-gray-700'}`}>
            Trail: {safeMeta['Trail Condition']}
          </span>
        )}
        {safeMeta['Best Season'] && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
            <Sun className="w-3 h-3" />{safeMeta['Best Season']}
          </span>
        )}
      </div>
      {safeMeta['Gear Tips'] && (
        <div className="flex items-start gap-1.5 pt-0.5 border-t border-amber-100">
          <Backpack className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">{safeMeta['Gear Tips']}</p>
        </div>
      )}
    </div>
  );
}

// ── Package Promo CTA Card ────────────────────────────────────────────────────
// Shown when a post was shared/promoted from a tour package.
// Clicking anywhere on it navigates to /agencies/:agencyId
function PackagePromoCard({ post }) {
  const navigate = useNavigate();

  // Fields saved by SharePackageDialog
  const { package_id, package_price, agency_id, agency_name, mountain_name } = post;
  if (!agency_id) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    navigate(`/agencies/${agency_id}`);
  };

  return (
    <div
      className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
      onClick={handleClick}
    >
      <div className="p-3 flex items-center gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
          <ShoppingBag className="w-5 h-5 text-primary" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-foreground leading-tight">{agency_name}</p>
            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full border border-primary/20">
              Tour Package
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {mountain_name && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Mountain className="w-3 h-3" />{mountain_name}
              </span>
            )}
            {package_price && (
              <span className="text-xs font-semibold text-primary">
                ₱{Number(package_price).toLocaleString()} / pax
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <div className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full group-hover:bg-primary/90 transition-colors">
            Book Now
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-3 pb-2.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>Tap to view this package at</span>
        <span className="font-semibold text-primary">{agency_name}</span>
        <span>on Melotrip</span>
      </div>
    </div>
  );
}

// ── Fullscreen Image Viewer ───────────────────────────────────────────────────
function FullscreenViewer({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors z-10" onClick={onClose}>
        <X className="w-6 h-6" />
      </button>
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-semibold bg-black/50 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}
      <img
        src={images[index]}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        style={{ maxHeight: '90vh', maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}
      />
      {index > 0 && (
        <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-3 hover:bg-black/80 transition-colors" onClick={e => { e.stopPropagation(); setIndex(i => i - 1); }}>
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-3 hover:bg-black/80 transition-colors" onClick={e => { e.stopPropagation(); setIndex(i => i + 1); }}>
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setIndex(i); }} className={`h-1.5 rounded-full transition-all duration-200 ${i === index ? 'bg-white w-5' : 'bg-white/40 w-1.5'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────
function MediaCarousel({ images }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  if (!images?.length) return null;
  return (
    <>
      <div
        className="relative bg-black cursor-pointer"
        style={{ aspectRatio: images.length > 1 ? '4/3' : '1/1', maxHeight: 520 }}
        onClick={() => setFullscreen(true)}
      >
        <img src={images[index]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 520 }} />
        {images.length > 1 && (
          <>
            {index > 0 && (
              <button onClick={e => { e.stopPropagation(); setIndex(i => i - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 backdrop-blur text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-all shadow-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {index < images.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setIndex(i => i + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 backdrop-blur text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-all shadow-lg">
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setIndex(i); }} className={`h-1.5 rounded-full transition-all duration-200 ${i === index ? 'bg-white w-5' : 'bg-white/50 w-1.5'}`} />
              ))}
            </div>
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full font-semibold backdrop-blur">
              {index + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      {fullscreen && <FullscreenViewer images={images} startIndex={index} onClose={() => setFullscreen(false)} />}
    </>
  );
}

// ── Single image ──────────────────────────────────────────────────────────────
function SingleImage({ src }) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <>
      <div className="bg-black overflow-hidden cursor-pointer" style={{ maxHeight: 520 }} onClick={() => setFullscreen(true)}>
        <img src={src} alt="" className="w-full h-full object-cover" style={{ maxHeight: 520 }} />
      </div>
      {fullscreen && <FullscreenViewer images={[src]} startIndex={0} onClose={() => setFullscreen(false)} />}
    </>
  );
}

// ── Video / Reel ──────────────────────────────────────────────────────────────
function ReelMedia({ src, isReel }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        video.muted = false;
        video.play().then(() => setPlaying(true)).catch(() => {
          video.muted = true; setMuted(true);
          video.play().then(() => setPlaying(true)).catch(() => {});
        });
      } else { video.pause(); setPlaying(false); }
    }, { threshold: [0, 0.6] });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); } else { v.play(); setPlaying(true); }
  };
  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };
  const seek = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) videoRef.current.currentTime = ratio * videoRef.current.duration;
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-black group overflow-hidden"
      style={{ aspectRatio: isReel ? '9/16' : '16/9', maxHeight: isReel ? 680 : 400 }}
      onClick={toggle}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        loop playsInline preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 bg-black/50 backdrop-blur rounded-full flex items-center justify-center">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-full h-1 bg-white/30 rounded-full mb-2 cursor-pointer" onClick={seek}>
          <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <button onClick={toggle} className="text-white p-1">
            {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
          </button>
          <button onClick={toggleMute} className="text-white p-1">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {isReel && (
        <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] px-2.5 py-1 rounded-full font-bold shadow pointer-events-none">
          REEL
        </div>
      )}
    </div>
  );
}

// ── Share Menu ────────────────────────────────────────────────────────────────
function ShareMenu({ postId, onClose }) {
  const url = `${window.location.origin}/post/${postId}`;
  const copyLink = () => { navigator.clipboard.writeText(url); onClose(); };
  return (
    <div className="absolute bottom-full right-0 mb-2 bg-card border shadow-xl rounded-2xl overflow-hidden z-50 w-52 animate-in slide-in-from-bottom-2 duration-150">
      <p className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-1">Share this post</p>
      <button onClick={copyLink} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm">
        <Copy className="w-4 h-4 text-muted-foreground" /> Copy link
      </button>
      <button
        onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm"
      >
        <Facebook className="w-4 h-4 text-blue-600" /> Share to Facebook
      </button>
      <button
        onClick={() => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm"
      >
        <span className="w-4 h-4 flex items-center justify-center font-bold text-xs">𝕏</span> Share to X
      </button>
    </div>
  );
}

// ── More Menu ─────────────────────────────────────────────────────────────────
function MoreMenu({ onClose }) {
  return (
    <div className="absolute top-full right-0 mt-1 bg-card border shadow-xl rounded-2xl overflow-hidden z-50 w-48 animate-in slide-in-from-top-2 duration-150">
      <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm">
        <Bookmark className="w-4 h-4 text-muted-foreground" /> Save post
      </button>
      <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm text-destructive">
        <Flag className="w-4 h-4" /> Report post
      </button>
    </div>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────────
export default function PostCard({ post, onComment, onUpdate }) {
  const { user } = useAuth();

  // ── Persistent like state ──────────────────────────────────────────────────
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeChecked, setLikeChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || !post?.id) return;
    let cancelled = false;
    supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) { setLiked(!!data); setLikeChecked(true); }
      });
    return () => { cancelled = true; };
  }, [post.id, user?.id]);

  const handleHeart = async () => {
    if (likeLoading || !user?.id) return;
    setLikeLoading(true);
    const wasLiked = liked;
    const delta = wasLiked ? -1 : 1;
    setLiked(!wasLiked);
    setLikesCount(c => Math.max(0, c + delta));
    try {
      if (wasLiked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').upsert({ post_id: post.id, user_id: user.id }, { onConflict: 'post_id,user_id' });
      }
      await supabase.from('posts').update({ likes_count: Math.max(0, (post.likes_count || 0) + delta) }).eq('id', post.id);
      onUpdate?.();
    } catch {
      setLiked(wasLiked);
      setLikesCount(c => Math.max(0, c - delta));
    } finally {
      setLikeLoading(false);
    }
  };

  // ── Rest of state ──────────────────────────────────────────────────────────
  const [expanded, setExpanded]   = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMore, setShowMore]   = useState(false);

  const authorName  = post.profiles?.full_name || 'Unknown';
  const authorEmail = post.profiles?.email || '';
  const authorId    = post.author_id;
  const initials    = authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const isVideo     = isVideoMedia(post.media_type);
  const isReel      = post.is_reel === true;
  const isCarousel  = Array.isArray(post.post_images) && post.post_images.length > 1;
  const isExperiencePost = post.post_type === 'experience';
  const isTripPost       = post.post_type === 'trip';
  const isPackagePromo   = !!post.agency_id && !!post.package_id; // shared from AgencyDetail
  const isOwnPost   = user?.id === authorId;
  const profileLink = isOwnPost ? '/profile' : `/profile/${authorId}`;

  const { body: experienceBody, meta: experienceMeta } = isExperiencePost
    ? parseExperienceContent(post.content)
    : { body: post.content, meta: null };

  const displayRawContent = isExperiencePost ? experienceBody : post.content;
  const contentShort      = displayRawContent?.length > 200;
  const displayContent    = expanded || !contentShort
    ? displayRawContent
    : displayRawContent?.slice(0, 200) + '...';

  const closeAll = () => { setShowShare(false); setShowMore(false); };

  return (
    <div
      className="bg-card rounded-2xl border overflow-visible shadow-sm hover:shadow-md transition-shadow"
      onClick={() => { if (showShare || showMore) closeAll(); }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <Link to={profileLink}>
          <Avatar className="w-11 h-11 ring-2 ring-background shadow">
            {post.profiles?.avatar_url ? (
              <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
            )}
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={profileLink} className="font-bold text-sm hover:text-primary transition-colors">{authorName}</Link>
            {post.agency && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                {post.agency.name}{post.agency.is_verified && <span>✓</span>}
              </span>
            )}
            {/* Promo badge — shown when the post was shared from a package */}
            {isPackagePromo && !post.agency && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                <ShoppingBag className="w-2.5 h-2.5" /> Promo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span>{post.created_date ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true }) : 'just now'}</span>
            {post.mountain_name && (
              <><span>·</span><MapPin className="w-3 h-3 shrink-0" /><span className="text-primary font-semibold">{post.mountain_name}</span></>
            )}
            {isReel && <><span>·</span><span className="text-purple-500 font-semibold text-[10px]">REEL</span></>}
            {isExperiencePost && <><span>·</span><span className="text-amber-500 font-semibold text-[10px]">EXPERIENCE</span></>}
            {isTripPost && <><span>·</span><span className="text-primary font-semibold text-[10px]">TRIP</span></>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <FollowButton targetEmail={authorEmail} targetName={authorName} />
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setShowMore(v => !v); setShowShare(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMore && <MoreMenu onClose={() => setShowMore(false)} />}
          </div>
        </div>
      </div>

      {/* Text content */}
      {displayContent && !isTripPost && (
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
          {contentShort && (
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-primary font-semibold mt-1 hover:underline">
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      {/* Trip post short caption */}
      {isTripPost && displayContent && (
        <div className="px-4 pb-2">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground line-clamp-2">
            {displayRawContent?.split('\n')[0]}
          </p>
        </div>
      )}

      {/* Experience meta */}
      {isExperiencePost && (experienceMeta || post.mountain_name) && (
        <ExperienceMeta meta={experienceMeta} mountainName={post.mountain_name} />
      )}

      {/* ── Package Promo CTA — shown BEFORE the image so it's immediately visible ── */}
      {isPackagePromo && <PackagePromoCard post={post} />}

      {/* Trip card */}
      {isTripPost && <TripPostCard post={post} />}

      {/* Media */}
      {!isTripPost && (
        (isReel || isVideo) && post.image_url ? (
          <ReelMedia src={post.image_url} isReel={isReel} />
        ) : isCarousel ? (
          <MediaCarousel images={post.post_images} />
        ) : post.image_url ? (
          <SingleImage src={post.image_url} />
        ) : null
      )}

      {/* Reaction + comment count */}
      {(likesCount > 0 || post.comments_count > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-b">
          <div className="flex items-center gap-1.5">
            {likesCount > 0 && <><Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /><span>{likesCount}</span></>}
          </div>
          {post.comments_count > 0 && <span>{post.comments_count} comments</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center border-b">
        <button
          className={`flex-1 flex items-center justify-center gap-2 h-11 text-sm font-medium transition-colors hover:bg-muted ${liked ? 'text-red-500' : 'text-muted-foreground'} ${likeLoading ? 'opacity-60' : ''}`}
          onClick={e => { e.stopPropagation(); handleHeart(); }}
          disabled={likeLoading || !likeChecked}
        >
          <Heart className={`w-4 h-4 transition-all ${liked ? 'fill-red-500 scale-110' : ''}`} />
          <span>{liked ? 'Liked' : 'Like'}</span>
        </button>

        <button
          className="flex-1 flex items-center justify-center gap-2 h-11 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => onComment?.(post)}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Comment</span>
        </button>

        <div className="relative flex-1">
          <button
            className="w-full flex items-center justify-center gap-2 h-11 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            onClick={e => { e.stopPropagation(); setShowShare(v => !v); setShowMore(false); }}
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          {showShare && <ShareMenu postId={post.id} onClose={() => setShowShare(false)} />}
        </div>
      </div>
    </div>
  );
}
