import { supabase } from '@/lib/supabase';

/**
 * Recompute counters from the source rows instead of "stale value + 1",
 * so concurrent likes/comments no longer overwrite each other.
 * Failures are ignored (the counter is cosmetic; the like/comment row is the truth).
 */
async function syncCount(table, postId, column) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (error || count == null) return null;
    await supabase.from('posts').update({ [column]: count }).eq('id', postId);
    return count;
  } catch {
    return null;
  }
}

export const syncLikesCount = (postId) => syncCount('post_likes', postId, 'likes_count');
export const syncCommentsCount = (postId) => syncCount('comments', postId, 'comments_count');
