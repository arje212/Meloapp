// Supabase Edge Function: send-push
// Called by database triggers (chat_messages / notifications INSERT). Sends a Firebase Cloud Messaging
// push to every phone of the recipient, so the message shows up even when the app is closed.
//
// Secrets needed (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET        same value you put in private.push_config.webhook_secret
//   FIREBASE_SERVICE_ACCOUNT   the whole service-account JSON from Firebase (single line)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
const CHANNEL_ID = 'messages';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ── helpers ──────────────────────────────────────────────────────────────────
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const truncate = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Chat content is plain text or JSON ({__type:'media'|'voice'|'text'}). Turn it into a short preview. */
export function previewMessage(raw: string | null): string {
  if (!raw) return 'Nagpadala ng message';
  try {
    const p = JSON.parse(raw);
    if (p?.__type === 'voice') return '🎤 Voice message';
    if (p?.__type === 'media') {
      if (p.text) return truncate(String(p.text));
      return p.mediaType === 'video' ? '📹 Nagpadala ng video' : '📷 Nagpadala ng photo';
    }
    if (p?.__type === 'text') return truncate(String(p.text ?? 'Nagpadala ng message'));
  } catch { /* plain text */ }
  return truncate(String(raw));
}

const base64url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedToken: { value: string; exp: number } | null = null;

/** OAuth2 access token for the FCM HTTP v1 API, signed with the Firebase service account. */
export async function getAccessToken(sa: { client_email: string; private_key: string; token_uri?: string }) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${base64url(sig)}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Google OAuth failed: ${JSON.stringify(data)}`);
  cachedToken = { value: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cachedToken.value;
}

type Push = { emails: string[]; title: string; body: string; url: string; type: string; tag?: string };

/** Work out who gets what for a database event. */
// deno-lint-ignore no-explicit-any
export async function buildPush(db: any, table: string, rec: any): Promise<Push | null> {
  if (table === 'chat_messages') {
    const { data: room } = await db.from('chat_rooms').select('*').eq('id', rec.room_id).maybeSingle();
    if (!room) return null;
    const sender = String(rec.sender_email || '').toLowerCase();
    const emails = (room.participants || []).map((e: string) => String(e).toLowerCase()).filter((e: string) => e && e !== sender);
    if (!emails.length) return null;
    const isGroup = room.is_group === true || (room.participants || []).length > 2;
    const preview = previewMessage(rec.content);
    return {
      emails,
      title: isGroup ? (room.name || 'Group chat') : (rec.sender_name || 'Bagong message'),
      body: isGroup ? `${rec.sender_name || 'Someone'}: ${preview}` : preview,
      url: `/chat/${rec.room_id}`,
      type: 'chat',
      tag: `chat-${rec.room_id}`,
    };
  }
  if (table === 'notifications') {
    const email = String(rec.user_email || '').toLowerCase();
    if (!email) return null;
    const fallback: Record<string, string> = {
      achievement: '/achievements', roadmap: '/roadmap', agency: '/agency-dashboard', booking: '/trips', comment: '/', system: '/notifications',
    };
    const raw = typeof rec.link === 'string' ? rec.link.trim() : '';
    const link = raw.startsWith('/') && !raw.startsWith('//') ? raw : (fallback[rec.type] || '/notifications');
    return {
      emails: [email],
      title: rec.title || 'Melotrip',
      body: truncate(String(rec.message || '')),
      url: link,
      type: rec.type || 'system',
      tag: rec.id ? `notif-${rec.id}` : undefined,
    };
  }
  return null;
}

export function fcmMessage(token: string, p: Push) {
  return {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      data: { url: p.url, type: p.type },
      android: {
        priority: 'HIGH',
        notification: {
          channel_id: CHANNEL_ID,
          icon: 'ic_stat_melotrip',
          color: '#16833F',
          sound: 'default',
          ...(p.tag ? { tag: p.tag } : {}),
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default', ...(p.tag ? { 'thread-id': p.tag } : {}) } },
      },
    },
  };
}

// ── handler ──────────────────────────────────────────────────────────────────
export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', WEBHOOK_SECRET)) return json({ error: 'unauthorized' }, 401);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!saRaw) return json({ error: 'FIREBASE_SERVICE_ACCOUNT is not set' }, 500);
  const sa = JSON.parse(saRaw);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Manual test: { "table": "test", "record": { "email": "you@mail.com", "title": "Test", "message": "Hello" } }
  const push: Push | null = payload.table === 'test'
    ? {
        emails: [String(payload.record?.email || '').toLowerCase()],
        title: payload.record?.title || 'Melotrip test',
        body: payload.record?.message || 'Gumagana ang push notifications!',
        url: '/notifications',
        type: 'test',
      }
    : await buildPush(db, payload.table, payload.record);

  if (!push) return json({ sent: 0, reason: 'nothing to send' });

  const { data: rows, error } = await db.from('device_tokens').select('token').in('email', push.emails);
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ sent: 0, reason: 'no registered devices' });

  const accessToken = await getAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const results = await Promise.allSettled(rows.map(async ({ token }: { token: string }) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fcmMessage(token, push)),
    });
    if (res.ok) return 'sent';
    const err = await res.json().catch(() => ({}));
    const code = err?.error?.details?.[0]?.errorCode || err?.error?.status;
    // Phone uninstalled the app or the token expired: stop sending to it
    if (res.status === 404 || code === 'UNREGISTERED') {
      await db.from('device_tokens').delete().eq('token', token);
      return 'removed';
    }
    console.error('FCM error', res.status, JSON.stringify(err));
    return 'failed';
  }));

  const outcome = results.map((r) => (r.status === 'fulfilled' ? r.value : 'failed'));
  return json({
    sent: outcome.filter((o) => o === 'sent').length,
    removed: outcome.filter((o) => o === 'removed').length,
    failed: outcome.filter((o) => o === 'failed').length,
  });
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handler);
}
