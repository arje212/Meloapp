import { supabase } from '@/lib/supabase';

/**
 * Best-effort in-app notification. Never throws and never notifies yourself.
 * Uses the same columns as the existing trip notifications.
 */
export async function notifyUser({ toEmail, fromEmail, title, message, type = 'system', link = '', icon = '' }) {
  if (!toEmail || toEmail === fromEmail) return;
  try {
    await supabase.from('notifications').insert({
      user_email: toEmail,
      title,
      message,
      type,
      link,
      icon,
      is_read: false,
    });
  } catch (err) {
    console.warn('Notification send failed:', err);
  }
}
