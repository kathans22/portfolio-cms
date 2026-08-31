import { z } from 'zod';

// Mirrors the domain values used in the Mongoose model enums (e.g.
// apps/server/src/modules/projects/project.model.ts). Kept here rather than imported
// from a server module because the client app can't depend on server-only code.
// Update all places together.
export const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;

export const projectDomainSchema = z.enum(PROJECT_DOMAINS);

export type ProjectDomain = z.infer<typeof projectDomainSchema>;

export const PROJECT_DOMAIN_META: Record<ProjectDomain, { label: string; slug: string }> = {
  SOFTWARE_DEVELOPMENT: { label: 'Software Development', slug: 'software-development' },
  AI_ENGINEERING: { label: 'AI Engineering', slug: 'ai-engineering' },
  DATA_ENGINEERING: { label: 'Data Engineering', slug: 'data-engineering' },
};
