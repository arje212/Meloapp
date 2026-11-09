import { ListSkeleton } from '@/components/Skeletons';
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
import { Label } from '@/components/ui/label';
import {
  MessageCircle, Loader2, Users, AlertCircle, Mountain,
  Search, Edit3, X, UserRound,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  getInitials, fetchMyChatRooms, findExistingGroupChat,
  startDirectChat,
} from '@/lib/chatHelpers';
import { fetchProfilesByEmails, searchProfiles } from '@/lib/profileLookup';

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

  const isOnline = otherEmail ? onlineEmails.has(String(otherEmail).toLowerCase()) : false;
  const otherAvatar = (() => {
    if (isGroup) return null;
    const idx = room.participants?.indexOf(currentUserEmail) === 0 ? 1 : 0;
    return room.participant_avatars?.[idx] || null;
  })();
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
              {otherAvatar
                ? <img src={otherAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                : (
                  <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white font-bold text-lg">
                    {getInitials(chatName)}
                  </AvatarFallback>
                )}
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
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [groupMembers, setGroupMembers] = useState([]);     // [{ email, full_name, avatar_url }]
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState([]);          // people found by the search box
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState(null);
  const [startError, setStartError] = useState('');

  const onlineEmails = new Set(onlineUsers.map(u => String(u.email || '').toLowerCase()));

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['chatrooms', user?.email],
    queryFn: async () => {
      const rooms = await fetchMyChatRooms(user.email, { withUnread: true });
      const profiles = await fetchProfilesByEmails(rooms.flatMap(room => room.participants || []));
      return rooms.map(room => ({
        ...room,
        participant_names: (room.participants || []).map((email, index) => {
          const existingName = room.participant_names?.[index];
          return profiles[String(email).toLowerCase()]?.full_name ||
            (existingName && existingName.toLowerCase() !== email.toLowerCase() ? existingName : 'Hiker');
        }),
        participant_avatars: (room.participants || []).map(email => profiles[String(email).toLowerCase()]?.avatar_url || null),
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

  // Contacts strip: people you follow or already chat with. Never strangers who just registered.
  const { data: following = [] } = useQuery({
    queryKey: ['following', user?.email],
    queryFn: () => base44.entities.Follow.filter({ follower_email: user.email }),
    enabled: !!user?.email,
  });
  const myEmail = String(user?.email || '').toLowerCase();
  const contactEmails = [...new Set([
    ...following.map(f => String(f.following_email || '').toLowerCase()),
    ...rooms.filter(r => r.type !== 'group').flatMap(r => (r.participants || []).map(e => String(e).toLowerCase())),
  ])].filter(e => e && e !== myEmail);
  const { data: contactProfiles = {} } = useQuery({
    queryKey: ['chat-contacts', contactEmails.slice().sort().join(',')],
    queryFn: () => fetchProfilesByEmails(contactEmails),
    enabled: contactEmails.length > 0,
    staleTime: 60_000,
  });
  const contacts = contactEmails
    .map(email => ({ email, ...(contactProfiles[email] || {}), online: onlineEmails.has(email) }))
    .filter(c => c.full_name)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.full_name.localeCompare(b.full_name))
    .slice(0, 20);

  // Search other users by name (so you can chat with someone you have not messaged before)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || !user?.email) { setPeople([]); setSearchingPeople(false); return undefined; }
    let cancelled = false;
    setSearchingPeople(true);
    const timer = setTimeout(async () => {
      let data = [];
      let error = null;
      try { data = await searchProfiles(q, { limit: 15, excludeEmail: user.email }); } catch (e) { error = e; }
      if (cancelled) return;
      if (error) console.warn('[chat] people search failed:', error.message);
      setPeople((data || []).filter((p) => p.full_name && p.email));
      setSearchingPeople(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, user?.email]);

  useEffect(() => {
    const q = memberQuery.trim();
    if (!groupOpen || q.length < 2 || !user?.email) { setMemberResults([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      let data = [];
      try { data = await searchProfiles(q, { limit: 8, excludeEmail: user.email }); } catch { /* keep empty */ }
      if (!cancelled) setMemberResults((data || []).filter(p => p.full_name && p.email));
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [memberQuery, groupOpen, user?.email]);

  const addMember = (p) => {
    setGroupMembers(prev => prev.some(m => m.email.toLowerCase() === p.email.toLowerCase())
      ? prev
      : [...prev, { email: p.email, full_name: p.full_name, avatar_url: p.avatar_url }]);
    setMemberQuery(''); setMemberResults([]);
  };
  const removeMember = (email) => setGroupMembers(prev => prev.filter(m => m.email !== email));

  const handleStartChat = async (person) => {
    if (startingChatWith) return;
    setStartingChatWith(person.id); setStartError('');
    try {
      const room = await startDirectChat(user, person);
      qc.invalidateQueries({ queryKey: ['chatrooms', user.email] });
      navigate(`/chat/${room.id}`);
    } catch (err) {
      console.error('Start chat failed:', err);
      setStartError('Hindi ma-open ang chat. Subukan ulit.');
    } finally {
      setStartingChatWith(null);
    }
  };

  // People who already have a one-to-one chat in the list below are not repeated
  const directEmails = new Set(
    filteredRooms.filter((r) => r.type !== 'group').flatMap((r) => (r.participants || []).map((e) => String(e).toLowerCase())),
  );
  const newPeople = people.filter((p) => !directEmails.has(String(p.email).toLowerCase()));
  const isSearching = searchQuery.trim().length >= 2;

  const createGroupChat = async () => {
    if (!groupForm.name.trim() || groupMembers.length === 0) {
      setGroupError('Add a group name and at least one person.'); return;
    }
    setIsCreatingGroup(true); setGroupError('');
    try {
      const uniqueEmails = [...new Set(groupMembers.map(m => m.email.toLowerCase()))].filter(e => e !== String(user.email).toLowerCase());
      const participants = [user.email, ...uniqueEmails];
      const nameByEmail = new Map(groupMembers.map(m => [m.email.toLowerCase(), m.full_name]));
      const participantNames = [user.full_name || 'You', ...uniqueEmails.map(e => nameByEmail.get(e) || 'Hiker')];
      const currentRooms = await fetchMyChatRooms(user.email);
      const existingRoom = findExistingGroupChat(currentRooms, {
        name: groupForm.name,
        participants,
      });
      if (existingRoom) {
        setGroupOpen(false);
        setGroupForm({ name: '' }); setGroupMembers([]);
        navigate(`/chat/${existingRoom.id}`);
        return;
      }

      const room = await base44.entities.ChatRoom.create({
        name: groupForm.name.trim(), type: 'group',
        participants, participant_names: participantNames,
        last_message: 'Group chat created',
        last_message_time: new Date().toISOString(),
      });
      setGroupOpen(false); setGroupForm({ name: '' }); setGroupMembers([]);
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
            placeholder="Search chats, people or trips..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-800 rounded-full pl-10 pr-10 py-2.5 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-400/40 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-300/70 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Contacts strip: green dot = online, grayed out = offline (tap to chat) */}
      {contacts.length > 0 && !isSearching && (
        <div className="px-5 mb-2 shrink-0">
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
            {contacts.map(c => (
              <button
                key={c.email}
                type="button"
                onClick={() => handleStartChat({ id: c.id || c.email, email: c.email, full_name: c.full_name })}
                disabled={!!startingChatWith}
                className="flex flex-col items-center gap-1 shrink-0 w-14"
                aria-label={`Chat with ${c.full_name}${c.online ? ' (online)' : ''}`}
              >
                <div className="relative">
                  <Avatar className={`w-12 h-12 ring-2 ring-white dark:ring-gray-900 transition ${c.online ? '' : 'grayscale opacity-60'}`}>
                    {c.avatar_url
                      ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      : (
                        <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white font-bold text-sm">
                          {getInitials(c.full_name)}
                        </AvatarFallback>
                      )}
                  </Avatar>
                  {c.online && <span className="absolute bottom-0 right-0"><OnlineDot size="sm" /></span>}
                </div>
                <span className={`text-[10px] max-w-[56px] truncate text-center ${c.online ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>{c.full_name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-20 md:pb-4">
        {isLoading ? (
          <ListSkeleton rows={7} />
        ) : (
          <>
            {isSearching && filteredRooms.length > 0 && (
              <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Chats</p>
            )}

            {filteredRooms.length > 0 && (
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

            {/* People: tap to open (or start) a chat */}
            {isSearching && (
              <div className="mt-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">People</p>
                {startError && <p className="px-3 pb-1 text-xs text-red-500">{startError}</p>}
                {searchingPeople && newPeople.length === 0 ? (
                  <ListSkeleton rows={3} />
                ) : newPeople.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400">
                    {filteredRooms.length === 0 ? `Walang nakita para sa "${searchQuery.trim()}".` : 'Walang ibang tao na tugma.'}
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {newPeople.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleStartChat(p)}
                        disabled={!!startingChatWith}
                        className="w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 transition-colors disabled:opacity-60"
                      >
                        <Avatar className="w-12 h-12">
                          {p.avatar_url
                            ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                            : <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white font-bold text-sm">{getInitials(p.full_name)}</AvatarFallback>}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[15px] text-gray-900 dark:text-white truncate">{p.full_name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><UserRound className="w-3 h-3" /> I-tap para mag-chat</p>
                        </div>
                        {startingChatWith === p.id
                          ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          : <MessageCircle className="w-5 h-5 text-blue-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isSearching && filteredRooms.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-9 h-9 text-blue-400" />
                </div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No conversations yet</h3>
                <p className="text-sm text-gray-400">Search a name above to start chatting with other hikers or agencies</p>
              </div>
            )}
          </>
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
              {groupMembers.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {groupMembers.map(m => (
                    <span key={m.email} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 pl-1 pr-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-200">
                      <Avatar className="w-5 h-5">
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                          : <AvatarFallback className="text-[9px] bg-blue-200 text-blue-700">{getInitials(m.full_name)}</AvatarFallback>}
                      </Avatar>
                      {m.full_name}
                      <button type="button" onClick={() => removeMember(m.email)} aria-label={`Remove ${m.full_name}`}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <Input value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Hanapin ang pangalan..." className="mt-1.5 rounded-xl" />
              {memberResults.length > 0 && (
                <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  {memberResults.map(p => (
                    <button key={p.id} type="button" onClick={() => addMember(p)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Avatar className="w-8 h-8">
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                          : <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs font-bold">{getInitials(p.full_name)}</AvatarFallback>}
                      </Avatar>
                      <span className="text-sm font-medium truncate">{p.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-400">Hanapin sa pangalan at i-tap para idagdag. Hindi na kailangan ng email.</p>
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