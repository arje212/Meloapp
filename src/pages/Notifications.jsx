import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

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

  const markRead = async (n) => {
    if (!n.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', n.id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifs'] });
    }
    if (n.link) navigate(n.link);
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
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
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
                onClick={() => markRead(n)}
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
    </div>
  );
}