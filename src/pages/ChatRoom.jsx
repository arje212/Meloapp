import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ChatRoom() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roomId = window.location.pathname.split('/chat/')[1];
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: room } = useQuery({
    queryKey: ['chatroom', roomId],
    queryFn: () => base44.entities.ChatRoom.filter({ id: roomId }).then(list => list[0]),
    enabled: !!roomId,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', roomId],
    queryFn: () => base44.entities.ChatMessage.filter({ room_id: roomId }, 'created_date', 200),
    enabled: !!roomId,
    refetchInterval: 3000, // poll every 3s since subscribe may not exist
  });

  // Mark messages as read
  useEffect(() => {
    if (!messages.length || !user?.email) return;
    const unread = messages.filter(m => !m.is_read && m.sender_email !== user.email);
    unread.forEach(m => base44.entities.ChatMessage.update(m.id, { is_read: true }));
  }, [messages, user?.email]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const getRoomName = () => {
    if (!room) return 'Chat';
    if (room.name) return room.name;
    const otherIdx = room.participants?.indexOf(user.email) === 0 ? 1 : 0;
    return room.participant_names?.[otherIdx] || 'Chat';
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    await base44.entities.ChatMessage.create({
      room_id: roomId,
      sender_email: user.email,
      sender_name: user.full_name,
      content: message.trim(),
      is_read: false,
    });
    await base44.entities.ChatRoom.update(roomId, {
      last_message: message.trim(),
      last_message_time: new Date().toISOString(),
    });
    setMessage('');
    setIsSending(false);
    queryClient.invalidateQueries({ queryKey: ['messages', roomId] });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <button onClick={() => navigate('/chat')} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar className="w-9 h-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {getRoomName()?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-sm">{getRoomName()}</h3>
          <p className="text-[10px] text-muted-foreground">{room?.participants?.length || 0} participants</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_email === user.email;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${isMe ? 'order-2' : ''}`}>
                {!isMe && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.sender_name}</p>}
                <div className={`rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
                <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                  {formatDistanceToNow(new Date(msg.created_date || msg.created_date), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-card">
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="rounded-full"
        />
        <Button size="icon" className="rounded-full shrink-0" onClick={handleSend} disabled={!message.trim() || isSending}>
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}