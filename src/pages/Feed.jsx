import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FeaturedAgencies from '@/components/agencies/FeaturedAgencies';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PenSquare, Compass, Image, Film, Smile, RefreshCw, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { orderFeedPage } from '@/lib/feedOrder';
import PostCard from '@/components/feed/PostCard';
import CreatePostDialog from '@/components/feed/CreatePostDialog';
import CommentsSheet from '@/components/feed/CommentsSheet';
import { useAuth } from '@/lib/AuthContext';
import { isTripExpired } from '@/lib/tripDates';
import { FeedSkeleton } from '@/components/Skeletons';

const PAGE_SIZE = 15;

// Last feed page is kept on the device so the feed appears instantly on app open,
// then quietly refreshes. Skeletons only show the very first time.
const FEED_CACHE_KEY = 'melotrip.feed.v1';
const readFeedCache = (tab) => {
  if (tab !== 'all') return undefined;
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return undefined;
    const page = JSON.parse(raw);
    return page?.posts?.length ? { pages: [page], pageParams: [0] } : undefined;
  } catch { return undefined; }
};
const writeFeedCache = (tab, data) => {
  if (tab !== 'all') return;
  try {
    const first = data?.pages?.[0];
    if (first?.posts?.length) localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ posts: first.posts.slice(0, 8), nextPage: first.nextPage }));
  } catch { /* storage full / unavailable */ }
};

// Filter tabs
const TABS = [
  { key: 'all',        label: 'All' },
  { key: 'photo',      label: 'Photos' },
  { key: 'reel',       label: 'Reels' },
  { key: 'experience', label: 'Experiences' },
  { key: 'trip',       label: 'Trips' },
];

async function fetchPostsPage({ pageParam = 0, tab = 'all' }) {
  let query = supabase
    .from('posts')
    .select(`
      id, author_id, content, image_url, media_type, post_images,
      post_type, is_reel, mountain_id, mountain_name, status,
      likes_count, comments_count, created_date, trip_data,
      package_id, package_price, agency_id, agency_name,
      profiles ( full_name, email, avatar_url )
    `)
    .eq('status', 'active')
    .order('created_date', { ascending: false })
    .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

  // Tab filtering
  if (tab === 'reel') {
    query = query.eq('is_reel', true);
  } else if (tab === 'experience') {
    query = query.eq('post_type', 'experience');
  } else if (tab === 'trip') {
    query = query.eq('post_type', 'trip');
  } else if (tab === 'photo') {
    query = query.in('post_type', ['photo', 'carousel']).eq('is_reel', false);
  }

  const { data: posts, error } = await query;
  if (error) throw error;
  if (!posts?.length) return { posts: [], nextPage: null };

  const tripIds = [...new Set(posts
    .filter(post => post.post_type === 'trip')
    .map(post => post.trip_data?.id)
    .filter(Boolean))];
  const authorEmails = [...new Set(posts.map(p => p.profiles?.email).filter(Boolean))];

  // These two lookups do not depend on each other: run them at the same time (was one after the other)
  const [tripsRes, agenciesRes] = await Promise.all([
    tripIds.length
      ? supabase.from('trips').select('id, status, is_public, start_date, end_date').in('id', tripIds)
      : Promise.resolve({ data: [], error: null }),
    authorEmails.length
      ? supabase.from('agencies').select('owner_email, name, logo_url, is_verified').in('owner_email', authorEmails).eq('status', 'approved')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (tripsRes.error) throw tripsRes.error;

  const validTripIds = new Set((tripsRes.data || [])
    .filter(trip =>
      trip.status !== 'completed' &&
      trip.status !== 'cancelled' &&
      trip.is_public !== false &&
      !isTripExpired(trip)
    )
    .map(trip => trip.id));

  const visiblePosts = posts.filter(post =>
    post.post_type !== 'trip' || validTripIds.has(post.trip_data?.id)
  );
  if (!visiblePosts.length) return { posts: [], nextPage: posts.length === PAGE_SIZE ? pageParam + 1 : null };

  const agencyMap = {};
  (agenciesRes.data || []).forEach(a => { agencyMap[a.owner_email] = a; });

  const result = visiblePosts.map(p => ({ ...p, agency: agencyMap[p.profiles?.email] || null }));

  return {
    posts: result,
    nextPage: posts.length === PAGE_SIZE ? pageParam + 1 : null,
  };
}

// ── Story Viewer (full-screen) ────────────────────────────────────────────────
function StoryViewer({ authorId, authorName, avatarUrl, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [imgBroken, setImgBroken] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const DURATION = 5000;

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from('posts')
      .select('id, content, image_url, media_type, post_images, post_type, is_reel, created_date, mountain_name')
      .eq('author_id', authorId)
      .eq('status', 'active')
      .gte('created_date', since)
      .order('created_date', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        // newest 10, shown oldest -> newest so the newest story is last (on the right), like Instagram
        setPosts([...(data || [])].reverse());
        setLoading(false);
      });
  }, [authorId]);

  // Auto-advance timer
  useEffect(() => {
    if (loading || !posts.length) return;
    setProgress(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        if (index < posts.length - 1) setIndex(i => i + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [index, loading, posts.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') { clearInterval(timerRef.current); if (index < posts.length - 1) setIndex(i => i + 1); else onClose(); }
      if (e.key === 'ArrowLeft') { clearInterval(timerRef.current); setIndex(i => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, posts.length, onClose]);

  const current = posts[index];
  const mediaUrl = current?.image_url || current?.post_images?.[0] || null;
  const isVideo = !!mediaUrl && (current?.media_type === 'video' || current?.is_reel || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(mediaUrl));
  useEffect(() => { setImgBroken(false); }, [index]);
  const openProfile = () => { onClose(); navigate(authorId === user?.id ? '/profile' : `/profile/${authorId}`); };
  const initials = authorName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" onClick={onClose}>
      <div
        className="relative w-full max-w-sm h-full max-h-[90vh] bg-black rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ aspectRatio: '9/16' }}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {posts.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-0 right-0 z-20 flex items-center gap-2 px-3 pt-2">
          <button type="button" onClick={openProfile} className="flex items-center gap-2 flex-1 min-w-0 text-left" aria-label={`Open ${authorName}'s profile`}>
            <div className="w-9 h-9 rounded-full border-2 border-white overflow-hidden shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
              }
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {authorName}
                {current?.created_date && (
                  <span className="text-white/70 font-normal text-xs ml-2">{formatDistanceToNow(new Date(current.created_date), { addSuffix: false })}</span>
                )}
              </p>
              {current?.mountain_name && (
                <p className="text-white/70 text-[10px]">📍 {current.mountain_name}</p>
              )}
            </div>
          </button>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Media */}
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !posts.length ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-2">
            <p className="text-sm">No stories in the last 24 hours</p>
          </div>
        ) : mediaUrl && isVideo ? (
          <video key={mediaUrl} src={mediaUrl} className="w-full h-full object-contain bg-black" autoPlay muted loop playsInline />
        ) : mediaUrl && imgBroken ? (
          <div className="w-full h-full flex items-center justify-center text-white/70 text-sm px-8 text-center">This image cannot be displayed</div>
        ) : mediaUrl ? (
          <img src={mediaUrl} alt="" className="w-full h-full object-cover" onError={() => setImgBroken(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/80 to-green-600 flex items-center justify-center p-6">
            <p className="text-white text-center text-lg font-semibold leading-relaxed">{current?.content}</p>
          </div>
        )}

        {/* Caption overlay */}
        {mediaUrl && current?.content && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-4 pb-6 pt-10">
            <p className="text-white text-sm leading-relaxed line-clamp-3">{current.content}</p>
          </div>
        )}

        {/* Tap zones */}
        <button
          className="absolute left-0 top-0 w-1/3 h-full z-10"
          onClick={() => { clearInterval(timerRef.current); setIndex(i => Math.max(0, i - 1)); }}
        />
        <button
          className="absolute right-0 top-0 w-1/3 h-full z-10"
          onClick={() => { clearInterval(timerRef.current); if (index < posts.length - 1) setIndex(i => i + 1); else onClose(); }}
        />
      </div>
    </div>
  );
}

// ── Stories Bar ───────────────────────────────────────────────────────────────
function StoriesBar({ onCreateStory }) {
  const { user } = useAuth();
  const [viewing, setViewing] = useState(null);

  const { data: stories = [] } = useQuery({
    queryKey: ['stories-bar'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('posts')
        .select('author_id, profiles(full_name, avatar_url), created_date')
        .eq('status', 'active')
        .gte('created_date', since)
        .order('created_date', { ascending: false })
        .limit(30);

      if (!data) return [];
      const seen = new Set();
      return data.filter(p => {
        if (seen.has(p.author_id)) return false;
        seen.add(p.author_id);
        return true;
      }).slice(0, 12);
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const myStory = stories.find(s => s.author_id === user?.id);

  return (
    <>
      <div className="bg-card border rounded-2xl p-3 mb-4 shadow-sm overflow-hidden">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="relative w-14 h-14">
              <button
                onClick={() => myStory
                  ? setViewing({ authorId: user.id, authorName: user.full_name || 'You', avatarUrl: user.avatar_url })
                  : onCreateStory()
                }
                className={`w-14 h-14 rounded-full p-0.5 ${myStory ? 'bg-gradient-to-br from-primary to-green-400' : 'border-2 border-dashed border-primary/40 hover:border-primary transition-colors'}`}
              >
                <div className={`w-full h-full rounded-full overflow-hidden ${myStory ? 'bg-card p-0.5' : 'bg-primary/10 flex items-center justify-center'}`}>
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                    : <span className="text-primary font-bold text-sm">{userInitials}</span>
                  }
                </div>
              </button>
              <button
                onClick={onCreateStory}
                className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-card hover:bg-primary/80 transition-colors"
              >
                <span className="text-primary-foreground text-xs font-bold leading-none">+</span>
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium w-14 text-center truncate">
              {myStory ? 'Your Story' : 'Add Story'}
            </span>
          </div>

          {stories.filter(s => s.author_id !== user?.id).map((s) => {
            const name = s.profiles?.full_name || 'Hiker';
            const firstName = name.split(' ')[0];
            const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <button
                key={s.author_id}
                onClick={() => setViewing({ authorId: s.author_id, authorName: name, avatarUrl: s.profiles?.avatar_url })}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-primary to-green-400">
                  <div className="w-full h-full rounded-full bg-card p-0.5">
                    {s.profiles?.avatar_url
                      ? <img src={s.profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      : <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold text-xs">{initials}</span>
                        </div>
                    }
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium w-14 text-center truncate">{firstName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {viewing && (
        <StoryViewer
          authorId={viewing.authorId}
          authorName={viewing.authorName}
          avatarUrl={viewing.avatarUrl}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

// ── Filter Tabs ───────────────────────────────────────────────────────────────
function FilterTabs({ activeTab, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
            activeTab === tab.key
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Pull to Refresh ───────────────────────────────────────────────────────────
function usePullToRefresh(onRefresh) {
  const startY = useRef(0);
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);

  useEffect(() => {
    const el = document.documentElement;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (!startY.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && el.scrollTop === 0) {
        setPulling(true);
        setPullY(Math.min(delta * 0.4, 60));
      }
    };
    const onTouchEnd = () => {
      if (pullY > 40) onRefresh();
      startY.current = 0;
      setPulling(false);
      setPullY(0);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, onRefresh]);

  return { pulling, pullY };
}

// ── Main Feed ─────────────────────────────────────────────────────────────────
export default function Feed() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState('photo');
  const [commentPost, setCommentPost] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedSeed, setFeedSeed] = useState(() => Math.random()); // new mix on every app open / refresh
  const loaderRef = useRef(null);
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['posts', activeTab],
    queryFn: ({ pageParam = 0 }) => fetchPostsPage({ pageParam, tab: activeTab }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false, // coming back from Share / the keyboard used to reload the feed
    initialData: () => readFeedCache(activeTab),
    initialDataUpdatedAt: 0, // cached data shows at once but is treated as stale -> refreshes in background
    networkMode: 'offlineFirst',
  });

  useEffect(() => { writeFeedCache(activeTab, data); }, [activeTab, data]);

  // First page: shuffled with this session's seed (newer posts favoured). Later pages stay in order.
  const posts = useMemo(() => {
    const pages = data?.pages ?? [];
    if (!pages.length) return [];
    return [...orderFeedPage(pages[0].posts, feedSeed), ...pages.slice(1).flatMap(p => p.posts)];
  }, [data, feedSeed]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setFeedSeed(Math.random());
    // Refreshing re-downloaded every page you had scrolled through, one after another (slow).
    // Keep just the first page and fetch that.
    queryClient.setQueryData(['posts', activeTab], (old) =>
      old?.pages?.length > 1 ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) } : old);
    try { await refetch(); } finally { setIsRefreshing(false); }
  }, [refetch, queryClient, activeTab]);
  const refreshRef = useRef(handleRefresh);
  useEffect(() => { refreshRef.current = handleRefresh; }, [handleRefresh]);

  // Coming back to the app after a while (recent apps, other app, locked screen): jump to the top and refresh
  useEffect(() => {
    const AWAY_MS = 20_000;
    let hiddenAt = null;
    const goHidden = () => { if (hiddenAt === null) hiddenAt = Date.now(); };
    const goActive = () => {
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away < AWAY_MS) return;
      window.scrollTo({ top: 0 });
      document.querySelector('main')?.scrollTo?.({ top: 0 });
      refreshRef.current();
      queryClient.invalidateQueries({ queryKey: ['stories-bar'] });
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? goHidden() : goActive());
    document.addEventListener('visibilitychange', onVisibility);
    let nativeHandle;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => (isActive ? goActive() : goHidden()))
        .then(h => { nativeHandle = h; })
        .catch(() => {});
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      nativeHandle?.remove();
    };
  }, [queryClient]);

  const { pulling, pullY } = usePullToRefresh(handleRefresh);

  // Tapping the Feed tab while already on Feed: jump to the newest post and refresh
  useEffect(() => {
    const onFeedTap = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('main')?.scrollTo?.({ top: 0, behavior: 'smooth' });
      handleRefresh();
      queryClient.invalidateQueries({ queryKey: ['stories-bar'] });
    };
    window.addEventListener('melotrip:feed-refresh', onFeedTap);
    return () => window.removeEventListener('melotrip:feed-refresh', onFeedTap);
  }, [handleRefresh, queryClient]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', activeTab] });
    queryClient.invalidateQueries({ queryKey: ['stories-bar'] });
  };

  const openCreate = (mode = 'photo') => {
    setCreateMode(mode);
    setShowCreate(true);
  };

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="w-full max-w-2xl mx-auto px-0 py-0 sm:px-4 sm:py-5 overflow-x-hidden">

    {/* Pull to refresh indicator */}
    {(pulling || isRefreshing) && (
      <div
        className="flex justify-center items-center transition-all duration-200 sm:mx-0"
        style={{ height: pullY || (isRefreshing ? 40 : 0), overflow: 'hidden' }}
      >
        <RefreshCw className={`w-5 h-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
      </div>
    )}

    {/* Top bar with Search (people, agencies, mountains) */}
    <div className="flex items-center justify-between px-4 pt-3 sm:px-0 sm:pt-0">
      <span className="font-display text-xl font-bold text-foreground md:invisible">Melotrip</span>
      <Link to="/search" aria-label="Search" className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center">
        <Search className="w-5 h-5" />
      </Link>
    </div>

    {/* Stories Bar */}
    <div className="px-3 pt-3 sm:px-0 sm:pt-0">
      <StoriesBar onCreateStory={() => openCreate('photo')} />
    </div>

    {/* Featured agencies (Pro / Yearly plans) */}
    <div className="px-3 sm:px-0">
      <FeaturedAgencies />
    </div>

    {/* Create Post Box */}
    <div className="mx-3 bg-card border rounded-2xl p-4 mb-5 shadow-sm sm:mx-0">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10 shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
              : <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{userInitials}</AvatarFallback>
            }
          </Avatar>
          <button
            onClick={() => openCreate('photo')}
            className="flex-1 bg-muted hover:bg-muted/80 rounded-full px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors"
          >
            How was your last trip?
          </button>
        </div>

        <div className="flex gap-1 border-t pt-3">
          <button
            onClick={() => openCreate('reel')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-purple-50 transition-colors text-sm font-semibold text-purple-600 group"
          >
            <Film className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Reel / Vlog</span>
            <span className="sm:hidden">Reel</span>
          </button>
          <button
            onClick={() => openCreate('photo')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-green-50 transition-colors text-sm font-semibold text-green-600 group"
          >
            <Image className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Photo / Album</span>
            <span className="sm:hidden">Photo</span>
          </button>
          <button
            onClick={() => openCreate('experience')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-amber-50 transition-colors text-sm font-semibold text-amber-600 group"
          >
            <Smile className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Experience</span>
            <span className="sm:hidden">Report</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 sm:px-0">
        <FilterTabs activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); }} />
      </div>

      {/* Posts */}
      {isLoading ? (
        <FeedSkeleton count={3} />
      ) : error && posts.length === 0 ? (
        <div className="text-center py-12 text-destructive text-sm">
          Error loading posts: {error.message}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Compass className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-1">No posts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {activeTab === 'all'
              ? 'Be the first to share your trip!'
              : `No ${TABS.find(t => t.key === activeTab)?.label} posts yet.`}
          </p>
          <Button onClick={() => openCreate('photo')} className="rounded-full">
            <PenSquare className="w-4 h-4 mr-2" /> Share now
          </Button>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onComment={setCommentPost}
            />
          ))}

          {/* Infinite scroll loader */}
          <div ref={loaderRef} className="flex justify-center py-4 px-3 sm:px-0">
            {isFetchingNextPage && <FeedSkeleton count={1} />}
            {!hasNextPage && posts.length > 0 && (
              <p className="text-xs text-muted-foreground">You've seen all posts.</p>
            )}
          </div>
        </div>
      )}

      <CreatePostDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={refresh}
        initialMode={createMode}
      />
      <CommentsSheet
        post={commentPost}
        open={!!commentPost}
        onOpenChange={() => setCommentPost(null)}
      />

      {/* FAB */}
      <Button
        onClick={() => openCreate('photo')}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-xl z-40"
        size="icon"
      >
        <PenSquare className="w-6 h-6" />
      </Button>
    </div>
  );
}