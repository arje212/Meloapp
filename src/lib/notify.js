import { supabase } from '@/lib/supabase';

/**
 * Best-effort in-app notification. Never throws and never notifies yourself.
 * If the table lacks an optional column (e.g. `link`), it is dropped and the insert retried,
 * so a schema difference can no longer make every notification disappear.
 */
export async function notifyUser({ toEmail, fromEmail, title, message, type = 'system', link = '', icon = '' }) {
  if (!toEmail || toEmail === fromEmail) return;
  let row = { user_email: toEmail, title, message, type, link, icon, is_read: false };
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { error } = await supabase.from('notifications').insert(row);
      if (!error) return;
      const col = (`${error.message || ''} ${error.details || ''}`.match(/'([^']+)' column/i) || [])[1];
      if (!col || !(col in row)) { console.warn('Notification send failed:', error.message); return; }
      console.warn(`[notify] column "${col}" does not exist in notifications - sending without it.`);
      const { [col]: _dropped, ...rest } = row;
      row = rest;
    }
  } catch (err) {
    console.warn('Notification send failed:', err);
  }
}