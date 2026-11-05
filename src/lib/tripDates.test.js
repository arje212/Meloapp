import { describe, expect, it } from 'vitest';
import { isTripExpired } from './tripDates';

describe('isTripExpired', () => {
  it('keeps a trip visible until two days after its end date', () => {
    const trip = { start_date: '2026-12-03', end_date: '2026-12-04' };

    expect(isTripExpired(trip, new Date(2026, 11, 5))).toBe(false);
    expect(isTripExpired(trip, new Date(2026, 11, 6))).toBe(true);
  });

  it('expires a single-day trip on the date two days after it starts', () => {
    const trip = { start_date: '2026-12-03' };

    expect(isTripExpired(trip, new Date(2026, 11, 4))).toBe(false);
    expect(isTripExpired(trip, new Date(2026, 11, 5))).toBe(true);
  });

  it('does not expire trips without a valid date', () => {
    expect(isTripExpired({})).toBe(false);
    expect(isTripExpired({ start_date: 'not-a-date' })).toBe(false);
  });
});
