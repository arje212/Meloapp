import { supabase } from '@/lib/supabase';

/**
 * email -> { id, full_name, avatar_url }  (keys are lower-case).
 * Follow lists, chats and online users only know emails; this gives them names, photos and a profile link.
 */
export async function fetchProfilesByEmails(emails) {
  const list = [...new Set((emails || []).filter(Boolean).map((e) => String(e).trim()))];
  if (!list.length) return {};
  const variants = [...new Set(list.flatMap((e) => [e, e.toLowerCase()]))];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('email', variants);
  if (error) {
    console.warn('[profiles] lookup failed:', error.message);
    return {};
  }
  return Object.fromEntries((data || []).filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));
}

const likePattern = (q) => `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Search people by name. Deactivated accounts are left out. Works before and after the
 * `deactivated_at` column exists (falls back to the old column list).
 */
export async function searchProfiles(q, { limit = 15, excludeId, excludeEmail, withBio = false } = {}) {
  const base = `id, full_name, email, avatar_url${withBio ? ', bio' : ''}`;
  const run = async (columns) => {
    let query = supabase.from('profiles').select(columns).ilike('full_name', likePattern(q)).order('full_name', { ascending: true }).limit(limit + 10);
    if (excludeId) query = query.neq('id', excludeId);
    if (excludeEmail) query = query.neq('email', excludeEmail);
    return query;
  };
  let { data, error } = await run(`${base}, deactivated_at`);
  if (error && /deactivated_at|column/i.test(error.message || '')) ({ data, error } = await run(base));
  if (error) throw error;
  return (data || []).filter((p) => p.full_name && !p.deactivated_at).slice(0, limit);
}
