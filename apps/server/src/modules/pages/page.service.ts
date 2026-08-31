import mongoose, { Types } from 'mongoose';
import { DETAIL_NAMESPACES, isReservedTopLevelSlug, RESERVED_TOP_LEVEL_SLUGS } from '@portfolio/shared';
import { logger } from '../../utils/logger';
import { Project } from '../projects/project.model';
import { BlogPost } from '../blog/blogPost.model';
import { Page, PageDoc, MAX_PAGE_DEPTH, MAX_PREVIOUS_PATHS } from './page.model';

// Prefixes owned by a typed detail route. A page whose path lands inside one of these
// has to be checked against that collection's slugs.
const DETAIL_PREFIXES: { prefix: string; label: string; exists: (slug: string) => Promise<boolean> }[] = [
  { prefix: '/projects', label: 'project', exists: async (slug) => !!(await Project.exists({ slug })) },
  { prefix: '/blog', label: 'blog post', exists: async (slug) => !!(await BlogPost.exists({ slug })) },
];

/** Every read path must ignore soft-deleted pages. */
export const LIVE = { deletedAt: null } as const;

export class PageValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'PageValidationError';
  }
}

export interface PathContext {
  path: string;
  depth: number;
}

/**
 * The full path is derived from the parent chain, never accepted from the client —
 * otherwise `path` and `parentId` can disagree and resolution silently breaks.
 */
export async function computePath(slug: string, parentId: string | null): Promise<PathContext> {
  if (!parentId) return { path: `/${slug}`, depth: 0 };

  const parent = await Page.findOne({ _id: parentId, ...LIVE });
  if (!parent) throw new PageValidationError('Parent page not found');

  const depth = parent.depth + 1;
  if (depth > MAX_PAGE_DEPTH) {
    throw new PageValidationError(`Pages cannot nest deeper than ${MAX_PAGE_DEPTH + 1} levels`);
  }

  return { path: `${parent.path}/${slug}`, depth };
}

export interface SlugCheck {
  available: boolean;
  path: string;
  reason?: string;
  /** Non-blocking advice, e.g. a published child under a draft parent. */
  warning?: string;
}

/**
 * Collisions are prevented at write time rather than resolved by luck at read time.
 * The resolver gives pages precedence over detail lookups, so a page created at
 * /projects/<existing-project-slug> would permanently shadow that project.
 */
export async function checkSlugAvailability(
  slug: string,
  parentId: string | null,
  excludePageId?: string
): Promise<SlugCheck> {
  const normalized = slug.trim().toLowerCase();

  if (!parentId) {
    if (isReservedTopLevelSlug(normalized)) {
      return {
        available: false,
        path: `/${normalized}`,
        reason: `"${normalized}" is reserved (${RESERVED_TOP_LEVEL_SLUGS.join(', ')})`,
      };
    }
    // The namespace *root* is deliberately allowed. `/projects` is the index page for
    // the collection and is exactly the sort of thing the CMS should own: the resolver
    // matches it exactly, while `/projects/<slug>` still falls through to the detail
    // pattern because no Page claims that path. What must stay blocked is a page at
    // `/projects/<slug>` that would hide a real project — and that is the separate,
    // more precise shadow check below, which this rule was over-approximating.
    void DETAIL_NAMESPACES;
  }

  let context: PathContext;
  try {
    context = await computePath(normalized, parentId);
  } catch (error) {
    return { available: false, path: '', reason: (error as Error).message };
  }

  const clash = await Page.findOne({ path: context.path, ...LIVE });
  if (clash && String(clash._id) !== excludePageId) {
    return { available: false, path: context.path, reason: 'Another page already uses this path' };
  }

  // Would this page shadow a project or blog post?
  for (const { prefix, label, exists } of DETAIL_PREFIXES) {
    if (context.path.startsWith(`${prefix}/`)) {
      const tail = context.path.slice(prefix.length + 1);
      if (!tail.includes('/') && (await exists(tail))) {
        return {
          available: false,
          path: context.path,
          reason: `A ${label} already uses the slug "${tail}" — this page would hide it`,
        };
      }
    }
  }

  // A previous path still redirecting means the URL is spoken for.
  const redirecting = await Page.findOne({ previousPaths: context.path, ...LIVE });
  if (redirecting && String(redirecting._id) !== excludePageId) {
    return { available: false, path: context.path, reason: 'A redirect from a renamed page still uses this path' };
  }

  return { available: true, path: context.path };
}

/**
 * The mirror of checkSlugAvailability, for the other side of the collision. Called when
 * a Project or BlogPost is written, so neither side can create an ambiguity the
 * resolver would then have to arbitrate.
 */
export async function findPageShadowingSlug(namespace: string, slug: string): Promise<string | null> {
  const page = await Page.findOne({ path: `/${namespace}/${slug}`, ...LIVE });
  return page ? page.path : null;
}

/** Walks up from `candidateParentId`; a page may not be moved under its own descendant. */
export async function wouldCreateCycle(pageId: string, candidateParentId: string | null): Promise<boolean> {
  if (!candidateParentId) return false;
  if (candidateParentId === pageId) return true;

  let cursor = await Page.findOne({ _id: candidateParentId, ...LIVE }).select('parentId');
  let guard = 0;
  while (cursor?.parentId) {
    if (String(cursor.parentId) === pageId) return true;
    if (++guard > MAX_PAGE_DEPTH + 2) break; // defensive: malformed data shouldn't hang the request
    cursor = await Page.findOne({ _id: cursor.parentId, ...LIVE }).select('parentId');
  }
  return false;
}

/**
 * Moving a subtree can overflow the depth cap even when the moved node itself would
 * fit, so the deepest descendant decides whether a reparent is legal.
 */
export async function subtreeHeight(page: PageDoc): Promise<number> {
  const descendants = await Page.find({ path: new RegExp(`^${escapeRegExp(page.path)}/`), ...LIVE }).select('depth');
  if (descendants.length === 0) return 0;
  return Math.max(...descendants.map((d) => d.depth)) - page.depth;
}

function pushPreviousPath(page: PageDoc, previousPath: string): void {
  if (page.previousPaths.includes(previousPath)) return;
  page.previousPaths.push(previousPath);
  // A redirect table, not an audit log — drop the oldest entries past the cap.
  if (page.previousPaths.length > MAX_PREVIOUS_PATHS) {
    page.previousPaths = page.previousPaths.slice(-MAX_PREVIOUS_PATHS);
  }
}

/**
 * Rewrites this page's path and every descendant's, recording the old paths so links
 * already shared keep working via a 301. Without this, renaming a page silently breaks
 * every link you've shared and every search result pointing at it.
 *
 * Runs in a transaction where the cluster supports one (replica set / Atlas). A
 * standalone mongod cannot, so it falls back to a sequenced write and logs loudly —
 * a partial rename leaves unreachable descendants and must not pass unnoticed.
 */
export async function repathSubtree(page: PageDoc, nextPath: string, nextDepth: number): Promise<void> {
  const previousPath = page.path;
  if (previousPath === nextPath) {
    await page.save();
    return;
  }

  const descendants = await Page.find({ path: new RegExp(`^${escapeRegExp(previousPath)}/`), ...LIVE });

  const apply = async () => {
    page.path = nextPath;
    page.depth = nextDepth;
    pushPreviousPath(page, previousPath);
    await page.save();

    for (const child of descendants) {
      const childPrevious = child.path;
      child.path = nextPath + childPrevious.slice(previousPath.length);
      child.depth = nextDepth + (childPrevious.split('/').length - previousPath.split('/').length);
      pushPreviousPath(child, childPrevious);
      await child.save();
    }
  };

  const session = await mongoose.startSession().catch(() => null);
  if (session) {
    try {
      await session.withTransaction(apply);
      return;
    } catch (error) {
      // Standalone mongod rejects transactions outright; that's expected in dev and
      // shouldn't stop the rename. Anything else is a real failure worth shouting about.
      const message = (error as Error).message ?? '';
      const unsupported = /Transaction numbers|replica set|not supported/i.test(message);
      if (!unsupported) {
        logger.error({ err: error, previousPath, nextPath }, 'Transactional repath failed');
        throw error;
      }
      logger.warn({ previousPath, nextPath }, 'Transactions unsupported — repathing sequentially');
    } finally {
      await session.endSession();
    }
  }

  try {
    await apply();
  } catch (error) {
    // A half-finished rename leaves descendants on paths that no longer resolve.
    logger.error(
      { err: error, previousPath, nextPath, descendants: descendants.length },
      'Sequenced repath failed part-way — some descendants may be unreachable',
    );
    throw error;
  }
}

export async function listDescendants(page: PageDoc): Promise<PageDoc[]> {
  return Page.find({ path: new RegExp(`^${escapeRegExp(page.path)}/`), ...LIVE }).sort({ depth: 1, path: 1 });
}

export function toIdOrNull(value: unknown): Types.ObjectId | null {
  return value ? new Types.ObjectId(String(value)) : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
