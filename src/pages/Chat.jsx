import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  MessageCircle, Loader2, Users, AlertCircle, Mountain,
  Search, Edit3,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  getInitials, fetchMyChatRooms, findExistingGroupChat,
  fetchProfileNamesForEmails,
} from '@/lib/chatHelpers';

// ── Online dot ────────────────────────────────────────────────────────────────
function OnlineDot({ size = 'md' }) {
  const s = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return (
    <span className={`${s} rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900 block`} />
  );
}

// ── Conversation card ─────────────────────────────────────────────────────────
function ConversationCard({ room, currentUserEmail, onlineEmails }) {
  const isGroup = room.type === 'group';

  const chatName = (() => {
    if (isGroup) return room.name || 'Group Chat';
    const otherIdx = room.participants?.indexOf(currentUserEmail) === 0 ? 1 : 0;
    return room.participant_names?.[otherIdx] || 'Hiker';
  })();

  // ✅ FIX: Use trip_title field directly instead of brittle string parsing
  const tripTitle = room.trip_title || null;

  const otherEmail = (() => {
    if (isGroup) return null;
    const idx = room.participants?.indexOf(currentUserEmail) === 0 ? 1 : 0;
    return room.participants?.[idx];
  })();

  const isOnline = otherEmail ? onlineEmails.has(otherEmail) : false;
  const unread = room._unread || 0;
  const lastMsg = room.last_message || '';

  return (
    <Link to={`/chat/${room.id}`}>
      <div className="group flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all duration-150 cursor-pointer">
        {/* Avatar */}
        <div className="relative shrink-0">
          {isGroup ? (
            <div className="w-13 h-13 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-sm" style={{ width: 52, height: 52 }}>
              <Users className="w-5 h-5 text-white" />
            </div>
          ) : (
            <Avatar className="w-13 h-13 shadow-sm" style={{ width: 52, height: 52 }}>
              <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white font-bold text-lg">
                {getInitials(chatName)}
              </AvatarFallback>
            </Avatar>
          )}
          {isOnline && (
            <span className="absolute bottom-0.5 right-0.5">
              <OnlineDot size="sm" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-sm truncate ${unread > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-100'}`}>
              {chatName}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0 ml-2">
              {room.last_message_time ? formatDistanceToNow(new Date(room.last_message_time), { addSuffix: false }) : ''}
            </span>
          </div>

          {/* ✅ FIX: Use trip_title directly */}
          {tripTitle && (
            <div className="flex items-center gap-1 text-[10px] text-blue-500 mb-0.5">
              <Mountain className="w-2.5 h-2.5" />
              <span className="truncate">{tripTitle}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs truncate ${unread > 0 ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
              {lastMsg || 'No messages yet'}
            </p>
            {unread > 0 && (
              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main Chat list ────────────────────────────────────────────────────────────
export default function Chat() {
  const { user, onlineUsers = [] } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', participants: '' });
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const onlineEmails = new Set(onlineUsers.map(u => u.email));

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['chatrooms', user?.email],
    queryFn: async () => {
      const rooms = await fetchMyChatRooms(user.email, { withUnread: true });
      const missingNames = rooms.flatMap(room =>
        (room.participants || []).filter((email, index) =>
          !room.participant_names?.[index] ||
          room.participant_names[index].toLowerCase() === email.toLowerCase()
        )
      );
      const profileNames = await fetchProfileNamesForEmails(missingNames);
      return rooms.map(room => ({
        ...room,
        participant_names: (room.participants || []).map((email, index) => {
          const existingName = room.participant_names?.[index];
          return profileNames[email] ||
            (existingName && existingName.toLowerCase() !== email.toLowerCase() ? existingName : 'Hiker');
        }),
      }));
    },
    enabled: !!user?.email,
  });

  // Realtime: refresh list when a message arrives
  useEffect(() => {
    if (!user?.email) return;
    const channel = supabase
      .channel('chat-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        qc.invalidateQueries({ queryKey: ['chatrooms', user.email] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.email, qc]);

  const filteredRooms = searchQuery.trim()
    ? rooms.filter(r => {
        const name = r.name?.toLowerCase() || '';
        const parts = (r.participant_names || []).join(' ').toLowerCase();
        const trip = r.trip_title?.toLowerCase() || '';
        return name.includes(searchQuery.toLowerCase())
          || parts.includes(searchQuery.toLowerCase())
          || trip.includes(searchQuery.toLowerCase());
      })
    : rooms;

  const createGroupChat = async () => {
    const emails = groupForm.participants
      .split(/[\n,;]/).map(e => e.trim().toLowerCase()).filter(Boolean).filter(e => e !== user.email);
    const uniqueEmails = [...new Set(emails)];
    if (!groupForm.name.trim() || uniqueEmails.length === 0) {
      setGroupError('Add a group name and at least one user email.'); return;
    }
    setIsCreatingGroup(true); setGroupError('');
    try {
      const participants = [user.email, ...uniqueEmails];
      const onlineByEmail = new Map(onlineUsers.map(u => [u.email, u.name]));
      const participantNames = [user.full_name || 'You', ...uniqueEmails.map(e => onlineByEmail.get(e) || 'Hiker')];
      const currentRooms = await fetchMyChatRooms(user.email);
      const existingRoom = findExistingGroupChat(currentRooms, {
        name: groupForm.name,
        participants,
      });
      if (existingRoom) {
        setGroupOpen(false);
        setGroupForm({ name: '', participants: '' });
        navigate(`/chat/${existingRoom.id}`);
        return;
      }

      const room = await base44.entities.ChatRoom.create({
        name: groupForm.name.trim(), type: 'group',
        participants, participant_names: participantNames,
        last_message: 'Group chat created',
        last_message_time: new Date().toISOString(),
      });
      setGroupOpen(false); setGroupForm({ name: '', participants: '' });
      qc.invalidateQueries({ queryKey: ['chatrooms', user?.email] });
      navigate(`/chat/${room.id}`);
    } catch (err) { setGroupError(err.message || 'Unable to create group chat.'); }
    finally { setIsCreatingGroup(false); }
  };

  return (
    <div className="max-w-lg mx-auto h-[calc(100vh-64px)] md:h-screen flex flex-col bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="px-5 pt-6 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Chats</h1>
          <button
            onClick={() => setGroupOpen(true)}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center transition-colors text-blue-500"
            title="New group"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        {/* Search — also searches trip titles now */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search chats or trips..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-800 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-400/40 transition-all"
          />
        </div>
      </div>

      {/* Online strip */}
      {onlineUsers.length > 0 && (
        <div className="px-5 mb-2 shrink-0">
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
            {onlineUsers.slice(0, 12).map(online => (
              <div key={online.email} className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative">
                  <Avatar className="w-12 h-12 ring-2 ring-white dark:ring-gray-900">
                    <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white font-bold text-sm">
                      {getInitials(online.name || 'Hiker')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0"><OnlineDot size="sm" /></span>
                </div>
                <span className="text-[10px] text-gray-500 max-w-[52px] truncate text-center">{online.name?.split(' ')[0] || 'Hiker'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-20 md:pb-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-9 h-9 text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No conversations yet</h3>
            <p className="text-sm text-gray-400">Start chatting with other hikers or agencies</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredRooms.map(room => (
              <ConversationCard
                key={room.id}
                room={room}
                currentUserEmail={user.email}
                onlineEmails={onlineEmails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Group dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              New Group Chat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Group Name</Label>
              <Input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="Weekend hikers..." className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Participants</Label>
              <Textarea value={groupForm.participants} onChange={e => setGroupForm(f => ({ ...f, participants: e.target.value }))} placeholder="email1@example.com, email2@example.com" className="mt-1.5 resize-none rounded-xl" rows={4} />
              <p className="mt-1 text-xs text-gray-400">Separate emails with comma or new line.</p>
            </div>
            {groupError && (
              <p className="flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {groupError}
              </p>
            )}
            <Button className="w-full rounded-full bg-blue-500 hover:bg-blue-600 text-white font-semibold" onClick={createGroupChat} disabled={isCreatingGroup}>
              {isCreatingGroup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}