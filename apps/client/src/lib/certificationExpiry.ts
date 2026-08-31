import type { Certification } from '@portfolio/types';

export type ExpiryState = 'NEVER' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export interface ExpiryStatus {
  state: ExpiryState;
  label: string;
  /** Whole days until expiry; null when the credential cannot expire. */
  daysRemaining: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Derived from expiryDate on read, matching the server's isExpired/expiresSoon
// virtuals. Nothing about expiry is ever stored, so it cannot go stale.
export function getExpiryStatus(cert: Pick<Certification, 'neverExpires' | 'expiryDate'>): ExpiryStatus {
  if (cert.neverExpires || !cert.expiryDate) {
    return { state: 'NEVER', label: 'Never expires', daysRemaining: null };
  }

  const daysRemaining = Math.ceil((new Date(cert.expiryDate).getTime() - Date.now()) / DAY_MS);

  if (daysRemaining <= 0) return { state: 'EXPIRED', label: 'Expired', daysRemaining };
  if (daysRemaining <= 90) {
    return {
      state: 'EXPIRING',
      label: `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      daysRemaining,
    };
  }
  return { state: 'ACTIVE', label: 'Active', daysRemaining };
}
