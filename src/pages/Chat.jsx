import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Chat() {
  const { user } = useAuth();

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['chatrooms', user?.email],
    queryFn: async () => {
      const all = await base44.entities.ChatRoom.list('-updated_date', 100);
      return all.filter(r => r.participants?.includes(user.email));
    },
    enabled: !!user?.email,
  });

  const getChatName = (room) => {
    if (room.name) return room.name;
    const otherIdx = room.participants?.indexOf(user.email) === 0 ? 1 : 0;
    return room.participant_names?.[otherIdx] || room.participants?.[otherIdx] || 'Chat';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">Messages</h1>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No conversations yet</h3>
          <p className="text-sm text-muted-foreground">Start chatting with other hikers or agencies</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rooms.map(room => (
            <Link key={room.id} to={`/chat/${room.id}`}>
              <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getChatName(room)?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm truncate">{getChatName(room)}</h3>
                    {room.last_message_time && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(room.last_message_time), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {room.last_message && (
                    <p className="text-xs text-muted-foreground truncate">{room.last_message}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}