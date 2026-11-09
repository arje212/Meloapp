import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Heart, MessageCircle, Share2, MapPin, ChevronLeft, ChevronRight,
  Play, Volume2, VolumeX, Maximize,
  MoreHorizontal, Bookmark, Flag, Facebook, Copy,
  Star, Thermometer, Sun, Backpack, X,
  Mountain, ShoppingBag, ArrowRight,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import PackagePhotoLayout from '@/components/feed/PackagePhotoLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { syncLikesCount } from '@/lib/postCounts';
import { notifyUser } from '@/lib/notify';
import { formatDistanceToNow } from 'date-fns';
import FollowButton from '@/components/social/FollowButton';
import TripPostCard from '@/components/trips/TripPostCard';

const isVideoMedia = (type = '') => type === 'video';
const PACKAGE_DETAILS_MARKER = '\n\n[[MELOTRIP_PACKAGE_DETAILS:';

function getPackagePostDetails(content = '') {
  const rawContent = typeof content === 'string' ? content : '';
  const markerIndex = rawContent.lastIndexOf(PACKAGE_DETAILS_MARKER);
  if (markerIndex < 0) return { caption: rawContent, details: null };
  const json = rawContent.slice(markerIndex + PACKAGE_DETAILS_MARKER.length).replace(/\]\]$/, '');
  try {
    const details = JSON.parse(json);
    return {
      caption: rawContent.slice(0, markerIndex),
      details: details && typeof details === 'object' ? details : null,
    };
  } catch {
    return { caption: rawContent.slice(0, markerIndex), details: null };
  }
}

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
function PackagePromoCard({ post, details }) {
  const navigate = useNavigate();
  const { package_id, package_price, agency_id, agency_name, mountain_name, package_title } = post;
  const pkg = details || post.package_details || {};
  if (!agency_id) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    navigate(`/agencies/${agency_id}?package=${package_id}`);
  };
  const toList = value => Array.isArray(value)
    ? value.filter(Boolean)
    : String(value || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
  const title = pkg.title || package_title || 'Tour Package';
  const includes = toList(pkg.includes);
  const itinerary = toList(pkg.nature_spots);
  const pickups = toList(pkg.pickup_locations);
  const dropoffs = toList(pkg.dropoff_locations);
  const otherPickups = toList(pkg.other_pickup_locations);
  const openFor = toList(pkg.open_for);
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dates = toList(pkg?.available_dates).filter(date => date >= todayString).sort().slice(0, 3);

  return (
    <section aria-label={`${title} booking details`} className="px-4 pb-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{agency_name || 'Travel Agency'} · Tour package</p>
            <h2 className="mt-0.5 break-words text-base font-bold leading-tight text-foreground">{title}</h2>
            {(pkg.mountain_name || mountain_name) && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Mountain className="h-3 w-3 shrink-0" />{pkg.mountain_name || mountain_name}</p>}
          </div>
          <p className="shrink-0 text-base font-bold text-primary">₱{Number(pkg.price ?? package_price ?? 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">/ person</span></p>
        </div>

        {pkg.promo_text && <p className="text-xs font-semibold text-orange-700">{pkg.promo_text}</p>}
        {pkg.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{pkg.description}</p>}

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {pkg.duration_days && <span>{pkg.duration_days} day{Number(pkg.duration_days) === 1 ? '' : 's'}</span>}
          {pkg.max_pax && <span>Up to {pkg.max_pax} people</span>}
          {dates.length > 0 && <span>Dates: {dates.map(date => new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })).join(', ')}</span>}
        </div>

        {includes.length > 0 && <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Includes: </span>{includes.slice(0, 5).join(' · ')}{includes.length > 5 ? ` · +${includes.length - 5} more` : ''}</p>}
        {itinerary.length > 0 && <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Places: </span>{itinerary.slice(0, 4).join(' · ')}{itinerary.length > 4 ? ` · +${itinerary.length - 4} more` : ''}</p>}
        {(pickups.length > 0 || dropoffs.length > 0 || otherPickups.length > 0) && <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          {pickups.length > 0 && <p><span className="font-semibold text-foreground">Pickup: </span>{pickups.slice(0, 3).join(' · ')}{pickups.length > 3 ? ` · +${pickups.length - 3} more` : ''}</p>}
          {dropoffs.length > 0 && <p><span className="font-semibold text-foreground">Drop-off: </span>{dropoffs.slice(0, 3).join(' · ')}{dropoffs.length > 3 ? ` · +${dropoffs.length - 3} more` : ''}</p>}
          {otherPickups.length > 0 && <p><span className="font-semibold text-foreground">Other pickup options: </span>{otherPickups.slice(0, 3).join(' · ')}{otherPickups.length > 3 ? ` · +${otherPickups.length - 3} more` : ''}</p>}
        </div>}
        {openFor.length > 0 && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Good for: </span>{openFor.slice(0, 5).join(' · ')}</p>}

        <button type="button" onClick={handleClick} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          View package & booking <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ── Fullscreen Image Viewer ───────────────────────────────────────────────────
function FullscreenViewer({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const touchStartRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    [index - 1, index + 1]
      .filter(i => i >= 0 && i < images.length)
      .forEach(i => {
        const image = new window.Image();
        image.src = images[i];
      });
  }, [images, index]);

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
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={e => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.stopPropagation();
          return;
        }
        onClose();
      }}
      onTouchStart={e => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        if (touchStartRef.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 500);
        setIndex(i => Math.max(0, Math.min(images.length - 1, i + (deltaX < 0 ? 1 : -1))));
      }}
    >
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
        style={{ maxHeight: '90vh', maxWidth: '90vw', touchAction: 'pan-y' }}
        onClick={e => e.stopPropagation()}
        loading="eager"
        decoding="async"
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
  const [nearViewport, setNearViewport] = useState(false);
  const containerRef = useRef(null);
  const touchStartRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || !images?.length) return;
    [index - 1, index + 1]
      .filter(i => i >= 0 && i < images.length)
      .forEach(i => {
        const image = new window.Image();
        image.src = images[i];
      });
  }, [images, index, nearViewport]);

  if (!images?.length) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="relative bg-black cursor-pointer"
        style={{ aspectRatio: images.length > 1 ? '4/3' : '1/1', maxHeight: 520, touchAction: 'pan-y' }}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setFullscreen(true);
        }}
        onTouchStart={e => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if (touchStartRef.current === null) return;
          const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
          const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
          touchStartRef.current = null;
          if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
          suppressClickRef.current = true;
          window.setTimeout(() => { suppressClickRef.current = false; }, 500);
          setIndex(i => Math.max(0, Math.min(images.length - 1, i + (deltaX < 0 ? 1 : -1))));
        }}
      >
        <img
          src={images[index]}
          alt=""
          className="w-full h-full object-cover"
          style={{ maxHeight: 520 }}
          loading="lazy"
          decoding="async"
        />
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
  const [broken, setBroken] = useState(false);
  // e.g. an old iPhone HEIC upload: browsers cannot show it. New uploads are converted to JPEG automatically.
  if (broken) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground py-10 text-center px-6">
        <p className="text-sm font-medium">Hindi ma-display ang larawan</p>
        <p className="text-xs">Maaaring HEIC o sirang file ito. Hilingin sa nag-post na i-upload ulit.</p>
      </div>
    );
  }
  return (
    <>
      <div className="bg-black overflow-hidden cursor-pointer" style={{ maxHeight: 520 }} onClick={() => setFullscreen(true)}>
        <img src={src} alt="" className="w-full h-full object-cover" style={{ maxHeight: 520 }} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      </div>
      {fullscreen && <FullscreenViewer images={[src]} startIndex={0} onClose={() => setFullscreen(false)} />}
    </>
  );
}

// ── Video / Reel ──────────────────────────────────────────────────────────────
// 1x1 transparent poster: stops Android WebView from drawing its giant default "play" placeholder.
const BLANK_POSTER = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function ReelMedia({ src, isReel }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);       // start muted (like Instagram/Facebook) so autoplay always works
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);      // first frame decoded
  const [failed, setFailed] = useState(false);
  // Follow the real video shape: landscape stays landscape, portrait stays portrait.
  const [ratio, setRatio] = useState(isReel ? 9 / 16 : 16 / 9);

  // "#t=0.1" makes the browser paint a frame as the thumbnail, so a video is visible while scrolling.
  const videoSrc = src && !src.includes('#') ? `${src}#t=0.1` : src;

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        video.play().then(() => setPlaying(true)).catch(() => {});
      } else {
        video.pause(); setPlaying(false);
      }
    }, { threshold: [0, 0.6] });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const onMeta = (e) => {
    const { videoWidth: w, videoHeight: h } = e.currentTarget;
    if (w && h) setRatio(Math.min(16 / 9, Math.max(9 / 16, w / h))); // clamp extreme shapes
  };

  const toggle = (e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v || failed) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); }
    else { v.pause(); setPlaying(false); }
  };
  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const goFullscreen = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone
  };
  const retry = (e) => {
    e.stopPropagation();
    setFailed(false); setReady(false);
    videoRef.current?.load();
  };
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };
  const seek = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-full bg-black overflow-hidden cursor-pointer select-none flex items-center justify-center"
      style={{ aspectRatio: String(ratio), maxHeight: '75vh' }}
      onClick={toggle}
    >
      {!ready && !failed && <div className="absolute inset-0 animate-pulse bg-muted-foreground/20" />}

      <video
        ref={videoRef}
        src={videoSrc}
        poster={BLANK_POSTER}
        className="block w-full h-full object-contain object-center bg-black"
        muted={muted}
        loop playsInline preload="auto"
        onLoadedMetadata={onMeta}
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onError={() => setFailed(true)}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white text-sm">
          <p>Hindi ma-play ang video.</p>
          <button onClick={retry} className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 font-semibold">Subukan ulit</button>
        </div>
      )}

      {!playing && !failed && ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 bg-black/50 backdrop-blur rounded-full flex items-center justify-center">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls are always visible (touch screens have no hover) */}
      {!failed && (
        <>
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button onClick={goFullscreen} aria-label="Fullscreen" className="w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center">
              <Maximize className="w-4 h-4" />
            </button>
            <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-3 flex items-end cursor-pointer" onClick={seek}>
            <div className="w-full h-1 bg-white/30">
              <div className="h-full bg-white" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </>
      )}

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
function MoreMenu({ post, user, onClose }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('main');   // 'main' | 'report'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const savedKey = ['saved-post-ids', user?.id];
  const { data: savedIds = [] } = useQuery({
    queryKey: savedKey,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id).limit(1000);
      if (error) throw error;
      return (data || []).map((r) => r.post_id);
    },
  });
  const isSaved = savedIds.includes(post.id);
  const isMine = !!user?.id && post.author_id === user.id;
  const finish = (text) => { setMsg(text); setTimeout(onClose, 1400); };

  const toggleSave = async () => {
    if (busy || !user?.id) return;
    setBusy(true);
    try {
      const r = isSaved
        ? await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', post.id)
        : await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
      if (r.error && r.error.code !== '23505') throw r.error;
      queryClient.setQueryData(savedKey, (ids = []) => (isSaved ? ids.filter((i) => i !== post.id) : [...new Set([...ids, post.id])]));
      queryClient.invalidateQueries({ queryKey: ['saved-posts', user.id] });
      finish(isSaved ? 'Removed from saved' : 'Saved. Find it in Profile > Saved');
    } catch (err) {
      console.error('Save post failed:', err);
      setMsg('Could not save this post. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const report = async (reason) => {
    if (busy || !user?.email) return;
    setBusy(true);
    try {
      const r = await supabase.from('post_reports').insert({ post_id: post.id, reported_by: user.email, reason });
      if (r.error?.code === '23505') { finish('You already reported this post'); return; }
      if (r.error) throw r.error;
      finish('Thanks. We will review this post.');
    } catch (err) {
      console.error('Report post failed:', err);
      setMsg('Could not send the report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const item = 'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-sm text-left disabled:opacity-60';
  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-1 bg-card border shadow-xl rounded-2xl overflow-hidden z-50 w-56 animate-in slide-in-from-top-2 duration-150">
      {msg ? (
        <p className="px-3 py-3 text-sm">{msg}</p>
      ) : view === 'report' ? (
        <>
          <p className="px-3 pt-2.5 pb-1 text-xs text-muted-foreground">Why are you reporting this post?</p>
          {['Spam', 'Inappropriate content', 'Misleading or false information', 'Other'].map((reason) => (
            <button key={reason} type="button" disabled={busy} onClick={() => report(reason)} className={item}>{reason}</button>
          ))}
          <button type="button" onClick={() => setView('main')} className={`${item} text-muted-foreground`}>Back</button>
        </>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={toggleSave} className={item}>
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-primary text-primary' : 'text-muted-foreground'}`} /> {isSaved ? 'Unsave post' : 'Save post'}
          </button>
          {!isMine && (
            <button type="button" onClick={() => setView('report')} className={`${item} text-destructive`}>
              <Flag className="w-4 h-4" /> Report post
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────────
export default function PostCard({ post, onComment }) {
  const { user } = useAuth();

  // -- Persistent like state ---------------------------------------------
  // The set of posts I liked is cached once for the whole feed (not one query per card), so the
  // heart survives re-renders, refetches and tab switches. Fixes: a like that "disappeared" after the
  // feed refreshed. supabase-js does NOT throw on a rejected write, so errors are now checked.
  const queryClient = useQueryClient();
  const likesKey = ['my-likes', user?.id];
  const { data: myLikes, isFetched: likesReady } = useQuery({
    queryKey: likesKey,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id).limit(1000);
      if (error) throw error;
      return (data || []).map((r) => r.post_id);
    },
  });
  const liked = !!myLikes?.includes(post.id);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeError, setLikeError] = useState('');

  // keep the counter in sync when the feed delivers a fresh count from the database
  useEffect(() => { setLikesCount(post.likes_count || 0); }, [post.likes_count]);

  const setLikedCache = (on) =>
    queryClient.setQueryData(likesKey, (ids = []) => (on ? [...new Set([...ids, post.id])] : ids.filter((id) => id !== post.id)));

  const handleHeart = async () => {
    if (likeLoading || !user?.id) return;
    setLikeLoading(true);
    setLikeError('');
    const wasLiked = liked;
    const delta = wasLiked ? -1 : 1;
    setLikedCache(!wasLiked);
    setLikesCount(c => Math.max(0, c + delta));
    try {
      let result;
      if (wasLiked) {
        result = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        result = await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
        if (result.error?.code === '23505') result = { error: null }; // already liked = fine
      }
      if (result.error) throw result.error;
      const fresh = await syncLikesCount(post.id);
      if (fresh != null) setLikesCount(fresh);
      if (!wasLiked) {
        notifyUser({
          toEmail: post.profiles?.email,
          fromEmail: user.email,
          title: 'New like on your post',
          message: `${user.full_name || user.email} liked your post.`,
          type: 'comment',
          link: `/post/${post.id}`,
          icon: '\u2764\uFE0F',
        });
      }
      // no feed-wide refetch here: it made the whole feed reload on every like
    } catch (err) {
      console.error('Like failed:', err);
      setLikedCache(wasLiked);
      setLikesCount(c => Math.max(0, c - delta));
      // show the database's own reason so the real cause is visible (e.g. a missing policy or column)
      const reason = err?.message ? ` (${String(err.message).slice(0, 140)})` : '';
      setLikeError(`Hindi na-save ang like. Subukan ulit.${reason}`);
      setTimeout(() => setLikeError(''), 9000);
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

  const packagePost = isPackagePromo ? getPackagePostDetails(post.content) : null;
  const displayRawContent = isExperiencePost
    ? experienceBody
    : packagePost?.caption ?? post.content;
  const contentShort      = displayRawContent?.length > 200;
  const displayContent    = expanded || !contentShort
    ? displayRawContent
    : displayRawContent?.slice(0, 200) + '...';

  const closeAll = () => { setShowShare(false); setShowMore(false); };

  return (
    <div
      className="bg-card rounded-none border-x-0 border-y overflow-visible shadow-sm transition-shadow sm:rounded-2xl sm:border sm:hover:shadow-md"
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
            {showMore && <MoreMenu post={post} user={user} onClose={() => setShowMore(false)} />}
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

      {/* Trip card */}
      {isTripPost && <TripPostCard post={post} />}

      {isPackagePromo && <PackagePromoCard post={post} details={packagePost?.details} />}

      {/* Media */}
      {!isTripPost && (
        (isReel || isVideo) && post.image_url ? (
          <ReelMedia src={post.image_url} isReel={isReel} />
        ) : isPackagePromo && ['collage', 'grid'].includes(packagePost?.details?.photo_layout) && (isCarousel || post.image_url) ? (
          <PackagePhotoLayout
            images={isCarousel ? post.post_images : [post.image_url]}
            layout={packagePost.details.photo_layout}
          />
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
          {post.comments_count > 0 && (
            <button type="button" onClick={() => onComment?.(post)} className="py-1 pl-4 -my-1 hover:underline active:opacity-70">
              {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
            </button>
          )}
        </div>
      )}

      {likeError && <p className="px-4 pb-1 text-xs text-destructive">{likeError}</p>}
      {/* Action buttons */}
      <div className="flex items-center border-b">
        <button
          className={`flex-1 flex items-center justify-center gap-2 h-11 text-sm font-medium transition-colors hover:bg-muted ${liked ? 'text-red-500' : 'text-muted-foreground'} ${likeLoading ? 'opacity-60' : ''}`}
          onClick={e => { e.stopPropagation(); handleHeart(); }}
          disabled={likeLoading || !likesReady}
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