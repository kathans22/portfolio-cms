import { z } from 'zod';
import { contentBlocksSchema } from './contentBlocks';
import { projectDomainSchema } from './domains';
import { SECTION_TYPES, SECTION_TYPE_KEYS, SectionType } from './sectionTypes';

export * from './contentBlocks';
export * from './domains';
export * from './sectionTypes';

// Mongo ObjectId string (24-char hex) — replaces the old cuid id format.
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id format');

// 1. Auth Schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Please enter a valid email address').optional(),
  currentPassword: z.string().min(6, 'Current password is required to make changes'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// 2. Project Schema
export const projectImageSchema = z.object({
  url: z.string().url('Please enter a valid image URL'),
  caption: z.string().optional(),
  altText: z.string().optional(),
  order: z.number().int().default(0),
});

export const projectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters').regex(/^[a-z0-9-]+$/, 'Slug must be url-friendly lowercase letters, numbers, and dashes'),
  summary: z.string().min(10, 'Summary must be at least 10 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  contentBlocks: contentBlocksSchema.optional(),
  techStack: z.array(z.string()).default([]),
  domains: z.array(projectDomainSchema).default([]),
  role: z.string().optional().or(z.literal('')),
  liveUrl: z.string().url('Please enter a valid live application URL').optional().or(z.literal('')),
  repoUrl: z.string().url('Please enter a valid repository URL').optional().or(z.literal('')),
  coverImageUrl: z.string().url('Please enter a valid cover image URL').optional().or(z.literal('')),
  gallery: z.array(projectImageSchema).default([]),
  featured: z.boolean().default(false),
  order: z.number().int().default(0),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  metaTitle: z.string().optional().or(z.literal('')),
  metaDescription: z.string().optional().or(z.literal('')),
  ogImageUrl: z.string().url('Please enter a valid OG image URL').optional().or(z.literal('')),
});
export type ProjectInput = z.infer<typeof projectSchema>;

// 3. Skill Schema
export const skillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  category: z.string().min(1, 'Category is required'),
  domains: z.array(projectDomainSchema).default([]),
  level: z.number().int().min(1).max(5, 'Level must be between 1 and 5').default(3),
  // Suppresses the self-rated level on the public site. For a certified skill,
  // "Level 4 (self-rated)" next to a real credential puts a weak signal in visual
  // competition with a strong one — this lets the credential speak for itself.
  hideLevel: z.boolean().default(false),
  order: z.number().int().default(0),
});
export type SkillInput = z.infer<typeof skillSchema>;

// 4. Experience Schema
export const experienceSchema = z.object({
  company: z.string().min(2, 'Company name must be at least 2 characters'),
  role: z.string().min(2, 'Role/position must be at least 2 characters'),
  domains: z.array(projectDomainSchema).default([]),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date format' }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date format' }).optional().or(z.literal('')),
  isCurrent: z.boolean().default(false),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  order: z.number().int().default(0),
});
export type ExperienceInput = z.infer<typeof experienceSchema>;

// 5. Education Schema
export const educationSchema = z.object({
  institution: z.string().min(2, 'Institution name must be at least 2 characters'),
  degree: z.string().min(2, 'Degree description must be at least 2 characters'),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }).optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  order: z.number().int().default(0),
});
export type EducationInput = z.infer<typeof educationSchema>;

// 6. Blog Schema
export const blogSchema = z.object({
  slug: z.string().min(3, 'Slug must be at least 3 characters').regex(/^[a-z0-9-]+$/, 'Slug must be url-friendly lowercase letters, numbers, and dashes'),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters'),
  content: z.string().min(20, 'Content body must be at least 20 characters'),
  contentBlocks: contentBlocksSchema.optional(),
  coverImageUrl: z.string().url('Please enter a valid cover image URL').optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  domains: z.array(projectDomainSchema).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  publishedAt: z.string().optional().or(z.literal('')),
  metaTitle: z.string().optional().or(z.literal('')),
  metaDescription: z.string().optional().or(z.literal('')),
  ogImageUrl: z.string().url('Please enter a valid OG image URL').optional().or(z.literal('')),
});
export type BlogInput = z.infer<typeof blogSchema>;

// 7. Testimonial Schema
export const testimonialSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  role: z.string().min(2, 'Role is required'),
  company: z.string().optional().or(z.literal('')),
  quote: z.string().min(10, 'Quote must be at least 10 characters'),
  avatarUrl: z.string().url('Please enter a valid avatar URL').optional().or(z.literal('')),
  order: z.number().int().default(0),
});
export type TestimonialInput = z.infer<typeof testimonialSchema>;

// 8. Certification Schema
//
// `skillIds` holds real Skill document ids, never free-text skill names — "Node.js",
// "NodeJS" and "Node" are three different strings and would match zero Skill
// documents, silently breaking every skill-to-credential lookup.
export const certificationSchema = z
  .object({
    name: z.string().min(2, 'Certification name is required'),
    issuingOrganization: z.string().min(2, 'Issuing organization is required'),
    issuerLogoUrl: z.string().url('Please enter a valid logo URL').optional().or(z.literal('')),

    issueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid issue date' }),
    expiryDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid expiry date' })
      .optional()
      .or(z.literal('')),
    neverExpires: z.boolean().default(false),

    credentialId: z.string().optional().or(z.literal('')),
    credentialUrl: z.string().url('Please enter a valid verification URL').optional().or(z.literal('')),
    certificateImageUrl: z.string().url('Please enter a valid certificate image URL').optional().or(z.literal('')),

    description: z.string().optional().or(z.literal('')),

    skillIds: z.array(objectIdSchema).default([]),
    domains: z.array(projectDomainSchema).default([]),

    featured: z.boolean().default(false),
    // Expiry normally removes a credential from public view. This opts a specific
    // lapsed credential back in — still labelled expired, never silently presented
    // as current.
    showWhenExpired: z.boolean().default(false),
    order: z.number().int().default(0),
    status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  })
  .refine((data) => data.neverExpires || !data.expiryDate || Date.parse(data.expiryDate) > Date.parse(data.issueDate), {
    message: 'Expiry date must be after the issue date',
    path: ['expiryDate'],
  })
  // Over-claim guard: if a credential is mapped to skills, it must say what it
  // actually covers, so the mapping can be checked against the description rather
  // than taken on faith.
  .refine((data) => data.skillIds.length === 0 || (data.description ?? '').trim().length >= 20, {
    message: 'Describe what this credential covers (20+ chars) before mapping it to skills',
    path: ['description'],
  });
export type CertificationInput = z.infer<typeof certificationSchema>;

// 9. Page / Section Schemas (route-driven CMS)

export const styleOptionsSchema = z.object({
  background: z.enum(['none', 'subtle', 'accent', 'inverted']).default('none'),
  paddingY: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('lg'),
  maxWidth: z.enum(['narrow', 'default', 'wide', 'full']).default('default'),
  columns: z.number().int().min(1).max(4).default(3),
  alignment: z.enum(['left', 'center']).default('left'),
  dividerAbove: z.boolean().default(false),
});
export type StyleOptionsInput = z.infer<typeof styleOptionsSchema>;

export const sectionQuerySchema = z.object({
  domains: z.array(projectDomainSchema).default([]),
  tags: z.array(z.string()).default([]),
  skillIds: z.array(objectIdSchema).default([]),
  featuredOnly: z.boolean().default(false),
  limit: z.number().int().min(0).default(0), // 0 = unlimited
  sortBy: z.string().default('order'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  includeExpired: z.boolean().default(false), // certifications only
});

export const sectionSchema = z
  .object({
    type: z.enum(SECTION_TYPE_KEYS),
    heading: z.string().optional().or(z.literal('')),
    subheading: z.string().optional().or(z.literal('')),
    // Powers deep links like /about#experience.
    anchorId: z
      .string()
      .regex(/^[a-z0-9-]*$/, 'Anchor must be lowercase letters, numbers and dashes')
      .optional()
      .or(z.literal('')),
    isVisible: z.boolean().default(true),
    order: z.number().int().default(0),

    layoutVariant: z.string().default('default'),
    styleOptions: styleOptionsSchema.default({}),
    query: sectionQuerySchema.default({}),
    contentBlocks: contentBlocksSchema.optional(),

    cta: z
      .object({
        label: z.string().optional().or(z.literal('')),
        href: z.string().optional().or(z.literal('')),
        variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
      })
      .optional(),
  })
  // A variant that the registry doesn't define would silently fall back to a default
  // renderer, which looks like a styling bug rather than a validation failure.
  .refine((data) => (SECTION_TYPES[data.type as SectionType].variants as readonly string[]).includes(data.layoutVariant), {
    message: 'Unknown layout variant for this section type',
    path: ['layoutVariant'],
  });
export type SectionInput = z.infer<typeof sectionSchema>;

// Top-level slugs that would collide with infrastructure routes or static assets.
// A page here would be unreachable at best and would shadow the admin panel at worst.
export const RESERVED_TOP_LEVEL_SLUGS = [
  'admin', 'api', 'login', 'logout', 'assets', 'static', '_next',
  'sitemap.xml', 'robots.txt', 'favicon.ico',
] as const;

/** Prefixes owned by a typed detail route, e.g. /projects/:slug. */
export const DETAIL_NAMESPACES = ['projects', 'blog'] as const;

export function isReservedTopLevelSlug(slug: string): boolean {
  return (RESERVED_TOP_LEVEL_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

// A single path segment. The full `path` is derived server-side from the parent chain,
// never accepted from the client — see §4.3.
export const pageSlugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(60, 'Slug must be 60 characters or fewer')
  // The alternation forbids a leading or trailing hyphen without a second pass.
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and dashes');

export const pageSchema = z.object({
  slug: pageSlugSchema,
  parentId: objectIdSchema.nullable().optional(),

  title: z.string().min(2, 'Title is required'),
  navLabel: z.string().optional().or(z.literal('')),

  sections: z.array(sectionSchema).default([]),

  showInNav: z.boolean().default(true),
  navOrder: z.number().int().default(0),

  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),

  metaTitle: z.string().optional().or(z.literal('')),
  metaDescription: z.string().optional().or(z.literal('')),
  ogImageUrl: z.string().url('Please enter a valid OG image URL').optional().or(z.literal('')),
  noIndex: z.boolean().default(false),
});
export type PageInput = z.infer<typeof pageSchema>;

/**
 * PATCH is a *partial* update, so it must not reuse the create schema.
 *
 * pageSchema carries defaults (status DRAFT, showInNav true, noIndex false, navOrder 0),
 * which are right for a create and actively harmful for a patch: validating a partial
 * body against it fills the missing keys with those defaults, so a client that PATCHes
 * only `{ slug, title }` silently unpublishes a live page and resets its nav settings.
 * `.partial()` leaves an absent key as undefined, and the route falls back to the value
 * already stored.
 */
export const pagePatchSchema = pageSchema.partial();
export type PagePatchInput = z.infer<typeof pagePatchSchema>;

// PUT replaces the whole ordered array: reorder, insert and delete all become one
// atomic write, which sidesteps a class of partial-update bugs. Section arrays are
// small, so the payload cost is irrelevant.
export const pageSectionsSchema = z.object({
  sections: z.array(sectionSchema).default([]),
});
export type PageSectionsInput = z.infer<typeof pageSectionsSchema>;

// Deleting a page with children is never resolved silently — the admin picks.
export const pageDeleteStrategySchema = z.enum(['promote', 'subtree']);
export type PageDeleteStrategy = z.infer<typeof pageDeleteStrategySchema>;

// Bulk reorder/reparent from the admin's drag-and-drop tree.
export const pageTreeSchema = z.object({
  items: z
    .array(
      z.object({
        id: objectIdSchema,
        parentId: objectIdSchema.nullable().default(null),
        navOrder: z.number().int().default(0),
      })
    )
    .min(1, 'At least one page is required'),
});
export type PageTreeInput = z.infer<typeof pageTreeSchema>;

// Bulk reorder payload: position in the array is the new `order` value.
export const reorderSchema = z.object({
  ids: z.array(objectIdSchema).min(1, 'At least one id is required'),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

// 9. ContactMessage Schema
export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().optional().or(z.literal('')),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  // Honeypot: a field real users never see or fill. Bots that auto-fill forms often
  // populate it — if it's non-empty, the server silently drops the submission.
  website: z.string().optional().or(z.literal('')),
});
export type ContactInput = z.infer<typeof contactSchema>;

// 10. Resource Management (Main Type -> Sub Type -> Resource)
//
// ADMIN-ONLY. This taxonomy is a private bookmarking tool and is deliberately kept out
// of SECTION_TYPES, so no CMS section can ever place it on a public page. It is also a
// separate hierarchy from the portfolio's public taxonomy — despite the surface
// similarity, merging the two is how private data reaches a public view.

export const referenceStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type ReferenceStatus = z.infer<typeof referenceStatusSchema>;

const referenceNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer');

const referenceDescriptionSchema = z
  .string()
  .trim()
  .max(1000, 'Description must be 1000 characters or fewer')
  .optional()
  .or(z.literal(''));

/**
 * A resource link is rendered as an anchor `href`, so the scheme is a security boundary,
 * not a formatting preference. `z.string().url()` happily accepts `javascript:alert(1)`
 * and `data:text/html,...`, both of which execute when clicked — so the scheme is
 * checked against an allowlist rather than a blocklist, and the same check runs again at
 * render time for records written before this validation existed.
 */
export const HTTP_SCHEMES = ['http:', 'https:'] as const;

export function isHttpUrl(value: string): boolean {
  try {
    return (HTTP_SCHEMES as readonly string[]).includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

/**
 * Trailing slashes are stripped before storage so `.../jobs` and `.../jobs/` are the
 * same bookmark — without it the duplicate index treats them as two different resources
 * and the guard silently does nothing.
 */
export function normalizeLink(value: string): string {
  const trimmed = value.trim();
  // Only the path's trailing slash goes; "https://example.com" must not become
  // "https:/example.com".
  return trimmed.replace(/(?<!\/)\/+$/, '');
}

export const resourceLinkSchema = z
  .string()
  .trim()
  .min(1, 'Link is required')
  .max(2000, 'Link must be 2000 characters or fewer')
  .refine(isHttpUrl, 'Link must be an absolute http:// or https:// URL')
  .transform(normalizeLink);

export const mainTypeSchema = z.object({
  name: referenceNameSchema,
  description: referenceDescriptionSchema,
  status: referenceStatusSchema.default('ACTIVE'),
});
export type MainTypeInput = z.infer<typeof mainTypeSchema>;
export const mainTypePatchSchema = mainTypeSchema.partial();
export type MainTypePatchInput = z.infer<typeof mainTypePatchSchema>;

export const subTypeSchema = mainTypeSchema.extend({
  mainTypeId: objectIdSchema,
});
export type SubTypeInput = z.infer<typeof subTypeSchema>;
export const subTypePatchSchema = subTypeSchema.partial();
export type SubTypePatchInput = z.infer<typeof subTypePatchSchema>;

export const resourceSchema = z.object({
  // Denormalized on purpose (module Section 0.1): listing and filtering by main type is
  // the primary use case, and without it every list query needs a $lookup. The pair is
  // verified server-side on every write, so it can never drift.
  mainTypeId: objectIdSchema,
  subTypeId: objectIdSchema,
  link: resourceLinkSchema,
  description: referenceDescriptionSchema,
  status: referenceStatusSchema.default('ACTIVE'),
});
export type ResourceInput = z.infer<typeof resourceSchema>;
export const resourcePatchSchema = resourceSchema.partial();
export type ResourcePatchInput = z.infer<typeof resourcePatchSchema>;

export const resourceStatusSchema = z.object({ status: referenceStatusSchema });
export type ResourceStatusInput = z.infer<typeof resourceStatusSchema>;
