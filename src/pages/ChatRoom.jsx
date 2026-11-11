import { ChatSkeleton } from '@/components/Skeletons';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, Send, Loader2, Mountain, ImagePlus, X,
  Users, UserPlus, Search, UsersRound, Info, Mic,
  Play, Pause, Reply, Copy, Trash2,
  CheckCheck, Check, MoreHorizontal, Smile, ChevronDown, StopCircle,
  Pin, PinOff, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { prepareImageFile, downscaleImage } from '@/lib/prepareImage';
import { fetchProfilesByEmails } from '@/lib/profileLookup';
import {
  parseContent, buildContent, buildVoiceContent,
  dateSeparatorLabel, shouldShowSeparator, getInitials, REACTIONS_LIST,
  hydrateRoomParticipantNames,
} from '@/lib/chatHelpers';

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ names }) {
  if (!names?.length) return null;
  return (
    <div className="flex items-end gap-2 px-3 py-1">
      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-gray-500">{names[0][0]}</span>
      </div>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// ─── Reaction picker ──────────────────────────────────────────────────────────
function ReactionPicker({ onReact, onClose }) {
  return (
    <div
      className="absolute bottom-full mb-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-full px-2 py-1.5 flex gap-0.5 z-50"
      style={{ left: '50%', transform: 'translateX(-50%)' }}
    >
      {REACTIONS_LIST.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onReact(emoji); onClose(); }}
          className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-lg transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── Message action menu ──────────────────────────────────────────────────────
function MessageMenu({ isMe, canPin, isPinned, onReply, onCopy, onDelete, onPin, onClose }) {
  return (
    <div className="absolute bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-2xl overflow-hidden z-50 w-44 text-sm"
      style={{ [isMe ? 'right' : 'left']: 0 }}
    >
      <button onClick={() => { onReply(); onClose(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">
        <Reply className="w-3.5 h-3.5 text-gray-400" /> Reply
      </button>
      <button onClick={() => { onCopy(); onClose(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">
        <Copy className="w-3.5 h-3.5 text-gray-400" /> Copy
      </button>
      {/* ✅ NEW: Pin/unpin option */}
      {canPin && (
        <button onClick={() => { onPin(); onClose(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">
          {isPinned ? <PinOff className="w-3.5 h-3.5 text-gray-400" /> : <Pin className="w-3.5 h-3.5 text-gray-400" />}
          {isPinned ? 'Unpin' : 'Pin message'}
        </button>
      )}
      {isMe && (
        <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      )}
    </div>
  );
}

// ─── Voice message player ─────────────────────────────────────────────────────
function VoicePlayer({ audioUrl, duration, isMe }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    setProgress((a.currentTime / a.duration) * 100);
    setCurrentTime(a.currentTime);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 min-w-[180px] max-w-[240px] rounded-2xl ${isMe ? 'rounded-br-sm bg-blue-500' : 'rounded-bl-sm bg-gray-100 dark:bg-gray-800'}`}>
      <audio ref={audioRef} src={audioUrl} onTimeUpdate={onTimeUpdate} onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} transition-colors`}>
        {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5 h-6 mb-1">
          {Array.from({ length: 24 }, (_, i) => {
            const h = [3, 5, 8, 6, 9, 7, 4, 10, 8, 5, 7, 9, 6, 8, 5, 7, 9, 6, 4, 8, 7, 5, 9, 4][i];
            const filled = (i / 24) * 100 < progress;
            return (
              <div
                key={i}
                className={`rounded-full flex-1 transition-colors ${filled ? (isMe ? 'bg-white' : 'bg-blue-500') : (isMe ? 'bg-white/40' : 'bg-gray-300 dark:bg-gray-600')}`}
                style={{ height: `${h * 2}px` }}
              />
            );
          })}
        </div>
        <span className={`text-[10px] ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
          {playing ? formatTime(currentTime) : formatTime(duration || 0)}
        </span>
      </div>
    </div>
  );
}

// ─── Fullscreen image modal ───────────────────────────────────────────────────
function ImageModal({ src, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors">
        <X className="w-5 h-5" />
      </button>
      <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ─── Reply preview strip ──────────────────────────────────────────────────────
function ReplyPreviewStrip({ replyMsg, onCancel }) {
  if (!replyMsg) return null;
  const { text } = parseContent(replyMsg.content);
  return (
    <div className="flex items-start gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-900/40">
      <div className="w-0.5 h-full min-h-[28px] bg-blue-400 rounded-full shrink-0 self-stretch" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-blue-500 mb-0.5">{replyMsg.sender_name || 'Hiker'}</p>
        <p className="text-xs text-gray-500 truncate">{text || '📷 Media'}</p>
      </div>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── ✅ NEW: Pinned message banner ────────────────────────────────────────────
function PinnedMessageBanner({ message, onUnpin, canUnpin, onJumpTo }) {
  if (!message) return null;
  const { text } = parseContent(message.content);
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 cursor-pointer group"
      onClick={onJumpTo}
    >
      <Pin className="w-3 h-3 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-amber-600 font-semibold mb-0.5">Pinned message</p>
        <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{text || '📷 Media'}</p>
      </div>
      {canUnpin && (
        <button
          onClick={e => { e.stopPropagation(); onUnpin(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 shrink-0"
          title="Unpin"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── ✅ NEW: In-room search bar ───────────────────────────────────────────────
function InRoomSearch({ messages, onJumpTo, onClose }) {
  const [query, setQuery] = useState('');
  const [resultIdx, setResultIdx] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages
      .map((m, i) => ({ msg: m, i }))
      .filter(({ msg }) => {
        const { text } = parseContent(msg.content);
        return text?.toLowerCase().includes(q);
      });
  }, [query, messages]);

  useEffect(() => { setResultIdx(0); }, [query]);
  useEffect(() => {
    if (results.length > 0) onJumpTo(results[resultIdx].i);
  }, [results, resultIdx]);

  const prev = () => setResultIdx(i => (i > 0 ? i - 1 : results.length - 1));
  const next = () => setResultIdx(i => (i < results.length - 1 ? i + 1 : 0));

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <Search className="w-4 h-4 text-gray-400 shrink-0" />
      <input
        autoFocus
        type="text"
        placeholder="Search messages..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
      />
      {query && (
        <span className="text-[10px] text-gray-400 shrink-0">
          {results.length > 0 ? `${resultIdx + 1}/${results.length}` : '0 results'}
        </span>
      )}
      {results.length > 1 && (
        <>
          <button onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={next} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Voice recorder button ────────────────────────────────────────────────────
function VoiceRecorderButton({ onSendVoice, disabled }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  // ✅ FIX: store duration in ref so onstop callback always reads the latest value
  const durationRef = useRef(0);

  const streamRef = useRef(null);
  const [micError, setMicError] = useState('');
  useEffect(() => {
    if (!micError) return undefined;
    const t = setTimeout(() => setMicError(''), 4500);
    return () => clearTimeout(t);
  }, [micError]);

  // The mic must never stay on if the chat is closed while recording
  useEffect(() => () => {
    clearInterval(timer.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const start = async () => {
    setMicError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setMicError('Voice messages are not supported on this device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Android/Chrome record webm; iPhone Safari only records mp4/aac
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
        .find(t => MediaRecorder.isTypeSupported?.(t));
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunks.current = [];
      durationRef.current = 0;
      mr.ondataavailable = e => { if (e.data?.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        const seconds = durationRef.current;
        const blob = new Blob(chunks.current, { type: mr.mimeType || mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setDuration(0);
        durationRef.current = 0;
        if (seconds < 1 || blob.size === 0) { setMicError('Too short. Press and hold longer.'); return; }
        onSendVoice(blob, seconds);
      };
      mr.start();
      mediaRecorder.current = mr;
      setRecording(true);
      timer.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      setMicError(
        err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
          ? 'Microphone access was denied. Allow Microphone in Settings → Apps → Melotrip → Permissions.'
          : 'Could not start the microphone. Please try again.'
      );
    }
  };

  const stop = () => {
    if (mediaRecorder.current?.state !== 'inactive') mediaRecorder.current?.stop();
    clearInterval(timer.current);
    setRecording(false);
  };

  const cancel = () => {
    chunks.current = [];
    if (mediaRecorder.current?.state !== 'inactive') {
      mediaRecorder.current.onstop = null;
      mediaRecorder.current?.stop();
    }
    clearInterval(timer.current);
    setRecording(false);
    setDuration(0);
    durationRef.current = 0;
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={cancel} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5 text-red-500 text-xs font-mono font-semibold min-w-[40px]">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          {formatTime(duration)}
        </div>
        <button
          onClick={stop}
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-md"
        >
          <StopCircle className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      disabled={disabled}
      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors shrink-0"
      title="Send voice message"
    >
      <Mic className="w-5 h-5" />
      {micError && (
        <span role="alert" className="fixed left-4 right-4 bottom-20 z-50 rounded-xl bg-gray-900 text-white text-xs px-3 py-2 shadow-lg text-left font-normal">{micError}</span>
      )}
    </button>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────
function MessageBubble({ msg, isMe, isFirst, isLast, isGroup, isPinned, canPin, onReply, onDelete, onPin, allMessages, isHighlighted, msgRef, avatarUrl }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  // ✅ FIX: reactions initialized from msg._reactions and persisted on change
  const { user: me } = useAuth();
  const [reactions, setReactions] = useState(msg._reactions || {});
  const [showImage, setShowImage] = useState(false);

  const { text, mediaUrl, mediaType: mType, audioUrl, duration, replyTo } = parseContent(msg.content);

  const repliedMsg = replyTo ? allMessages.find(m => m.id === replyTo) : null;
  const repliedContent = repliedMsg ? parseContent(repliedMsg.content) : null;

  const showName = !isMe && isGroup && isFirst;

  // ✅ FIX: persist reaction to DB
  // FIX: reactions are now per-user (tap again to remove) and merged with the latest DB value
  // so two people reacting at the same time don't overwrite each other.
  // Legacy rows stored a plain number per emoji; those are converted to placeholder entries.
  const handleReact = async (emoji) => {
    const myId = me?.email;
    if (!myId) return;
    const previous = reactions;
    try {
      let latest = previous;
      const { data: fresh } = await supabase.from('chat_messages').select('_reactions').eq('id', msg.id).maybeSingle();
      if (fresh?._reactions && typeof fresh._reactions === 'object') latest = fresh._reactions;
      const current = latest[emoji];
      const reactors = Array.isArray(current)
        ? current
        : Array.from({ length: Number(current) || 0 }, (_, i) => `legacy-${i}`);
      const next = reactors.includes(myId) ? reactors.filter(e => e !== myId) : [...reactors, myId];
      const updated = { ...latest };
      if (next.length === 0) delete updated[emoji]; else updated[emoji] = next;
      setReactions(updated);
      await base44.entities.ChatMessage.update(msg.id, { _reactions: updated });
    } catch (err) {
      setReactions(previous);
      console.error('Reaction save failed:', err);
    }
  };

  const closeMenus = () => { setShowMenu(false); setShowReactions(false); };

  return (
    <div
      ref={msgRef}
      className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${!isLast ? 'mb-0.5' : 'mb-1'} ${isHighlighted ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-1 transition-colors duration-500' : ''}`}
      onClick={() => { if (showMenu || showReactions) closeMenus(); }}
    >
      {/* Avatar */}
      {!isMe && (
        <div className="w-7 shrink-0 self-end">
          {isLast && (
            <Avatar className="w-7 h-7">
              {avatarUrl && <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />}
              {!avatarUrl && (
                <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-sky-400 to-blue-500 text-white">
                  {getInitials(msg.sender_name || 'Hiker')}
                </AvatarFallback>
              )}
            </Avatar>
          )}
        </div>
      )}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`} style={{ minWidth: 0 }}>
        {showName && (
          <p className="text-[10px] text-gray-400 mb-1 ml-1 font-medium">
            {msg.sender_name || 'Hiker'}
          </p>
        )}

        {/* Pinned badge */}
        {isPinned && (
          <div className="flex items-center gap-1 text-[9px] text-amber-500 mb-0.5 ml-1">
            <Pin className="w-2.5 h-2.5" /> Pinned
          </div>
        )}

        {/* Reply context */}
        {repliedMsg && repliedContent && (
          <div className={`mb-1 px-2.5 py-1.5 rounded-xl text-xs border-l-2 border-blue-400 bg-gray-100 dark:bg-gray-800 max-w-full ${isMe ? 'mr-1' : 'ml-1'}`}>
            <p className="font-semibold text-blue-500 text-[10px] mb-0.5">{repliedMsg.sender_name || 'Hiker'}</p>
            <p className="text-gray-500 truncate">{repliedContent.text || '📷 Media'}</p>
          </div>
        )}

        {/* Bubble wrapper with actions */}
        <div className="relative group">
          {/* Action hover bar */}
          <div className={`absolute ${isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10`}>
            <button
              onClick={() => { setShowReactions(v => !v); setShowMenu(false); }}
              className="w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <Smile className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button
              onClick={() => { setShowMenu(v => !v); setShowReactions(false); }}
              className="w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {showReactions && (
            <ReactionPicker onReact={handleReact} onClose={() => setShowReactions(false)} />
          )}

          {showMenu && (
            <MessageMenu
              isMe={isMe}
              canPin={canPin}
              isPinned={isPinned}
              onReply={() => onReply(msg)}
              onCopy={() => navigator.clipboard.writeText(text || '')}
              onDelete={() => onDelete(msg.id)}
              onPin={() => onPin(msg)}
              onClose={closeMenus}
            />
          )}

          {/* Image */}
          {mediaUrl && mType === 'image' && (
            <div className="mb-0.5 cursor-pointer" onClick={() => setShowImage(true)}>
              <img
                src={mediaUrl}
                alt="photo"
                className={`max-w-[240px] w-full object-cover shadow-md hover:opacity-95 transition-opacity ${isMe ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'}`}
                style={{ maxHeight: 280 }}
              />
            </div>
          )}

          {/* Video */}
          {mediaUrl && mType === 'video' && (
            <video
              src={mediaUrl}
              controls
              playsInline
              className={`max-w-[240px] w-full shadow-md mb-0.5 ${isMe ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'}`}
              style={{ maxHeight: 280 }}
            />
          )}

          {/* Voice */}
          {audioUrl && <VoicePlayer audioUrl={audioUrl} duration={duration} isMe={isMe} />}

          {/* Text bubble */}
          {text && (
            <div
              className={`
                relative px-3.5 py-2.5 text-sm leading-relaxed shadow-sm
                transition-all duration-200
                ${isMe
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ' +
                    (isFirst && isLast ? 'rounded-2xl rounded-br-sm' :
                     isFirst ? 'rounded-2xl rounded-br-sm rounded-b-xl' :
                     isLast ? 'rounded-2xl rounded-br-sm' : 'rounded-xl')
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 ' +
                    (isFirst && isLast ? 'rounded-2xl rounded-bl-sm' :
                     isFirst ? 'rounded-2xl rounded-bl-sm rounded-b-xl' :
                     isLast ? 'rounded-2xl rounded-bl-sm' : 'rounded-xl')
                }
              `}
            >
              {text}
              <span className={`absolute ${isMe ? 'right-full pr-2' : 'left-full pl-2'} top-1/2 -translate-y-1/2 text-[9px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
                {msg.created_date ? format(new Date(msg.created_date), 'h:mm a') : ''}
              </span>
            </div>
          )}

          {/* Reaction counts */}
          {Object.keys(reactions).length > 0 && (
            <div className={`flex gap-0.5 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-1.5 py-0.5 shadow-sm text-xs">
                {Object.entries(reactions).map(([emoji, value]) => {
                  const count = Array.isArray(value) ? value.length : Number(value) || 0;
                  return count > 0 ? <span key={emoji}>{emoji}{count > 1 ? count : ''}</span> : null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Seen + time */}
        {isLast && (
          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
            <p className={`text-[9px] text-gray-400 ${isMe ? 'mr-0.5' : 'ml-0.5'}`}>
              {msg.created_date ? format(new Date(msg.created_date), 'h:mm a') : ''}
            </p>
            {isMe && (
              msg.is_read
                ? <CheckCheck className="w-3 h-3 text-blue-400" />
                : <Check className="w-3 h-3 text-gray-300" />
            )}
          </div>
        )}

        {showImage && mediaUrl && <ImageModal src={mediaUrl} onClose={() => setShowImage(false)} />}
      </div>
    </div>
  );
}

// ─── Members dialog ───────────────────────────────────────────────────────────
function MembersDialog({ open, onOpenChange, room, currentUserEmail, qc, roomId, profiles = {} }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setMemberError('');
    try {
      const { data: byName, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .ilike('full_name', `%${searchQuery.trim()}%`)
        .limit(20);
      if (error) throw error;
      const existing = room?.participants || [];
      setSearchResults((byName || []).filter(u => u.full_name && !existing.includes(u.email)));
    } catch { setMemberError('Search failed.'); }
    finally { setSearching(false); }
  };

  const handleAdd = async (u) => {
    setAddingMember(true); setMemberError('');
    try {
      await base44.entities.ChatRoom.update(roomId, {
        participants: [...(room.participants || []), u.email],
        participant_names: [...(room.participant_names || []), u.full_name || 'Hiker'],
      });
      setSearchResults(prev => prev.filter(r => r.email !== u.email));
      qc.invalidateQueries({ queryKey: ['chatroom', roomId] });
    } catch (err) { setMemberError(err.message || 'Could not add.'); }
    finally { setAddingMember(false); }
  };

  const handleRemove = async (email) => {
    if (email === currentUserEmail) return;
    setMemberError('');
    try {
      const idx = (room.participants || []).indexOf(email);
      await base44.entities.ChatRoom.update(roomId, {
        participants: (room.participants || []).filter(e => e !== email),
        participant_names: (room.participant_names || []).filter((_, i) => i !== idx),
      });
      qc.invalidateQueries({ queryKey: ['chatroom', roomId] });
    } catch (err) { setMemberError(err.message || 'Could not remove.'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <UsersRound className="w-3.5 h-3.5 text-violet-500" />
            </div>
            Group Members
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Members ({room?.participants?.length || 0})</p>
            <div className="space-y-1.5">
              {(room?.participants || []).map((email, idx) => {
                const name = room?.participant_names?.[idx] || 'Hiker';
                const isMe = email === currentUserEmail;
                const isAdmin = room?.created_by === email || idx === 0;
                return (
                  <div key={email} className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    <Avatar className="w-8 h-8 shrink-0">
                      {profiles[String(email).toLowerCase()]?.avatar_url
                        ? <img src={profiles[String(email).toLowerCase()].avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                        : (
                          <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-sky-400 to-blue-500 text-white">
                            {getInitials(name)}
                          </AvatarFallback>
                        )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{name}{isMe ? ' (you)' : ''}</p>
                    </div>
                    {isAdmin && <span className="text-[9px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full shrink-0 font-semibold">admin</span>}
                    {!isMe && !isAdmin && (
                      <button onClick={() => handleRemove(email)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add Member</p>
            <div className="flex gap-2">
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 text-sm rounded-xl"
              />
              <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="rounded-xl shrink-0">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-xl divide-y overflow-hidden">
                {searchResults.map(u => (
                  <div key={u.email} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-blue-100 text-blue-600">
                        {getInitials(u.full_name || 'Hiker')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{u.full_name}</p>
                    </div>
                    <button onClick={() => handleAdd(u)} disabled={addingMember} className="flex items-center gap-1 text-xs text-blue-500 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors shrink-0">
                      {addingMember ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            {memberError && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" /> {memberError}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ChatRoom ────────────────────────────────────────────────────────────
export default function ChatRoom() {
  const navigate = useNavigate();
  const { user, onlineUsers = [] } = useAuth();
  const { id: roomId } = useParams();
  const qc = useQueryClient();

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // ✅ NEW: in-room search state
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(null);
  // ✅ NEW: pinned message state (stored on room)
  const [pinnedMsgId, setPinnedMsgId] = useState(null);

  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);
  const messagesEndRef = useRef(null);
  const msgRefs = useRef({});
  // ✅ FIX: store the subscribed channel in a ref so typing uses the same instance
  const channelRef = useRef(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: room } = useQuery({
    queryKey: ['chatroom', roomId],
    queryFn: async () => {
      const list = await base44.entities.ChatRoom.filter({ id: roomId });
      return hydrateRoomParticipantNames(list[0]);
    },
    enabled: !!roomId,
    onSuccess: (data) => {
      if (data?.pinned_message_id) setPinnedMsgId(data.pinned_message_id);
    },
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', roomId],
    // FIX: previously sorted ascending + limit 200 = OLDEST 200 messages. Fetch newest 200, then show oldest->newest.
    queryFn: async () => {
      const rows = await base44.entities.ChatMessage.filter({ room_id: roomId }, '-created_date', 200);
      return [...rows].reverse();
    },
    enabled: !!roomId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Fallback when realtime is not enabled / drops: poll while the chat is open and visible
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 4000 : false),
  });

  // Add a message to the cache right away (no duplicate ids), so it shows without leaving the chat
  const pushMessage = useCallback((row) => {
    if (!row?.id) return;
    qc.setQueryData(['messages', roomId], (old = []) =>
      old.some(m => m.id === row.id) ? old : [...old, row]
    );
  }, [qc, roomId]);

  // ── Supabase realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !user?.email) return;

    // ✅ FIX: keep single channel instance in ref
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        pushMessage(payload?.new);
        qc.invalidateQueries({ queryKey: ['messages', roomId] });
        qc.invalidateQueries({ queryKey: ['chatrooms', user.email] });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typers = Object.values(state)
          .flat()
          .filter(p => p.typing && p.email !== user.email)
          .map(p => p.name || 'Hiker');
        setTypingUsers(typers);
      })
      .subscribe((status) => {
        // Catch anything sent between the first fetch and the subscription
        if (status === 'SUBSCRIBED') qc.invalidateQueries({ queryKey: ['messages', roomId] });
      });

    channelRef.current = channel;
    channel.track({ email: user.email, name: user.full_name, typing: false });

    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [roomId, user?.email, qc, pushMessage]);

  // ── Typing indicator broadcast ─────────────────────────────────────────────
  const handleTyping = (val) => {
    setMessage(val);
    // ✅ FIX: use channelRef.current — same subscribed channel, not a new one
    if (channelRef.current) {
      channelRef.current.track({ email: user.email, name: user.full_name, typing: true });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        channelRef.current?.track({ email: user.email, name: user.full_name, typing: false });
      }, 2000);
    }
  };

  // ── Mark read ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!messages.length || !user?.email) return;
    const unreadIds = messages.filter(m => !m.is_read && m.sender_email !== user.email).map(m => m.id);
    if (unreadIds.length === 0) return;
    supabase.from('chat_messages').update({ is_read: true }).in('id', unreadIds)
      .then(({ error }) => { if (error) console.warn('Mark-read failed:', error.message); });
  }, [messages, user?.email]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showSearch) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, showSearch]);

  // ── Scroll detection ───────────────────────────────────────────────────────
  const handleScroll = (e) => {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isGroup = room?.is_group || room?.type === 'group';
  const isOrganizer = room?.participants?.[0] === user?.email;

  const chatName = (() => {
    if (!room) return 'Chat';
    if (isGroup) return room.name || 'Group Chat';
    if (room.name && room.name !== '') return room.name;
    const otherIdx = room.participants?.indexOf(user.email) === 0 ? 1 : 0;
    return room.participant_names?.[otherIdx] || 'Hiker';
  })();

  const tripTitle = room?.trip_title || null;
  const memberCount = room?.participants?.length || 0;

  // photos + profile ids of everyone in this chat
  const { data: participantProfiles = {} } = useQuery({
    queryKey: ['chat-profiles', roomId, (room?.participants || []).join(',')],
    queryFn: () => fetchProfilesByEmails(room.participants),
    enabled: !!room?.participants?.length,
    staleTime: 5 * 60_000,
  });
  const otherEmail = !isGroup
    ? (room?.participants || []).find(e => String(e).toLowerCase() !== String(user?.email || '').toLowerCase())
    : null;
  const otherProfile = otherEmail ? participantProfiles[String(otherEmail).toLowerCase()] : null;
  const isOtherOnline = !!otherEmail && onlineUsers.some(u => String(u.email || '').toLowerCase() === String(otherEmail).toLowerCase());

  const isFirstInGroup = (i) => i === 0 || messages[i].sender_email !== messages[i - 1].sender_email;
  const isLastInGroup = (i) => i === messages.length - 1 || messages[i].sender_email !== messages[i + 1].sender_email;

  const pinnedMessage = pinnedMsgId ? messages.find(m => m.id === pinnedMsgId) : null;

  // ── ✅ NEW: Pin / unpin ────────────────────────────────────────────────────
  const handlePin = async (msg) => {
    const newPinnedId = pinnedMsgId === msg.id ? null : msg.id;
    setPinnedMsgId(newPinnedId);
    try {
      await base44.entities.ChatRoom.update(roomId, { pinned_message_id: newPinnedId });
    } catch (err) {
      console.error('Pin failed:', err);
    }
  };

  // ── ✅ NEW: Jump to message index ──────────────────────────────────────────
  const handleJumpTo = (idx) => {
    setHighlightedIdx(idx);
    const msgId = messages[idx]?.id;
    if (msgId && msgRefs.current[msgId]) {
      msgRefs.current[msgId].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedIdx(null), 2000);
  };

  // ── Media ──────────────────────────────────────────────────────────────────
  const handleMediaChange = async (e) => {
    const picked = e.target.files[0];
    e.target.value = '';
    if (!picked) return;
    let file = picked;
    try { file = await downscaleImage(await prepareImageFile(picked)); }   // HEIC -> JPEG, big photos shrunk
    catch (err) { alert(err.message); return; }
    const isVid = file.type.startsWith('video/');
    const isImg = file.type.startsWith('image/');
    if (!isVid && !isImg) return;
    if (file.size > 50 * 1024 * 1024) { alert('Max 50MB per file.'); return; }
    setMediaFile(file); setMediaType(isVid ? 'video' : 'image');
    if (isImg) {
      const reader = new FileReader();
      reader.onload = ev => setMediaPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const clearMedia = () => {
    if (mediaPreview && mediaType === 'video') URL.revokeObjectURL(mediaPreview);
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
  };

  const uploadMedia = async (file) => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const path = `chat-media/${roomId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from('files').getPublicUrl(path).data.publicUrl;
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!message.trim() && !mediaFile) return;
    setIsSending(true); setUploading(!!mediaFile);
    try {
      let mediaUrl = null; let mType = null;
      if (mediaFile) {
        mediaUrl = await uploadMedia(mediaFile);
        mType = mediaType; clearMedia();
      }
      const content = buildContent(message.trim(), mediaUrl, mType, replyTo?.id || null);
      const created = await base44.entities.ChatMessage.create({
        room_id: roomId, sender_email: user.email,
        sender_name: user.full_name, content, is_read: false,
      });
      // Show it immediately, before any other request can fail or lag
      pushMessage(created);
      setMessage(''); setReplyTo(null);
      try {
        await base44.entities.ChatRoom.update(roomId, {
          last_message: message.trim() || (mType === 'video' ? '📹 Video' : '📷 Photo'),
          last_message_time: new Date().toISOString(),
        });
      } catch (e) { console.warn('Room preview update failed:', e); }
      qc.invalidateQueries({ queryKey: ['messages', roomId] });
    } catch (err) { console.error('Send failed:', err); }
    finally { setIsSending(false); setUploading(false); }
  };

  // ── Send voice ─────────────────────────────────────────────────────────────
  const handleSendVoice = async (blob, duration) => {
    setIsSending(true);
    try {
      const type = blob.type || 'audio/webm';
      const ext = type.includes('mp4') ? 'm4a' : type.includes('aac') ? 'aac' : 'webm';
      const path = `chat-media/${roomId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('files').upload(path, blob, { contentType: type });
      if (uploadError) throw uploadError;
      const audioUrl = supabase.storage.from('files').getPublicUrl(path).data.publicUrl;
      const content = buildVoiceContent(audioUrl, duration);
      const created = await base44.entities.ChatMessage.create({
        room_id: roomId, sender_email: user.email,
        sender_name: user.full_name, content, is_read: false,
      });
      pushMessage(created);
      try {
        await base44.entities.ChatRoom.update(roomId, {
          last_message: '🎤 Voice', last_message_time: new Date().toISOString(),
        });
      } catch (e) { console.warn('Room preview update failed:', e); }
      qc.invalidateQueries({ queryKey: ['messages', roomId] });
    } catch (err) {
      console.error('Voice send failed:', err);
      alert('Could not send the voice message. Please try again.');
    }
    finally { setIsSending(false); }
  };

  // ── Delete message ─────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await base44.entities.ChatMessage.delete(id);
      if (id === pinnedMsgId) {
        setPinnedMsgId(null);
        await base44.entities.ChatRoom.update(roomId, { pinned_message_id: null });
      }
      qc.invalidateQueries({ queryKey: ['messages', roomId] });
    } catch (err) { console.error('Delete failed:', err); }
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const isVid = file.type.startsWith('video/');
    const isImg = file.type.startsWith('image/');
    if (!isVid && !isImg) return;
    setMediaFile(file); setMediaType(isVid ? 'video' : 'image');
    if (isImg) {
      const reader = new FileReader();
      reader.onload = ev => setMediaPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(URL.createObjectURL(file));
    }
  }, []);

  return (
    <div
      className="flex h-full min-h-0 flex-col max-w-lg mx-auto bg-white dark:bg-gray-900 relative overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 shadow-sm z-10">
        <button onClick={() => navigate('/chat')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 text-gray-600 dark:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => { if (otherProfile?.id) navigate(`/profile/${otherProfile.id}`); }}
          disabled={!otherProfile?.id}
          className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
          aria-label={otherProfile?.id ? `Open ${chatName}'s profile` : chatName}
        >
          <div className="relative shrink-0">
            <Avatar className="w-10 h-10 ring-2 ring-offset-1 ring-blue-200 dark:ring-blue-900">
              {!isGroup && otherProfile?.avatar_url && <img src={otherProfile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />}
              {(isGroup || !otherProfile?.avatar_url) && (
                <AvatarFallback className={`font-bold text-sm ${isGroup ? 'bg-gradient-to-br from-violet-400 to-indigo-500 text-white' : 'bg-gradient-to-br from-sky-400 to-blue-500 text-white'}`}>
                  {isGroup ? <UsersRound className="w-4 h-4" /> : chatName?.[0]?.toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            {!isGroup && isOtherOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{chatName}</h3>
            {tripTitle ? (
              <div className="flex items-center gap-1 text-[10px] text-blue-500">
                <Mountain className="w-2.5 h-2.5" />
                <span className="truncate">{tripTitle}</span>
              </div>
            ) : isGroup ? (
              <p className="text-[10px] text-gray-400">{memberCount} members</p>
            ) : (
              <p className={`text-[10px] font-semibold ${isOtherOnline ? 'text-green-500' : 'text-gray-400'}`}>{isOtherOnline ? 'Active now' : 'Offline'}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {/* voice / video call buttons removed: they were placeholders that did nothing */}
          {/* ✅ NEW: Search toggle button */}
          <button
            onClick={() => setShowSearch(s => !s)}
            className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${showSearch ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500'}`}
            title="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>
          {isGroup && (
            <button onClick={() => setMembersOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ✅ NEW: In-room search bar */}
      {showSearch && (
        <InRoomSearch
          messages={messages}
          onJumpTo={handleJumpTo}
          onClose={() => { setShowSearch(false); setHighlightedIdx(null); }}
        />
      )}

      {/* Trip banner */}
      {tripTitle && !showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 text-xs text-blue-600 shrink-0">
          <Mountain className="w-3.5 h-3.5 shrink-0" />
          <span>Inquiry about: <strong>{tripTitle}</strong></span>
        </div>
      )}

      {/* ✅ NEW: Pinned message banner */}
      {pinnedMessage && !showSearch && (
        <PinnedMessageBanner
          message={pinnedMessage}
          canUnpin={isOrganizer}
          onUnpin={() => handlePin(pinnedMessage)}
          onJumpTo={() => {
            const idx = messages.findIndex(m => m.id === pinnedMessage.id);
            if (idx >= 0) handleJumpTo(idx);
          }}
        />
      )}

      {/* ── Messages ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-0" onScroll={handleScroll}>
        {isLoading ? (
          <ChatSkeleton />
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_email === user.email;
            const first = isFirstInGroup(index);
            const last = isLastInGroup(index);
            const showSep = shouldShowSeparator(messages, index);
            const isPinned = msg.id === pinnedMsgId;

            return (
              <div key={msg.id}>
                {showSep && (
                  <div className="flex items-center justify-center my-5">
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full font-medium">
                      {dateSeparatorLabel(msg.created_date)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  isMe={isMe}
                  isFirst={first}
                  isLast={last}
                  isGroup={isGroup}
                  isPinned={isPinned}
                  canPin={isOrganizer || isMe}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                  onPin={handlePin}
                  allMessages={messages}
                  avatarUrl={participantProfiles[String(msg.sender_email || '').toLowerCase()]?.avatar_url}
                  isHighlighted={highlightedIdx === index}
                  msgRef={el => { if (el) msgRefs.current[msg.id] = el; }}
                />
              </div>
            );
          })
        )}

        <TypingIndicator names={typingUsers} />
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-28 right-4 w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all z-10"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* ── Reply strip ── */}
      <ReplyPreviewStrip replyMsg={replyTo} onCancel={() => setReplyTo(null)} />

      {/* ── Media preview ── */}
      {mediaPreview && (
        <div className="px-4 pt-2 pb-1 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <div className="relative inline-block">
            {mediaType === 'image' ? (
              <img src={mediaPreview} alt="preview" className="h-20 w-auto rounded-xl object-cover border shadow-sm" />
            ) : (
              <video src={mediaPreview} className="h-20 w-auto rounded-xl border shadow-sm" />
            )}
            <button onClick={clearMedia} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-black shadow">
              <X className="w-3 h-3" />
            </button>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaChange} />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={isSending}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-blue-500 shrink-0"
          title="Send photo or video"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <VoiceRecorderButton onSendVoice={handleSendVoice} disabled={isSending} />

        <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 min-h-[40px]">
          <textarea
            ref={inputRef}
            placeholder="Aa"
            value={message}
            rows={1}
            onChange={e => { handleTyping(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 resize-none overflow-hidden leading-relaxed"
            style={{ height: '20px' }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={(!message.trim() && !mediaFile) || isSending}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
            message.trim() || mediaFile
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg active:scale-95'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
          }`}
        >
          {isSending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>

      <MembersDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        room={room}
        currentUserEmail={user.email}
        qc={qc}
        roomId={roomId}
        profiles={participantProfiles}
      />
    </div>
  );
}