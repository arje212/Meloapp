// Supabase Edge Function: send-booking-email
// Called by a database trigger when a booking is created or its status changes.
// Sends the customer an email with the booking summary and a "Track booking" link, using Resend (https://resend.com).
//
// Secrets (supabase secrets set ...):
//   EMAIL_WEBHOOK_SECRET  same value as private.email_config.webhook_secret
//   RESEND_API_KEY        API key from resend.com
//   EMAIL_FROM            e.g.  Melotrip <bookings@yourdomain.com>   (the domain must be verified in Resend)
//   SITE_URL              optional, default https://lakbaybundok.vercel.app

const WEBHOOK_SECRET = Deno.env.get('EMAIL_WEBHOOK_SECRET') ?? '';
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://lakbaybundok.vercel.app').replace(/\/$/, '');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const peso = (n: unknown) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const STATUS: Record<string, { subject: string; headline: string; note: string }> = {
  pending: {
    subject: 'Natanggap namin ang booking mo',
    headline: 'Natanggap na ang booking mo!',
    note: 'I-send ang downpayment at i-upload ang screenshot ng receipt sa app para ma-confirm ng agency ang booking mo.',
  },
  confirmed: {
    subject: 'Na-confirm ang booking mo',
    headline: 'Confirmed na ang booking mo 🎉',
    note: 'Handa ka na! Makikita mo ang group chat at detalye ng trip sa app.',
  },
  cancelled: {
    subject: 'Na-cancel ang booking',
    headline: 'Na-cancel ang booking',
    note: 'Kung may tanong ka, i-chat ang agency sa app.',
  },
  rejected: {
    subject: 'Hindi na-approve ang booking',
    headline: 'Hindi na-approve ang booking',
    note: 'Pwede kang pumili ng ibang petsa o i-chat ang agency para sa detalye.',
  },
  completed: {
    subject: 'Tapos na ang trip mo',
    headline: 'Salamat sa pagsama! 🏔️',
    note: 'Mag-iwan ng review sa app para makatulong sa ibang hikers.',
  },
};

export function buildEmail(rec: Record<string, unknown>) {
  const status = String(rec.status || 'pending').toLowerCase();
  const info = STATUS[status] ?? {
    subject: 'May update sa booking mo',
    headline: 'May update sa booking mo',
    note: `Bagong status: ${status}.`,
  };
  const trackUrl = `${SITE_URL}/profile?tab=bookings`;
  const rows: [string, string][] = [
    ['Package', esc(rec.package_title)],
    ['Agency', esc(rec.agency_name)],
    ['Petsa ng trip', esc(rec.travel_date || 'Flexible')],
    ['Pax', esc(rec.num_pax)],
    ['Total', peso(rec.total_price)],
    ...(Number(rec.balance_amount) > 0
      ? ([['Downpayment', peso(rec.downpayment_amount)], ['Balance sa meetup', peso(rec.balance_amount)]] as [string, string][])
      : []),
    ['Status', esc(status.toUpperCase())],
  ];
  const body = rows
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px">${v}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">
    <p style="margin:0 0 4px;color:#16833f;font-weight:700;font-size:13px;letter-spacing:.08em">MELOTRIP</p>
    <h1 style="margin:0 0 12px;font-size:22px;color:#111827">${esc(info.headline)}</h1>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5">Hi ${esc(rec.user_name || 'Hiker')}, ${esc(info.note)}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:20px">${body}</table>
    <a href="${esc(trackUrl)}" style="display:block;text-align:center;background:#16833f;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:999px;font-size:15px">Track booking</a>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;text-align:center">Booking ref: ${esc(String(rec.id ?? '').slice(0, 8))}</p>
  </div>
</div></body></html>`;
  const text = `${info.headline}\n\nPackage: ${rec.package_title}\nAgency: ${rec.agency_name}\nPetsa: ${rec.travel_date || 'Flexible'}\nPax: ${rec.num_pax}\nTotal: ${peso(rec.total_price)}\nStatus: ${status}\n\nTrack booking: ${trackUrl}`;
  return { subject: `${info.subject}: ${rec.package_title ?? 'Melotrip'}`, html, text };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', WEBHOOK_SECRET)) return json({ error: 'unauthorized' }, 401);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const rec = payload.record ?? {};
  const old = payload.old_record ?? null;

  if (payload.table !== 'bookings' || !rec.user_email) return json({ sent: 0, reason: 'nothing to send' });
  // On UPDATE only email when the status really changed
  if (payload.type === 'UPDATE' && String(old?.status ?? '') === String(rec.status ?? '')) {
    return json({ sent: 0, reason: 'status unchanged' });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) return json({ error: 'RESEND_API_KEY / EMAIL_FROM not set' }, 500);

  const { subject, html, text } = buildEmail(rec);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [rec.user_email], subject, html, text }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ sent: 0, error: 'email provider rejected the message' }, 502);
  }
  return json({ sent: 1 });
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handler);
}
