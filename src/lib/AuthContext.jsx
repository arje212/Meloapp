import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { removePushToken } from '@/lib/pushNotifications';
import { toast } from '@/components/ui/use-toast';

const AuthContext = createContext();

// ── Instant start ────────────────────────────────────────────────────────────
// Supabase keeps the session in localStorage. If one exists we already know the user is
// signed in, so show the app right away (like Facebook) and verify in the background.
const PROFILE_CACHE_KEY = 'melotrip.profile.v1';
const sessionStorageKey = () => {
  try { return `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`; }
  catch { return null; }
};
const readCachedUser = () => {
  try {
    const key = sessionStorageKey();
    const rawSession = key && localStorage.getItem(key);
    if (!rawSession) return { hasSession: false, user: null };
    const session = JSON.parse(rawSession);
    if (!session?.access_token && !session?.refresh_token) return { hasSession: false, user: null };
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null');
    // Only trust the cache when it belongs to the signed-in account
    const sameUser = cached?.id && session?.user?.id && cached.id === session.user.id;
    return { hasSession: true, user: sameUser ? cached : null };
  } catch { return { hasSession: false, user: null }; }
};
const writeCachedUser = (u) => {
  try {
    if (u) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(u));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch { /* storage unavailable */ }
};
const INITIAL = readCachedUser();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(INITIAL.user);
  const [isAuthenticated, setIsAuthenticated] = useState(!!INITIAL.user);
  // No session on this device -> go straight to Login (no spinner).
  // Session but no cached profile (first run after update) -> brief skeleton.
  const [isLoadingAuth, setIsLoadingAuth] = useState(INITIAL.hasSession && !INITIAL.user);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [authError, setAuthError] = useState(null);

  // Declared first so the useEffects below can reference it
  const loadProfile = async (authUser) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      let finalProfile = profile;
      if (!finalProfile) {
        // First sign-in after email confirmation: signup could not create the row (no session yet).
        // Always created as a normal 'user' - never elevated here.
        try {
          const { data: created } = await supabase
            .from('profiles')
            .upsert({
              id: authUser.id,
              email: authUser.email,
              full_name: authUser.user_metadata?.full_name || authUser.email,
              role: 'user',
            })
            .select()
            .maybeSingle();
          finalProfile = created || null;
        } catch (e) {
          console.warn('Profile bootstrap failed:', e);
        }
      }

      // Enforce the admin "Block" action (previously is_blocked was written but never checked).
      // NOTE: this is a client-side check; real enforcement still needs RLS / an auth hook.
      if (finalProfile?.is_blocked) {
        setAuthError({ type: 'user_blocked', message: 'Your account has been blocked. Please contact support.' });
        await supabase.auth.signOut();
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      setAuthError(null);

      let merged = finalProfile
        ? { ...authUser, ...finalProfile }
        : { ...authUser, role: 'user', full_name: authUser.user_metadata?.full_name };

      // Logging in again brings a deactivated account back (like Facebook)
      if (finalProfile?.deactivated_at) {
        const { error: reactivateError } = await supabase.from('profiles').update({ deactivated_at: null }).eq('id', authUser.id);
        if (!reactivateError) {
          merged = { ...merged, deactivated_at: null };
          toast({ title: 'Welcome back!', description: 'Na-reactivate na ang account mo.' });
        }
      }

      setUser(merged);
      writeCachedUser(merged);
      setIsAuthenticated(true);
    } catch (e) {
      setUser({ ...authUser, role: 'user' });
      setIsAuthenticated(true);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        // Cached login is no longer valid
        writeCachedUser(null);
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    }).catch(() => setIsLoadingAuth(false)); // weak signal: keep the cached view

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        writeCachedUser(null);
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setOnlineUsers([]);
      return undefined;
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.email } },
    });

    const syncPresence = () => {
      const state = channel.presenceState();
      const users = Object.values(state)
        .flat()
        .filter(Boolean)
        .map((presence) => ({
          email: presence.email,
          name: presence.name || 'Hiker',
          role: presence.role || 'user',
          onlineAt: presence.onlineAt,
        }))
        .filter((presence, index, list) =>
          presence.email && list.findIndex(item => item.email === presence.email) === index
        );
      setOnlineUsers(users);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({
          email: user.email,
          name: user.full_name || 'Hiker',
          role: user.role || 'user',
          onlineAt: new Date().toISOString(),
        });
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user?.email, user?.full_name, user?.role]);

  const logout = async () => {
    await removePushToken(); // stop notifications for this account on this phone
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      onlineUsers,
      logout,
      navigateToLogin: () => {},
      checkUserAuth: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await loadProfile(session.user);
      },
      checkAppState: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};