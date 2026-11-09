import { it, expect } from 'vitest';
import { formatDay, toLocalDate } from '@/lib/tripDates';
import { isHeic } from '@/lib/prepareImage';
it('dates never print Invalid Date', () => {
  expect(formatDay('2026-11-08')).toBe('Nov 8');
  expect(formatDay('2026-11-08T00:00:00.000Z')).toBe('Nov 8');
  expect(formatDay(new Date(2026, 10, 8))).toBe('Nov 8');
  expect(formatDay('garbage')).toBe('');
  expect(formatDay(null)).toBe('');
  expect(toLocalDate(undefined)).toBeNull();
  expect(formatDay('2026-12-25', 'en-PH', { year: 'numeric', month: 'long', day: 'numeric' })).toBe('December 25, 2026');
});
it('detects HEIC', () => {
  expect(isHeic({ type: 'image/heic', name: 'a.jpg' })).toBe(true);
  expect(isHeic({ type: '', name: 'IMG_1.HEIC' })).toBe(true);
  expect(isHeic({ type: 'image/jpeg', name: 'a.jpg' })).toBe(false);
});
