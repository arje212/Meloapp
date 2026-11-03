import { describe, it, expect } from 'vitest';
import { PLAN_COMMISSION, getCommissionRate, pickActiveSubscription } from './plans';

describe('commission rates (must stay 10/7/5/3)', () => {
  it('keeps the existing rates', () => {
    expect(PLAN_COMMISSION).toMatchObject({ free: 10, starter: 7, pro: 5, yearly: 3 });
  });
  it('is case-insensitive and defaults to free', () => {
    expect(getCommissionRate('PRO')).toBe(5);
    expect(getCommissionRate(undefined)).toBe(10);
    expect(getCommissionRate('unknown-plan')).toBe(10);
  });
});

describe('pickActiveSubscription', () => {
  it('returns null when nothing is verified', () => {
    expect(pickActiveSubscription([])).toBeNull();
    expect(pickActiveSubscription([{ status: 'pending', plan: 'pro' }])).toBeNull();
    expect(pickActiveSubscription(undefined)).toBeNull();
  });
  it('ignores pending/rejected rows', () => {
    const subs = [
      { status: 'verified', plan: 'free', created_date: '2026-01-01' },
      { status: 'pending', plan: 'pro', created_date: '2026-02-01' },
    ];
    expect(pickActiveSubscription(subs).plan).toBe('free');
  });
  it('prefers the NEWEST verified row (free -> paid upgrade)', () => {
    const subs = [
      { status: 'verified', plan: 'free', created_date: '2026-01-01T00:00:00Z' },
      { status: 'verified', plan: 'pro', created_date: '2026-03-01T00:00:00Z' },
    ];
    expect(pickActiveSubscription(subs).plan).toBe('pro');
    expect(pickActiveSubscription([...subs].reverse()).plan).toBe('pro');
  });
});

import { addOneYear, daysUntil, isSubscriptionExpired, subscriptionEndDateFor } from './plans';

describe('1-year validity of paid plans', () => {
  it('adds exactly one calendar year (and handles Feb 29)', () => {
    expect(addOneYear('2026-10-26')).toBe('2027-10-26');
    expect(addOneYear('2028-02-29')).toBe('2029-02-28');
  });
  it('counts days until a date', () => {
    expect(daysUntil('2026-11-25', '2026-10-26')).toBe(30);
    expect(daysUntil('2026-10-25', '2026-10-26')).toBe(-1);
  });
  it('is valid THROUGH end_date, expired the day after; no end_date = not expired', () => {
    expect(isSubscriptionExpired({ end_date: '2026-10-26' }, '2026-10-26')).toBe(false);
    expect(isSubscriptionExpired({ end_date: '2026-10-25' }, '2026-10-26')).toBe(true);
    expect(isSubscriptionExpired({}, '2026-10-26')).toBe(false);
  });
  it('falls back to Free (null) once the only paid plan has expired', () => {
    const subs = [{ status: 'verified', plan: 'pro', end_date: '2026-10-01', created_date: '2025-10-01' }];
    expect(pickActiveSubscription(subs, '2026-10-26')).toBeNull();
  });
  it('an expired paid row does not hide a still-valid older Free row', () => {
    const subs = [
      { status: 'verified', plan: 'free', created_date: '2025-01-01' },
      { status: 'verified', plan: 'pro', end_date: '2026-10-01', created_date: '2025-10-01' },
    ];
    expect(pickActiveSubscription(subs, '2026-10-26').plan).toBe('free');
  });
  it('first approval = today + 1 year; early renewal extends from the current end date', () => {
    expect(subscriptionEndDateFor([], '2026-10-26')).toBe('2027-10-26');
    const active = [{ status: 'verified', plan: 'pro', end_date: '2026-11-10' }];
    expect(subscriptionEndDateFor(active, '2026-10-26')).toBe('2027-11-10');
    const expired = [{ status: 'verified', plan: 'pro', end_date: '2026-09-01' }];
    expect(subscriptionEndDateFor(expired, '2026-10-26')).toBe('2027-10-26');
  });
});

import { planRank } from './plans';
describe('visibility rank (Yearly > Pro > Starter > Free)', () => {
  it('orders plans for agency listing priority', () => {
    expect(planRank('yearly')).toBeGreaterThan(planRank('pro'));
    expect(planRank('pro')).toBeGreaterThan(planRank('starter'));
    expect(planRank('starter')).toBeGreaterThan(planRank('free'));
    expect(planRank(undefined)).toBe(0);
  });
});
