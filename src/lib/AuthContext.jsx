import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
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

      const merged = finalProfile
        ? { ...authUser, ...finalProfile }
        : { ...authUser, role: 'user', full_name: authUser.user_metadata?.full_name };

      setUser(merged);
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
        setIsLoadingAuth(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
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