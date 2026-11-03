import { describe, it, expect } from 'vitest';
import { isCommissionConfirmed, commissionConfirmPatch } from './commission';

describe('commission_confirmed is the single source of truth', () => {
  it('is confirmed by the flag or the status', () => {
    expect(isCommissionConfirmed({ commission_confirmed: true })).toBe(true);
    expect(isCommissionConfirmed({ status: 'commission_confirmed' })).toBe(true);
  });
  it('still honours the legacy commission_collected flag', () => {
    expect(isCommissionConfirmed({ status: 'completed', commission_collected: true })).toBe(true);
  });
  it('is NOT confirmed while completed or only sent', () => {
    expect(isCommissionConfirmed({ status: 'completed' })).toBe(false);
    expect(isCommissionConfirmed({ status: 'commission_sent', commission_confirmed: false })).toBe(false);
    expect(isCommissionConfirmed(null)).toBe(false);
  });
  it('confirm patch sets status, flag and date together', () => {
    const p = commissionConfirmPatch();
    expect(p.status).toBe('commission_confirmed');
    expect(p.commission_confirmed).toBe(true);
    expect(typeof p.commission_confirmed_date).toBe('string');
  });
});
