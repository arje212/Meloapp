import { format, isToday, isYesterday } from 'date-fns';
import { supabase } from '@/lib/supabase';

export function dateSeparatorLabel(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

export function shouldShowSeparator(messages, index) {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_date);
  const curr = new Date(messages[index].created_date);
  return prev.toDateString() !== curr.toDateString();
}

/**
 * Parse content field — supports:
 *   - Plain text
 *   - JSON: { __type: 'media', mediaType, mediaUrl, text?, replyTo? }
 *   - JSON: { __type: 'voice', audioUrl, duration }
 */
export function parseContent(raw) {
  if (!raw) return { text: null, mediaUrl: null, mediaType: null, audioUrl: null, duration: null, replyTo: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.__type === 'media') {
      return {
        text: parsed.text || null,
        mediaUrl: parsed.mediaUrl || null,
        mediaType: parsed.mediaType || null,
        audioUrl: null,
        duration: null,
        replyTo: parsed.replyTo || null,
      };
    }
    if (parsed?.__type === 'voice') {
      return {
        text: null,
        mediaUrl: null,
        mediaType: null,
        audioUrl: parsed.audioUrl || null,
        duration: parsed.duration || 0,
        replyTo: parsed.replyTo || null,
      };
    }
    if (parsed?.__type === 'text') {
      return {
        text: parsed.text || null,
        mediaUrl: null,
        mediaType: null,
        audioUrl: null,
        duration: null,
        replyTo: parsed.replyTo || null,
      };
    }
  } catch (_) { /* plain text */ }
  return { text: raw, mediaUrl: null, mediaType: null, audioUrl: null, duration: null, replyTo: null };
}

export function buildContent(text, mediaUrl, mediaType, replyTo = null) {
  if (mediaUrl) {
    return JSON.stringify({ __type: 'media', mediaType, mediaUrl, text: text || null, replyTo });
  }
  if (replyTo) {
    return JSON.stringify({ __type: 'text', text: text || null, replyTo });
  }
  return text || null;
}

export function buildVoiceContent(audioUrl, duration) {
  return JSON.stringify({ __type: 'voice', audioUrl, duration });
}

export function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export const REACTIONS_LIST = ['❤️', '😂', '😮', '😢', '😡', '👍'];


/**
 * Load ONLY the rooms the user participates in (server-side filter), newest first,
 * instead of "latest 100 rooms of everyone, then filter in the browser".
 * Same `.contains('participants', [...])` pattern AppLayout already uses.
 * Optionally attaches `_unread` (count of unread messages from others) per room.
 */
export async function fetchMyChatRooms(email, { withUnread = false, limit = 300 } = {}) {
  if (!email) return [];
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .contains('participants', [email])
    .order('updated_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rooms = data || [];
  if (!withUnread || rooms.length === 0) return rooms;

  try {
    const { data: unreadRows } = await supabase
      .from('chat_messages')
      .select('room_id')
      .neq('sender_email', email)
      .eq('is_read', false)
      .in('room_id', rooms.map((r) => r.id));
    const counts = {};
    (unreadRows || []).forEach((m) => { counts[m.room_id] = (counts[m.room_id] || 0) + 1; });
    return rooms.map((r) => ({ ...r, _unread: counts[r.id] || 0 }));
  } catch {
    return rooms;
  }
}
