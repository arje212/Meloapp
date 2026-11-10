import { it, expect } from 'vitest';
import { orderFeedPage, hash01 } from '@/lib/feedOrder';

const now = Date.parse('2026-11-11T00:00:00Z');
const mk = (id, hoursAgo) => ({ id, created_date: new Date(now - hoursAgo * 3.6e6).toISOString() });
const posts = Array.from({ length: 15 }, (_, i) => mk(`p${i}`, i * 6));

it('keeps every post exactly once', () => {
  const out = orderFeedPage(posts, 0.42, now);
  expect(out).toHaveLength(15);
  expect(new Set(out.map(p => p.id)).size).toBe(15);
});
it('same seed = same order; new seed = different order', () => {
  const a = orderFeedPage(posts, 0.1, now).map(p => p.id).join();
  expect(orderFeedPage(posts, 0.1, now).map(p => p.id).join()).toBe(a);
  const others = [0.2, 0.3, 0.4, 0.5, 0.6].map(s => orderFeedPage(posts, s, now).map(p => p.id).join());
  expect(others.some(o => o !== a)).toBe(true);
});
it('existing posts keep their relative order when a new post arrives', () => {
  const before = orderFeedPage(posts, 0.7, now).map(p => p.id);
  const after = orderFeedPage([mk('new', 0.1), ...posts], 0.7, now).map(p => p.id).filter(id => id !== 'new');
  expect(after).toEqual(before);
});
it('newer posts tend to come first', () => {
  let newerFirst = 0;
  for (let s = 1; s <= 200; s += 1) {
    const ids = orderFeedPage([mk('old', 200), mk('new', 1)], s / 200, now).map(p => p.id);
    if (ids[0] === 'new') newerFirst += 1;
  }
  expect(newerFirst).toBeGreaterThan(110);
});
it('handles missing dates and empty input', () => {
  expect(orderFeedPage([], 1)).toEqual([]);
  expect(orderFeedPage([{ id: 'x' }], 1)).toHaveLength(1);
  expect(hash01('a')).toBeGreaterThanOrEqual(0);
});
