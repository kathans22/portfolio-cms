import { describe, it, expect } from 'vitest';
import { getExpiryStatus } from '../lib/certificationExpiry';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

describe('getExpiryStatus', () => {
  it('reports a never-expiring credential', () => {
    expect(getExpiryStatus({ neverExpires: true, expiryDate: null })).toEqual({
      state: 'NEVER',
      label: 'Never expires',
      daysRemaining: null,
    });
  });

  it('treats a missing expiry date as never expiring', () => {
    expect(getExpiryStatus({ neverExpires: false, expiryDate: null }).state).toBe('NEVER');
  });

  it('reports a comfortably valid credential as active', () => {
    const status = getExpiryStatus({ neverExpires: false, expiryDate: inDays(365) });
    expect(status.state).toBe('ACTIVE');
    expect(status.label).toBe('Active');
  });

  it('counts down inside the 90-day window', () => {
    const status = getExpiryStatus({ neverExpires: false, expiryDate: inDays(30) });
    expect(status.state).toBe('EXPIRING');
    expect(status.label).toMatch(/^Expires in 3[01] days$/);
  });

  it('singularises a one-day countdown', () => {
    const status = getExpiryStatus({ neverExpires: false, expiryDate: new Date(Date.now() + DAY / 2).toISOString() });
    expect(status.label).toBe('Expires in 1 day');
  });

  it('treats the 90-day boundary as expiring, not active', () => {
    expect(getExpiryStatus({ neverExpires: false, expiryDate: inDays(89.5) }).state).toBe('EXPIRING');
    expect(getExpiryStatus({ neverExpires: false, expiryDate: inDays(120) }).state).toBe('ACTIVE');
  });

  it('reports a lapsed credential as expired', () => {
    const status = getExpiryStatus({ neverExpires: false, expiryDate: inDays(-1) });
    expect(status.state).toBe('EXPIRED');
    expect(status.label).toBe('Expired');
  });

  it('lets neverExpires win over a stale expiry date', () => {
    expect(getExpiryStatus({ neverExpires: true, expiryDate: inDays(-500) }).state).toBe('NEVER');
  });
});
