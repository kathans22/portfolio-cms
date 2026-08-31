import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  updateProfileSchema,
  projectSchema,
  skillSchema,
  experienceSchema,
  educationSchema,
  blogSchema,
  testimonialSchema,
  certificationSchema,
  reorderSchema,
  contactSchema,
  objectIdSchema,
} from './index';
import { contentBlockSchema } from './contentBlocks';
import { projectDomainSchema } from './domains';

describe('objectIdSchema', () => {
  it('accepts a valid 24-char hex id', () => {
    expect(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
  });

  it('rejects a non-hex id', () => {
    expect(objectIdSchema.safeParse('not-an-id').success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'admin@portfolio.com', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 6 characters', () => {
    const result = loginSchema.safeParse({ email: 'admin@portfolio.com', password: '123' });
    expect(result.success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('requires currentPassword even when nothing else changes', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it('accepts currentPassword alone', () => {
    const result = updateProfileSchema.safeParse({ currentPassword: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('rejects a newPassword shorter than 6 characters', () => {
    const result = updateProfileSchema.safeParse({ currentPassword: 'secret123', newPassword: '123' });
    expect(result.success).toBe(false);
  });
});

describe('projectSchema', () => {
  const validProject = {
    title: 'Aura CMS Platform',
    slug: 'aura-cms-platform',
    summary: 'A headless content management system.',
    description: 'A headless content management system with real-time editing.',
  };

  it('accepts a minimal valid project, applying defaults', () => {
    const result = projectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.techStack).toEqual([]);
      expect(result.data.domains).toEqual([]);
      expect(result.data.featured).toBe(false);
      expect(result.data.status).toBe('PUBLISHED');
    }
  });

  it('rejects a slug with uppercase or spaces', () => {
    const result = projectSchema.safeParse({ ...validProject, slug: 'Aura CMS Platform' });
    expect(result.success).toBe(false);
  });

  it('rejects a title shorter than 3 characters', () => {
    const result = projectSchema.safeParse({ ...validProject, title: 'AB' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid liveUrl but allows an empty string', () => {
    expect(projectSchema.safeParse({ ...validProject, liveUrl: 'not-a-url' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...validProject, liveUrl: '' }).success).toBe(true);
  });

  it('rejects an invalid domain value', () => {
    const result = projectSchema.safeParse({ ...validProject, domains: ['NOT_A_DOMAIN'] });
    expect(result.success).toBe(false);
  });
});

describe('skillSchema', () => {
  it('accepts a valid skill and defaults level to 3', () => {
    const result = skillSchema.safeParse({ name: 'TypeScript', category: 'Languages' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.level).toBe(3);
  });

  it('rejects a level outside 1-5', () => {
    expect(skillSchema.safeParse({ name: 'TypeScript', category: 'Languages', level: 6 }).success).toBe(false);
    expect(skillSchema.safeParse({ name: 'TypeScript', category: 'Languages', level: 0 }).success).toBe(false);
  });
});

describe('experienceSchema', () => {
  const base = {
    company: 'Acme Corp',
    role: 'Software Engineer',
    startDate: '2020-01-01',
    description: 'Built and maintained backend services.',
  };

  it('accepts a valid experience entry', () => {
    expect(experienceSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an invalid startDate', () => {
    expect(experienceSchema.safeParse({ ...base, startDate: 'not-a-date' }).success).toBe(false);
  });

  it('allows an empty endDate for current roles', () => {
    expect(experienceSchema.safeParse({ ...base, endDate: '', isCurrent: true }).success).toBe(true);
  });
});

describe('educationSchema', () => {
  it('accepts a valid education entry without a description', () => {
    const result = educationSchema.safeParse({
      institution: 'State University',
      degree: 'B.Sc. Computer Science',
      startDate: '2016-09-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an institution shorter than 2 characters', () => {
    const result = educationSchema.safeParse({ institution: 'X', degree: 'B.Sc.', startDate: '2016-09-01' });
    expect(result.success).toBe(false);
  });
});

describe('blogSchema', () => {
  const base = {
    slug: 'exploring-nextjs',
    title: 'Exploring Next.js Relations',
    excerpt: 'A deep dive into relational data fetching.',
    content: 'Full article content goes here and is long enough.',
  };

  it('accepts a valid post, defaulting status to DRAFT', () => {
    const result = blogSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('DRAFT');
  });

  it('rejects an excerpt shorter than 10 characters', () => {
    expect(blogSchema.safeParse({ ...base, excerpt: 'short' }).success).toBe(false);
  });
});

describe('testimonialSchema', () => {
  it('accepts a valid testimonial', () => {
    const result = testimonialSchema.safeParse({
      name: 'Jane Doe',
      role: 'Product Manager',
      quote: 'A pleasure to work with on every project.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a quote shorter than 10 characters', () => {
    const result = testimonialSchema.safeParse({ name: 'Jane Doe', role: 'PM', quote: 'Great!' });
    expect(result.success).toBe(false);
  });
});

describe('certificationSchema', () => {
  const validId = '507f1f77bcf86cd799439011';
  const base = {
    name: 'AWS Certified Solutions Architect',
    issuingOrganization: 'Amazon Web Services',
    issueDate: '2025-03-14',
  };

  it('accepts a minimal certification, applying defaults', () => {
    const result = certificationSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillIds).toEqual([]);
      expect(result.data.domains).toEqual([]);
      expect(result.data.neverExpires).toBe(false);
      expect(result.data.status).toBe('PUBLISHED');
    }
  });

  it('rejects a missing issuing organization', () => {
    expect(certificationSchema.safeParse({ ...base, issuingOrganization: '' }).success).toBe(false);
  });

  it('rejects an invalid issue date', () => {
    expect(certificationSchema.safeParse({ ...base, issueDate: 'not-a-date' }).success).toBe(false);
  });

  it('rejects an expiry date that precedes the issue date', () => {
    const result = certificationSchema.safeParse({ ...base, expiryDate: '2024-01-01' });
    expect(result.success).toBe(false);
  });

  it('allows an expiry date after the issue date', () => {
    expect(certificationSchema.safeParse({ ...base, expiryDate: '2028-03-14' }).success).toBe(true);
  });

  it('skips the expiry ordering check when the credential never expires', () => {
    expect(certificationSchema.safeParse({ ...base, neverExpires: true }).success).toBe(true);
  });

  it('rejects skill ids that are not valid ObjectIds — free-text names must not slip through', () => {
    const result = certificationSchema.safeParse({
      ...base,
      description: 'Covers designing distributed systems on AWS across compute and storage.',
      skillIds: ['Node.js'],
    });
    expect(result.success).toBe(false);
  });

  it('requires a substantive description before a credential may claim skills', () => {
    const withoutDescription = certificationSchema.safeParse({ ...base, skillIds: [validId] });
    expect(withoutDescription.success).toBe(false);

    const tooShort = certificationSchema.safeParse({ ...base, skillIds: [validId], description: 'Covers AWS' });
    expect(tooShort.success).toBe(false);
  });

  it('accepts a skill mapping once the credential describes what it covers', () => {
    const result = certificationSchema.safeParse({
      ...base,
      skillIds: [validId],
      description: 'Validates designing distributed, fault-tolerant systems on AWS.',
    });
    expect(result.success).toBe(true);
  });

  it('does not require a description when no skills are claimed', () => {
    expect(certificationSchema.safeParse({ ...base, skillIds: [] }).success).toBe(true);
  });

  it('defaults showWhenExpired to false, so expiry hides a credential unless opted in', () => {
    const result = certificationSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.showWhenExpired).toBe(false);
  });
});

describe('reorderSchema', () => {
  it('accepts a list of object ids', () => {
    const result = reorderSchema.safeParse({ ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] });
    expect(result.success).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(reorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it('rejects non-ObjectId entries', () => {
    expect(reorderSchema.safeParse({ ids: ['first'] }).success).toBe(false);
  });
});

describe('skillSchema', () => {
  it('defaults hideLevel to false', () => {
    const result = skillSchema.safeParse({ name: 'Docker', category: 'Tools' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hideLevel).toBe(false);
  });
});

describe('contactSchema', () => {
  const base = { name: 'Jane Doe', email: 'jane@example.com', message: 'I would like to discuss a project.' };

  it('accepts a valid contact submission', () => {
    expect(contactSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(contactSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('allows the honeypot field to be empty', () => {
    expect(contactSchema.safeParse({ ...base, website: '' }).success).toBe(true);
  });
});

describe('contentBlockSchema', () => {
  it('accepts a valid paragraph block', () => {
    expect(contentBlockSchema.safeParse({ type: 'paragraph', markdown: 'Hello world' }).success).toBe(true);
  });

  it('accepts a valid callout block with a known variant', () => {
    const result = contentBlockSchema.safeParse({ type: 'callout', variant: 'info', body: 'Heads up.' });
    expect(result.success).toBe(true);
  });

  it('rejects a callout block with an unknown variant', () => {
    const result = contentBlockSchema.safeParse({ type: 'callout', variant: 'danger', body: 'Heads up.' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown block type', () => {
    expect(contentBlockSchema.safeParse({ type: 'quote', text: 'Not a real block' }).success).toBe(false);
  });
});

describe('projectDomainSchema', () => {
  it('accepts each known domain', () => {
    expect(projectDomainSchema.safeParse('SOFTWARE_DEVELOPMENT').success).toBe(true);
    expect(projectDomainSchema.safeParse('AI_ENGINEERING').success).toBe(true);
    expect(projectDomainSchema.safeParse('DATA_ENGINEERING').success).toBe(true);
  });

  it('rejects an unknown domain', () => {
    expect(projectDomainSchema.safeParse('MARKETING').success).toBe(false);
  });
});
