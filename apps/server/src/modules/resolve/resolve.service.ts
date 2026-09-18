import * as crypto from 'crypto';
import { SECTION_TYPES, SectionType, isSectionType, sectionCollection } from '@portfolio/shared';
import { logger } from '../../utils/logger';
import { Project } from '../projects/project.model';
import { BlogPost } from '../blog/blogPost.model';
import { fetchSkillsWithCertifications } from '../skills/withCertifications';
import { Experience } from '../experience/experience.model';
import { Education } from '../education/education.model';
import { Testimonial, publicTestimonialFilter } from '../testimonials/testimonial.model';
import { Certification, publicCertificationFilter } from '../certifications/certification.model';
import { toPublicCertification } from '../certifications/publicView';
import { Page, PageDoc, SectionAttrs } from '../pages/page.model';
import { LIVE } from '../pages/page.service';

// sortBy is authored in the admin, not by an end user, but it still reaches a database
// sort — allowlist it rather than interpolating whatever arrives.
const SORTABLE_FIELDS = new Set([
  'order', 'navOrder', 'createdAt', 'updatedAt', 'name', 'title',
  'issueDate', 'startDate', 'publishedAt', 'level',
]);

/**
 * `/about/`, `/About` and `/about` must all mean the same page rather than 404-ing,
 * or the same content accumulates duplicate URLs and the redirect table stops meaning
 * anything. Traversal segments are rejected outright.
 */
export function normalizePath(raw: string): string | null {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  if (!trimmed) return '/';

  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  // Collapse duplicate slashes: /a//b -> /a/b
  const collapsed = withLeading.replace(/\/{2,}/g, '/');
  const stripped = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;

  // A `..` segment is never legitimate here and shouldn't be normalized away silently.
  if (stripped.split('/').includes('..')) return null;

  return stripped || '/';
}

function sortSpec(section: SectionAttrs, fallback: string): Record<string, 1 | -1> {
  const field = SORTABLE_FIELDS.has(section.query?.sortBy) ? section.query.sortBy : fallback;
  return { [field]: section.query?.sortDir === 'desc' ? -1 : 1 };
}

function limitOf(section: SectionAttrs): number {
  return section.query?.limit && section.query.limit > 0 ? section.query.limit : 0;
}

// Sections arrive as Mongoose subdocuments at runtime but are typed as plain attrs,
// so convert defensively rather than casting the type away.
function toPlainSection(section: SectionAttrs): Record<string, unknown> {
  const maybeDoc = section as SectionAttrs & { toObject?: () => Record<string, unknown> };
  return typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : { ...section };
}

/**
 * What each list section actually renders, per the components in
 * `apps/client/src/components/sections/CollectionSections.tsx`.
 *
 * Projected explicitly rather than returning whole documents: a whole-document response
 * publishes every field added to the model later, by default and silently. An allowlist
 * keeps a new field private until someone deliberately puts it here — and it keeps the
 * payload small, which is the part a visitor on a slow connection feels.
 */
const LIST_PROJECTIONS = {
  // domains and techStack are here because the `filtered` variant renders them as filter
  // controls and tag chips. They are rendered fields, not a relaxation of the allowlist.
  PROJECT_LIST: 'title slug summary coverImageUrl repoUrl liveUrl domains techStack',
  BLOG_LIST: 'title slug excerpt publishedAt',
  EXPERIENCE_TIMELINE: 'role company startDate endDate isCurrent description',
  EDUCATION_TIMELINE: 'degree institution startDate endDate description',
  TESTIMONIAL_LIST: 'name role company quote avatarUrl',
  CHILD_PAGE_LIST: 'path title navLabel metaDescription navOrder',
} as const;

/**
 * Expands one collection section into documents.
 *
 * `status: PUBLISHED` is enforced here, server-side, and is never derived from the
 * request — previewing an unpublished *page* must not reveal unpublished *content*,
 * or the preview stops representing what a visitor would see.
 */
async function resolveCollectionSection(section: SectionAttrs): Promise<unknown[]> {
  const q = section.query ?? ({} as SectionAttrs['query']);
  const limit = limitOf(section);

  switch (section.type as SectionType) {
    case 'PROJECT_LIST': {
      const filter: Record<string, unknown> = { status: 'PUBLISHED' };
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.tags?.length) filter.techStack = { $in: q.tags };
      if (q.featuredOnly) filter.featured = true;
      return Project.find(filter)
        .select(LIST_PROJECTIONS.PROJECT_LIST)
        .sort(sortSpec(section, 'order'))
        .limit(limit);
    }

    case 'BLOG_LIST': {
      const filter: Record<string, unknown> = { status: 'PUBLISHED' };
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.tags?.length) filter.tags = { $in: q.tags };
      return BlogPost.find(filter)
        .select(LIST_PROJECTIONS.BLOG_LIST)
        .sort(sortSpec(section, 'publishedAt'))
        .limit(limit);
    }

    case 'CERTIFICATION_LIST': {
      const filter: Record<string, unknown> = publicCertificationFilter(q.includeExpired ?? false);
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.skillIds?.length) filter.skillIds = { $in: q.skillIds };
      if (q.featuredOnly) filter.featured = true;
      const certs = await Certification.find(filter).sort(sortSpec(section, 'order')).limit(limit);
      // Never hand the public raw documents (Plan 1 §6). toPublicCertification is itself
      // an allowlist, so this is projected at the boundary rather than in the query.
      return certs.map(toPublicCertification);
    }

    case 'SKILL_LIST': {
      const filter: Record<string, unknown> = {};
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.skillIds?.length) filter._id = { $in: q.skillIds };
      // Runs the certifications aggregation so certified badges work inside a
      // CMS-driven section exactly as they do on /about.
      return fetchSkillsWithCertifications(filter, {
        limit: limit || undefined,
        sort: sortSpec(section, 'order'),
      });
    }

    case 'EXPERIENCE_TIMELINE': {
      const filter: Record<string, unknown> = {};
      if (q.domains?.length) filter.domains = { $in: q.domains };
      return Experience.find(filter)
        .select(LIST_PROJECTIONS.EXPERIENCE_TIMELINE)
        .sort(sortSpec(section, 'startDate'))
        .limit(limit);
    }

    case 'EDUCATION_TIMELINE':
      return Education.find()
        .select(LIST_PROJECTIONS.EDUCATION_TIMELINE)
        .sort(sortSpec(section, 'startDate'))
        .limit(limit);

    case 'TESTIMONIAL_LIST':
      // Same moderation gate as GET /testimonials — a CMS section must never be the
      // back door that publishes an unapproved visitor submission.
      return Testimonial.find(publicTestimonialFilter)
        .select(LIST_PROJECTIONS.TESTIMONIAL_LIST)
        .sort(sortSpec(section, 'order'))
        .limit(limit);

    default:
      return [];
  }
}

async function resolveChildPages(page: PageDoc, section: SectionAttrs): Promise<unknown[]> {
  return Page.find({ parentId: page._id, status: 'PUBLISHED', ...LIVE })
    .select(LIST_PROJECTIONS.CHILD_PAGE_LIST)
    .sort({ navOrder: 1 })
    .limit(limitOf(section));
}

/**
 * The Mongoose model names a page's content is derived from, so a write to any of them
 * can bust exactly the cached pages that read it.
 *
 * `Page` is always included: the payload carries the page itself plus its ancestor chain,
 * so any page write can change any cached page's breadcrumbs or sub-page list.
 */
export function collectionsUsedBy(page: PageDoc): Set<string> {
  const deps = new Set<string>(['Page']);
  for (const section of page.sections ?? []) {
    if (!isSectionType(section.type)) continue;
    const collection = sectionCollection(section.type as SectionType);
    if (collection) deps.add(collection);
  }
  return deps;
}

/**
 * Expands every visible section concurrently, so a page view costs one round trip
 * regardless of how many sections it has. Section components must never fetch their
 * own data — that produces a request waterfall that grows with page complexity.
 */
export async function resolveSections(page: PageDoc) {
  const visible = (page.sections ?? [])
    .filter((section) => section.isVisible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const resolved = await Promise.all(
    visible.map(async (section) => {
      if (!isSectionType(section.type)) {
        // Registry changed under stored data. Drop the section rather than render a
        // broken one, and say so in dev where it's actionable.
        if (process.env.NODE_ENV !== 'production') {
          logger.warn({ type: section.type, path: page.path }, 'Unknown section type on page — dropping');
        }
        return null;
      }

      const meta = SECTION_TYPES[section.type as SectionType];
      const base = toPlainSection(section);

      if (meta.kind === 'collection') {
        return { ...base, items: await resolveCollectionSection(section) };
      }
      if (section.type === 'CHILD_PAGE_LIST') {
        return { ...base, items: await resolveChildPages(page, section) };
      }
      return base;
    })
  );

  return resolved.filter((section): section is Record<string, unknown> => section !== null);
}

export interface Ancestor {
  id: string;
  path: string;
  title: string;
  navLabel?: string;
}

/** Walks parentId upward, returned root-first so it reads left-to-right as a trail. */
async function ancestorChain(page: PageDoc): Promise<Ancestor[]> {
  const chain: Ancestor[] = [];
  let cursor = page.parentId ? await Page.findOne({ _id: page.parentId, ...LIVE }) : null;
  let guard = 0;

  while (cursor) {
    chain.unshift({
      id: String(cursor._id),
      path: cursor.path,
      title: cursor.title,
      navLabel: cursor.navLabel,
    });
    // Depth is capped at 2, so anything longer means malformed data — stop rather than
    // loop forever on a cycle that slipped past the write-time guard.
    if (++guard > 5) break;
    cursor = cursor.parentId ? await Page.findOne({ _id: cursor.parentId, ...LIVE }) : null;
  }

  return chain;
}

export type ResolveOutcome =
  | { kind: 'PAGE'; data: Record<string, unknown> }
  | { kind: 'PROJECT'; data: unknown }
  | { kind: 'BLOG_POST'; data: unknown }
  | { kind: 'REDIRECT'; to: string; status: 301 }
  | { kind: 'NOT_FOUND' };

// Typed detail routes. Registered here rather than inferred, so adding a new detail
// collection is a deliberate one-line change and the resolver never guesses.
const DETAIL_PATTERNS: {
  prefix: string;
  kind: 'PROJECT' | 'BLOG_POST';
  /** Mongoose model name, for cache invalidation. */
  model: string;
  find: (slug: string, preview: boolean) => Promise<unknown | null>;
}[] = [
  {
    prefix: '/projects/',
    kind: 'PROJECT',
    model: 'Project',
    // Detail pages render nearly the whole document (contentBlocks, gallery, SEO meta),
    // so there is no meaningful projection to apply here — unlike the list sections.
    find: (slug, preview) => Project.findOne(preview ? { slug } : { slug, status: 'PUBLISHED' }),
  },
  {
    prefix: '/blog/',
    kind: 'BLOG_POST',
    model: 'BlogPost',
    find: (slug, preview) => BlogPost.findOne(preview ? { slug } : { slug, status: 'PUBLISHED' }),
  },
];

/**
 * The single server-side owner of what a URL means. Without it, /projects/<slug> is
 * ambiguous between a Project document and an admin-authored sub-page, and the router
 * cannot tell them apart because admin paths aren't known at build time.
 *
 * Precedence is exactly: Page path → Page previousPaths → typed detail → not found.
 *
 * `dependsOn` accompanies a PAGE outcome so the caller can cache it and bust it on a
 * write to any collection it read. It is deliberately not part of the outcome itself —
 * it is cache bookkeeping, not something a client should ever receive.
 */
export async function resolvePath(
  path: string,
  preview: boolean
): Promise<{ outcome: ResolveOutcome; dependsOn: Set<string> }> {
  // 1. Exact match on Page.path.
  const pageFilter: Record<string, unknown> = { path, ...LIVE };
  if (!preview) pageFilter.status = 'PUBLISHED';

  const page = await Page.findOne(pageFilter);
  if (page) {
    // Sections and ancestors are independent lookups, so overlap them.
    const [sections, ancestors] = await Promise.all([resolveSections(page), ancestorChain(page)]);
    // The chain ships with the payload so breadcrumbs don't have to be reconstructed
    // client-side from a path string, which would guess at titles.
    return {
      outcome: { kind: 'PAGE', data: { ...page.toJSON(), sections, ancestors } },
      dependsOn: collectionsUsedBy(page),
    };
  }

  // 2. Exact match on a previous path — the page moved, so say so permanently.
  const moved = await Page.findOne({ previousPaths: path, ...LIVE });
  if (moved) {
    return { outcome: { kind: 'REDIRECT', to: moved.path, status: 301 }, dependsOn: new Set(['Page']) };
  }

  // 3. Typed detail lookup.
  for (const pattern of DETAIL_PATTERNS) {
    if (!path.startsWith(pattern.prefix)) continue;
    const slug = path.slice(pattern.prefix.length);
    // Only a single trailing segment is a detail slug; anything deeper would have had
    // to match a Page above.
    if (!slug || slug.includes('/')) continue;

    const found = await pattern.find(slug, preview);
    if (found) return { outcome: { kind: pattern.kind, data: found }, dependsOn: new Set([pattern.model]) };
  }

  // 4. Nothing owns this URL.
  return { outcome: { kind: 'NOT_FOUND' }, dependsOn: new Set(['Page']) };
}

/** Strong ETag over the resolved payload, so a client revalidation costs a 304. */
export function strongETag(payload: unknown): string {
  return `"${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;
}
