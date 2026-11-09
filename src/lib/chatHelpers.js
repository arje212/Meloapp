import { base44 } from '@/api/base44Client';
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

export async function fetchProfileNamesForEmails(emails) {
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  if (!uniqueEmails.length) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name')
    .in('email', uniqueEmails);
  if (error) throw error;

  return Object.fromEntries(
    (data || []).filter(profile => profile.full_name).map(profile => [profile.email, profile.full_name])
  );
}

export async function hydrateRoomParticipantNames(room) {
  if (!room?.participants?.length) return room;
  const existingNames = room.participant_names || [];
  const missingNames = room.participants.filter((email, index) =>
    !existingNames[index] || existingNames[index].toLowerCase() === email.toLowerCase()
  );
  const profileNames = await fetchProfileNamesForEmails(missingNames);

  return {
    ...room,
    participant_names: room.participants.map((email, index) =>
      profileNames[email] ||
      (existingNames[index] && existingNames[index].toLowerCase() !== email.toLowerCase()
        ? existingNames[index]
        : 'Hiker')
    ),
  };
}

export const REACTIONS_LIST = ['❤️', '😂', '😮', '😢', '😡', '👍'];

const normalizeParticipants = (participants = []) =>
  [...new Set(participants.map(email => email?.toLowerCase()).filter(Boolean))].sort();

export function findExistingGroupChat(rooms, { name, participants, bookingId, tripId }) {
  const expectedParticipants = JSON.stringify(normalizeParticipants(participants));
  const expectedName = name?.trim().toLowerCase();

  return rooms.find(room =>
    room.type === 'group' &&
    ((bookingId && room.booking_id === bookingId) ||
      (tripId && room.trip_id === tripId) ||
      (room.name?.trim().toLowerCase() === expectedName &&
        JSON.stringify(normalizeParticipants(room.participants)) === expectedParticipants))
  );
}

function dedupeGroupChats(rooms) {
  const grouped = new Map();
  const result = [];

  for (const room of rooms) {
    if (room.type !== 'group') {
      result.push(room);
      continue;
    }

    const identity = room.trip_id
      ? `trip:${room.trip_id}`
      : room.booking_id
        ? `booking:${room.booking_id}`
        : `${room.name?.trim().toLowerCase()}:${JSON.stringify(normalizeParticipants(room.participants))}`;
    const existingIndex = grouped.get(identity);

    if (existingIndex === undefined) {
      grouped.set(identity, result.length);
      result.push(room);
      continue;
    }

    const previous = result[existingIndex];
    const hasUsefulMessage = value => value?.last_message && !/group chat created/i.test(value.last_message);
    const currentIsBetter = Number(hasUsefulMessage(room)) > Number(hasUsefulMessage(previous)) ||
      (hasUsefulMessage(room) === hasUsefulMessage(previous) &&
        new Date(room.updated_date || room.last_message_time || 0) >
          new Date(previous.updated_date || previous.last_message_time || 0));
    if (currentIsBetter) result[existingIndex] = room;
  }

  return result;
}


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
  if (!withUnread || rooms.length === 0) return dedupeGroupChats(rooms);

  try {
    const { data: unreadRows } = await supabase
      .from('chat_messages')
      .select('room_id')
      .neq('sender_email', email)
      .eq('is_read', false)
      .in('room_id', rooms.map((r) => r.id));
    const counts = {};
    (unreadRows || []).forEach((m) => { counts[m.room_id] = (counts[m.room_id] || 0) + 1; });
    return dedupeGroupChats(rooms.map((r) => ({ ...r, _unread: counts[r.id] || 0 })));
  } catch {
    return dedupeGroupChats(rooms);
  }
}


/**
 * Open the one-to-one chat with `other`, creating it if you have never chatted.
 * Looks only at YOUR rooms (the old profile button downloaded every direct room of everybody).
 */
export async function startDirectChat(currentUser, other) {
  const me = String(currentUser?.email || '').toLowerCase();
  const them = String(other?.email || '').toLowerCase();
  if (!me || !them || me === them) throw new Error('Cannot start a chat with this user.');

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .contains('participants', [currentUser.email])
    .eq('type', 'direct')
    .limit(300);
  if (error) throw error;

  const existing = (data || []).find((r) =>
    (r.participants || []).length === 2 &&
    (r.participants || []).some((e) => String(e).toLowerCase() === them));
  if (existing) return existing;

  return base44.entities.ChatRoom.create({
    type: 'direct',
    participants: [currentUser.email, other.email],
    participant_names: [currentUser.full_name || currentUser.email, other.full_name || 'Hiker'],
  });
}
