/**
 * Feed order for the first page: a different mix every time the app is opened or refreshed,
 * but newer posts are still favoured. Each post gets a stable random score from (seed + post id),
 * so posts do not jump around when new data arrives; only a new seed reshuffles.
 */
export function hash01(text) {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const RECENCY_WINDOW_HOURS = 72; // posts older than this get the full "older" penalty
const RECENCY_WEIGHT = 0.6;      // 0 = pure shuffle, higher = more chronological

export function orderFeedPage(posts, seed, now = Date.now()) {
  return (posts || [])
    .map((post) => {
      const ageHours = (now - new Date(post.created_date).getTime()) / 3.6e6 || 0;
      const penalty = Math.min(Math.max(ageHours, 0) / RECENCY_WINDOW_HOURS, 1) * RECENCY_WEIGHT;
      return { post, key: hash01(`${seed}:${post.id}`) + penalty };
    })
    .sort((a, b) => a.key - b.key)
    .map((x) => x.post);
}
