import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';

/**
 * Native push notifications (Firebase Cloud Messaging on Android, APNs through Firebase on iOS).
 * Works while the app is closed: the server (Supabase Edge Function `send-push`) sends the message,
 * the phone shows it, and tapping it opens the right screen (e.g. /chat/<roomId>).
 */

export const CHAT_CHANNEL_ID = 'messages';
const TOKEN_KEY = 'melotrip.push.token';

export const isPushSupported = () => Capacitor.isNativePlatform();

let listenersAttached = false;
let handlers = { onOpen: () => {}, onForeground: () => {} };
let currentUser = null;

const readStoredToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const storeToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

async function saveToken(token) {
  if (!token || !currentUser?.id) return;
  storeToken(token);
  // Server-side function so a phone can safely change owner when another account logs in on it
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: Capacitor.getPlatform(),
  });
  if (error) console.warn('[push] Could not save device token:', error.message);
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  PushNotifications.addListener('registration', ({ value }) => { saveToken(value); });
  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] Registration failed:', err?.error || err);
  });
  // App is open: the system does not show a banner, so the app shows its own toast
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    handlers.onForeground?.(notification);
  });
  // User tapped a notification (also works when the app was fully closed)
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action?.notification?.data || {};
    handlers.onOpen?.(data.url || data.link || '/');
  });
}

/**
 * Ask permission (Android 13+ / iOS), create the high-priority channel and register with FCM.
 * Safe to call on every login; it only prompts when the user has not decided yet.
 */
export async function initPush({ user, onOpen, onForeground }) {
  if (!isPushSupported() || !user?.id) return { status: 'unsupported' };
  currentUser = user;
  handlers = { onOpen, onForeground };

  try {
    attachListeners();

    if (Capacitor.getPlatform() === 'android') {
      // Importance 5 = heads-up banner + sound, like WhatsApp/Messenger
      await PushNotifications.createChannel({
        id: CHAT_CHANNEL_ID,
        name: 'Messages & updates',
        description: 'Chat messages, bookings, trip updates and other alerts',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      });
    }

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return { status: 'denied' };

    await PushNotifications.register();
    return { status: 'registered' };
  } catch (err) {
    console.warn('[push] init failed:', err);
    return { status: 'error', error: err };
  }
}

/** Call BEFORE signing out so the next person on this phone does not receive your notifications. */
export async function removePushToken() {
  if (!isPushSupported()) return;
  const token = readStoredToken();
  try {
    if (token) await supabase.from('device_tokens').delete().eq('token', token);
    storeToken(null);
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (err) {
    console.warn('[push] Could not remove device token:', err);
  }
}

/** Clear tray notifications once the user has seen them in the app. */
export async function clearDeliveredNotifications() {
  if (!isPushSupported()) return;
  try { await PushNotifications.removeAllDeliveredNotifications(); } catch { /* ignore */ }
}
