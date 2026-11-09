import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ListSkeleton } from '@/components/Skeletons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ACHIEVEMENT_DEFINITIONS } from '@/lib/achievements';

// ── Single place to configure which timestamp column your table uses ──────────
// Change this to 'created_at' if your Supabase table uses that name instead.
const TIMESTAMP_COL = 'created_date';

const typeColors = {
  achievement: 'bg-yellow-100 text-yellow-700',
  booking:     'bg-blue-100 text-blue-700',
  agency:      'bg-purple-100 text-purple-700',
  comment:     'bg-green-100 text-green-700',
  roadmap:     'bg-orange-100 text-orange-700',
  system:      'bg-muted text-muted-foreground',
};

// Where a notification opens. Older rows only have link '/' or nothing, so fall back by type.
const FALLBACK_LINKS = {
  achievement: '/achievements',
  roadmap: '/roadmap',
  agency: '/agency-dashboard',
  booking: '/trips',
  comment: '/',
  system: '/notifications',
};
export function resolveNotificationLink(n) {
  const link = typeof n?.link === 'string' ? n.link.trim() : '';
  if (link.startsWith('/') && !link.startsWith('//')) return link;
  return FALLBACK_LINKS[n?.type] || '/';
}

async function fetchNotifications(userEmail) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_email', userEmail)
    .order(TIMESTAMP_COL, { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export default function Notifications() {
  const { user }   = useAuth();
  const qc         = useQueryClient();
  const navigate   = useNavigate();

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn:  () => fetchNotifications(user.email),
    enabled:  !!user?.email,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_email', user.email)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifs'] });
    },
  });

  const [achievement, setAchievement] = useState(null);

  const markAsRead = async (n) => {
    if (n.is_read) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifs'] });
    } catch (err) {
      console.warn('Could not mark notification as read:', err);
    }
  };

  const markRead = async (n) => {
    // Achievement: show what it is for instead of just leaving the page
    if (n.type === 'achievement') {
      const name = String(n.title || '').replace(/^Achievement Unlocked:\s*/i, '').trim();
      const def = Object.values(ACHIEVEMENT_DEFINITIONS).find(d => d.title === name);
      setAchievement({
        icon: def?.icon || n.icon || '🏅',
        title: def?.title || name || 'Achievement',
        description: def?.description || n.message || '',
        xp: def?.xp_earned,
      });
      markAsRead(n);
      return;
    }

    let target = resolveNotificationLink(n);
    // Older "new follower" notifications only had a link to your own profile: find the follower by name
    const followMatch = String(n.message || '').match(/^(.+?) started following you\.?$/i);
    if (followMatch && (!n.link || n.link === '/profile')) {
      const { data } = await supabase.from('profiles').select('id').eq('full_name', followMatch[1].trim()).limit(2);
      if (data?.length === 1) target = `/profile/${data[0].id}`;
    }
    navigate(target);
    markAsRead(n);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {error && (
        <div className="text-center py-8 text-sm text-destructive bg-destructive/5 rounded-2xl">
          <p className="font-medium">Could not load notifications</p>
          <p className="text-muted-foreground mt-1">{error.message}</p>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton rows={7} />
      ) : !error && notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold">All caught up!</h3>
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const ts = n[TIMESTAMP_COL];
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => markRead(n)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markRead(n); } }}
                className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${
                  n.is_read ? 'bg-card' : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg ${
                  typeColors[n.type] || typeColors.system
                }`}>
                  {n.icon || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.is_read ? 'text-foreground' : 'text-foreground/80'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  {ts && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(ts), { addSuffix: true })}
                    </p>
                  )}
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!achievement} onOpenChange={(o) => !o && setAchievement(null)}>
        <DialogContent className="max-w-sm rounded-3xl text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Achievement</DialogTitle>
          </DialogHeader>
          {achievement && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center text-4xl">{achievement.icon}</div>
              <p className="text-xs font-semibold uppercase tracking-wider text-yellow-700">Achievement unlocked</p>
              <h2 className="font-display text-xl font-bold">{achievement.title}</h2>
              <p className="text-sm text-muted-foreground">{achievement.description}</p>
              {achievement.xp ? <p className="text-sm font-semibold text-primary">+{achievement.xp} XP</p> : null}
              <div className="flex gap-2 w-full pt-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={() => setAchievement(null)}>Close</Button>
                <Button className="flex-1 rounded-full" onClick={() => { setAchievement(null); navigate('/achievements'); }}>All achievements</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}