import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, X, Mountain, Store, UserRound, BadgeCheck, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { searchProfiles } from '@/lib/profileLookup';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ListSkeleton } from '@/components/Skeletons';

// ilike treats % and _ as wildcards: search for the text the user typed, literally
const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const TABS = [
  { key: 'people', label: 'People', icon: UserRound },
  { key: 'agencies', label: 'Agencies', icon: Store },
  { key: 'mountains', label: 'Mountains', icon: Mountain },
];

async function runSearch(tab, q, myId) {
  if (tab === 'people') return searchProfiles(q, { limit: 25, excludeId: myId, withBio: true });
  if (tab === 'agencies') {
    const { data, error } = await supabase.from('agencies').select('*').eq('status', 'approved').ilike('name', like(q)).limit(25);
    if (error) throw error;
    return data || [];
  }
  const { data, error } = await supabase.from('mountains').select('*').ilike('name', like(q)).order('name').limit(25);
  if (error) throw error;
  return data || [];
}

function Row({ to, image, fallback, title, subtitle, badge }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 active:bg-muted transition-colors">
      <Avatar className="w-12 h-12 shrink-0">
        {image
          ? <img src={image} alt="" className="w-full h-full object-cover rounded-full" loading="lazy" />
          : <AvatarFallback className="bg-primary/10 text-primary font-bold">{fallback}</AvatarFallback>}
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate flex items-center gap-1">{title}{badge && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate flex items-center gap-1">{subtitle}</p>}
      </div>
    </Link>
  );
}

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [tab, setTab] = useState('people');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: '', items: [] });

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setState({ loading: false, error: '', items: [] }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const timer = setTimeout(async () => {
      try {
        const items = await runSearch(tab, q, user?.id);
        if (!cancelled) setState({ loading: false, error: '', items });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: 'Hindi makapag-search ngayon. Subukan ulit.', items: [] });
        console.warn('[search] failed:', err?.message);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, tab, user?.id]);

  const q = query.trim();
  const initials = (name = '') => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-3 pt-3 pb-2" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hanapin ang tao, agency, o bundok..."
              className="w-full bg-muted rounded-full pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-24">
        {q.length < 2 ? (
          <p className="text-center text-sm text-muted-foreground py-16 px-6">Mag-type ng kahit 2 letra para mag-search.</p>
        ) : state.loading ? (
          <ListSkeleton rows={5} />
        ) : state.error ? (
          <p className="text-center text-sm text-destructive py-12 px-6">{state.error}</p>
        ) : state.items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16 px-6">Walang nakita para sa "{q}".</p>
        ) : (
          <div className="divide-y">
            {tab === 'people' && state.items.map((p) => (
              <Row key={p.id} to={`/profile/${p.id}`} image={p.avatar_url} fallback={initials(p.full_name)} title={p.full_name} subtitle={p.bio} />
            ))}
            {tab === 'agencies' && state.items.map((a) => (
              <Row key={a.id} to={`/agencies/${a.id}`} image={a.logo_url} fallback={initials(a.name)} title={a.name} badge={a.is_verified}
                subtitle={a.location ? <><MapPin className="w-3 h-3" />{a.location}</> : null} />
            ))}
            {tab === 'mountains' && state.items.map((m) => (
              <Row key={m.id} to={`/mountains/${m.id}`} image={m.image_url || m.cover_url} fallback="⛰️" title={m.name}
                subtitle={[m.location || m.province, m.elevation ? `${Number(m.elevation).toLocaleString()} m` : null].filter(Boolean).join(' · ') || null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
