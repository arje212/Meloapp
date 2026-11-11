import { it, expect, vi, beforeEach } from 'vitest';
const created = [];
vi.mock('@/api/base44Client', () => ({ base44: { entities: {
  Achievement: { filter: async () => [], create: async (r) => { created.push(r); return r; } },
  Notification: { create: async () => ({}) },
} } }));
beforeEach(() => { created.length = 0; });

it('unlocks a one-off achievement defined by the caller (Trail Writer)', async () => {
  const { unlockAchievement } = await import('@/lib/achievements');
  const r = await unlockAchievement('a@x.com', 'A', 'trip_reviewer', { title: 'Trail Writer', description: 'Submitted a trip review', icon: 'x', xp_earned: 25 });
  expect(r?.title).toBe('Trail Writer');
  expect(created).toHaveLength(1);
});
it('ignores unknown keys with no definition', async () => {
  const { unlockAchievement } = await import('@/lib/achievements');
  expect(await unlockAchievement('a@x.com', 'A', 'does_not_exist')).toBeNull();
  expect(created).toHaveLength(0);
});
it('never creates the same badge twice at the same time', async () => {
  const { unlockAchievement } = await import('@/lib/achievements');
  await Promise.all([unlockAchievement('b@x.com', 'B', 'first_post'), unlockAchievement('b@x.com', 'B', 'first_post')]);
  expect(created.filter(c => c.achievement_key === 'first_post')).toHaveLength(1);
});
