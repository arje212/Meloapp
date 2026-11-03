// Re-export of the shared client so the app only ever creates ONE Supabase instance
// (two createClient() calls caused duplicate GoTrue clients sharing the same session storage).
export { supabase } from '@/lib/supabase';
