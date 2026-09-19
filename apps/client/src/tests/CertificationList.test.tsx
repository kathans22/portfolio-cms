import { describe, it, expect } from 'vitest';
import type { PublicCertification } from '@portfolio/types';
import { groupByIssuer } from '../components/public/CertificationList';

const cert = (id: string, name: string, org: string, logo?: string): PublicCertification => ({
  id,
  name,
  issuingOrganization: org,
  issuerLogoUrl: logo,
  issueDate: '2025-01-01',
  neverExpires: true,
  isExpired: false,
  skillIds: [],
  domains: [],
});

describe('groupByIssuer', () => {
  it('collapses repeat issuers into one group, keeping first-seen order', () => {
    const groups = groupByIssuer([
      cert('1', 'Data Science', 'IIT Bombay'),
      cert('2', 'React', 'Udemy'),
      cert('3', 'Node.js', 'Udemy'),
      cert('4', 'SQL', 'Udemy'),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['IIT Bombay', 'Udemy']);
    expect(groups[1].certifications.map((c) => c.name)).toEqual(['React', 'Node.js', 'SQL']);
  });

  it('matches issuers case- and whitespace-insensitively', () => {
    const groups = groupByIssuer([cert('1', 'A', 'Udemy'), cert('2', 'B', ' udemy ')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].certifications).toHaveLength(2);
  });

  it('uses the first logo any certification of that issuer has', () => {
    const groups = groupByIssuer([cert('1', 'A', 'Udemy'), cert('2', 'B', 'Udemy', 'https://x/logo.png')]);
    expect(groups[0].logoUrl).toBe('https://x/logo.png');
  });
});
