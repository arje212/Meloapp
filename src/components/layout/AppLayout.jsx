import { Outlet, Link, useLocation } from 'react-router-dom';
import { Compass, Home, Map, CalendarDays, Store, MessageCircle, User, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';

/**
 * AgencyNavLink reads from the same query key used everywhere else in the app
 * ('my-agency', userEmail) so React Query serves it from cache — no extra fetch.
 */
function AgencyNavLink({ userEmail, pathname }) {
  const { data: agencies = [] } = useQuery({
    queryKey: ['my-agency', userEmail],
    queryFn:  () => base44.entities.Agency.filter({ owner_email: userEmail }),
    enabled:  !!userEmail,
    // Keep the result fresh for 5 minutes — same staleTime used in AgencyDashboard
    staleTime: 5 * 60 * 1000,
  });

  const approved = agencies.find(a => a.status === 'approved');
  const to       = approved ? '/agency-dashboard' : '/agency-register';

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        pathname.startsWith('/agency')
          ? 'bg-secondary text-secondary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <Store className="w-4 h-4" />
      My Agency
    </Link>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread messages every 10 seconds
  useEffect(() => {
    if (!user?.email) return;

    const fetchUnread = async () => {
      try {
        const { data: rooms } = await supabase
          .from('chat_rooms')
          .select('id')
          .contains('participants', [user.email]);

        if (!rooms?.length) { setUnreadCount(0); return; }

        const roomIds = rooms.map(r => r.id);
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('id')
          .neq('sender_email', user.email)
          .eq('is_read', false)
          .in('room_id', roomIds);

        setUnreadCount(messages?.length || 0);
      } catch { /* silent */ }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 10_000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const { data: unreadNotifications = [] } = useQuery({
    queryKey:       ['unread-notifs', user?.email],
    queryFn:        () => base44.entities.Notification.filter({ user_email: user?.email, is_read: false }),
    enabled:        !!user?.email,
    refetchInterval: 30_000,
  });

  const navItems = [
    { path: '/',         icon: Home,          label: 'Feed' },
    { path: '/mountains',icon: Map,           label: 'Explore' },
    { path: '/trips',    icon: CalendarDays,  label: 'Trips' },
    { path: '/agencies', icon: Store,         label: 'Agencies' },
    { path: '/chat',     icon: MessageCircle, label: 'Chat',    badge: unreadCount },
    { path: '/profile',  icon: User,          label: 'Profile', badge: unreadNotifications.length },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Desktop header */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold text-foreground">Melotrip</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(item => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span className="relative">
                  <item.icon className="w-4 h-4" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}

          {(user?.role === 'agency' || user?.role === 'admin') && (
            <AgencyNavLink userEmail={user?.email} pathname={location.pathname} />
          )}

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname.startsWith('/admin')
                  ? 'bg-destructive text-destructive-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-1"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around py-2">
          {navItems.map(item => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}