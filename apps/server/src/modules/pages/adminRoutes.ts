import { Router, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import {
  pageSchema,
  pagePatchSchema,
  pageSectionsSchema,
  pageTreeSchema,
  PageInput,
  PagePatchInput,
} from '@portfolio/shared';
import { errorBody, isDuplicateKeyError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { Page, PageAttrs, PageDoc, MAX_PAGE_DEPTH, SOFT_DELETE_RETENTION_DAYS } from './page.model';
import {
  checkSlugAvailability,
  computePath,
  listDescendants,
  repathSubtree,
  subtreeHeight,
  toIdOrNull,
  wouldCreateCycle,
  LIVE,
  PageValidationError,
} from './page.service';

/**
 * Shared by PATCH /:id and PATCH /tree. A reparent is only legal when it creates no
 * cycle and the *deepest descendant* still fits the cap — moving a subtree can overflow
 * it even when the moved node alone would not.
 */
async function assertReparentIsLegal(page: PageDoc, nextParentId: string | null): Promise<void> {
  if (await wouldCreateCycle(String(page._id), nextParentId)) {
    throw new PageValidationError('A page cannot be moved under itself or its own sub-page');
  }

  const { depth } = await computePath(page.slug, nextParentId);
  const height = await subtreeHeight(page);
  if (depth + height > MAX_PAGE_DEPTH) {
    throw new PageValidationError(
      `Moving this page would nest its sub-pages deeper than ${MAX_PAGE_DEPTH + 1} levels`
    );
  }
}

/**
 * `checkSlugAvailability` runs against live pages only, so a path can still be rejected
 * by the database underneath it — either from a genuine race between two admins, or from
 * a database whose `path` index was built before it became partial on `deletedAt`, where
 * a soft-deleted page keeps holding its URL. Either way the admin deserves a real
 * conflict rather than a 500 that reads like the server broke.
 *
 * Run `npm run db:indexes` to see whether an environment has that drift.
 */
const DUPLICATE_PATH_MESSAGE =
  'That URL is already taken. If a page there was recently deleted, restore it or wait for it to be purged.';

/** Non-blocking: a published child under a draft parent is reachable but orphaned in nav. */
async function draftParentWarning(status: string, parentId: string | null): Promise<string | undefined> {
  if (status !== 'PUBLISHED' || !parentId) return undefined;
  const parent = await Page.findOne({ _id: parentId, ...LIVE }).select('status title');
  if (parent && parent.status === 'DRAFT') {
    return `Parent "${parent.title}" is a draft — this page will be reachable by URL but missing from navigation`;
  }
  return undefined;
}

const router = Router();

router.use(requireAdmin);

interface PageTreeNode {
  id: string;
  path: string;
  title: string;
  slug: string;
  status: string;
  showInNav: boolean;
  navOrder: number;
  isSystem: boolean;
  children: PageTreeNode[];
}

function buildTree(pages: PageDoc[]): PageTreeNode[] {
  const byId = new Map<string, PageTreeNode>();
  for (const page of pages) {
    byId.set(String(page._id), {
      id: String(page._id),
      path: page.path,
      title: page.title,
      slug: page.slug,
      status: page.status,
      showInNav: page.showInNav,
      navOrder: page.navOrder,
      isSystem: page.isSystem,
      children: [],
    });
  }

  const roots: PageTreeNode[] = [];
  for (const page of pages) {
    const node = byId.get(String(page._id))!;
    const parent = page.parentId ? byId.get(String(page.parentId)) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (nodes: PageTreeNode[]): PageTreeNode[] =>
    nodes.sort((a, b) => a.navOrder - b.navOrder).map((n) => ({ ...n, children: sortTree(n.children) }));

  return sortTree(roots);
}

// Admin: GET /api/v1/admin/pages — flat list plus a tree view of the same data.
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const pages = await Page.find(includeDeleted ? {} : LIVE).sort({ path: 1 });
    const live = pages.filter((p) => !p.deletedAt);
    res.json({
      items: pages,
      tree: buildTree(live),
      deleted: pages.filter((p) => !!p.deletedAt),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch pages');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch pages'));
  }
});

// Admin: GET /api/v1/admin/pages/validate-slug?slug=&parentId=&excludeId=
// Declared before /:id so the literal segments aren't captured as ids.
router.get('/validate-slug', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const slug = String(req.query.slug ?? '').trim().toLowerCase();
    if (!slug) return res.status(400).json(errorBody('VALIDATION_ERROR', 'A slug is required'));

    const parentId = req.query.parentId ? String(req.query.parentId) : null;
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : undefined;

    res.json(await checkSlugAvailability(slug, parentId, excludeId));
  } catch (error) {
    logger.error({ err: error }, 'Failed to validate slug');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to validate slug'));
  }
});

// Admin: PATCH /api/v1/admin/pages/tree — bulk reorder/reparent from drag-and-drop.
router.patch('/tree', validateRequest(pageTreeSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body as { items: { id: string; parentId: string | null; navOrder: number }[] };

    // Shallowest first, so a parent's path is already correct before its children are
    // repathed against it.
    const pages = await Page.find({ _id: { $in: items.map((i) => i.id) } });
    const byId = new Map(pages.map((page) => [String(page._id), page]));
    const ordered = [...items].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));

    for (const item of ordered) {
      const page = byId.get(item.id);
      if (!page) continue;

      page.navOrder = item.navOrder;
      const parentChanged = String(page.parentId ?? '') !== String(item.parentId ?? '');

      if (parentChanged) {
        await assertReparentIsLegal(page, item.parentId);
        const { path, depth } = await computePath(page.slug, item.parentId);
        page.parentId = toIdOrNull(item.parentId);
        await repathSubtree(page, path, depth);
      } else {
        await page.save();
      }
    }

    const refreshed = await Page.find(LIVE).sort({ path: 1 });
    res.json({ items: refreshed, tree: buildTree(refreshed) });
  } catch (error) {
    if (error instanceof PageValidationError) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', error.message));
    }
    logger.error({ err: error }, 'Failed to reorder pages');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to reorder pages'));
  }
});

// Admin: GET /api/v1/admin/pages/:id — one page with its unresolved sections.
//
// Deliberately NOT resolved: the editor edits the stored query, and expanding it here
// would hand back documents it would then have to reverse-engineer back into filters.
// Declared after the literal GET routes so `validate-slug` isn't captured as an id.
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // The editor URL is user-typeable, so a malformed id is a 404, not a cast crash.
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Page not found'));
    }
    const page = await Page.findOne({ _id: req.params.id, ...LIVE });
    if (!page) return res.status(404).json(errorBody('NOT_FOUND', 'Page not found'));
    res.json(page);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch page');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch page'));
  }
});

// Admin: POST /api/v1/admin/pages
router.post('/', validateRequest(pageSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as PageInput;
    const parentId = body.parentId ?? null;

    const check = await checkSlugAvailability(body.slug, parentId);
    if (!check.available) {
      return res.status(409).json(errorBody('CONFLICT', check.reason ?? 'Path is unavailable', { path: check.path }));
    }

    const { path, depth } = await computePath(body.slug, parentId);
    const page = await Page.create({
      ...body,
      parentId: toIdOrNull(parentId),
      path,
      depth,
    } as unknown as PageAttrs);

    res.status(201).json(page);
  } catch (error) {
    if (error instanceof PageValidationError) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', error.message));
    }
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', DUPLICATE_PATH_MESSAGE));
    }
    logger.error({ err: error }, 'Failed to create page');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create page'));
  }
});

// Admin: POST /api/v1/admin/pages/:id/duplicate
router.post('/:id/duplicate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const source = await Page.findOne({ _id: req.params.id, ...LIVE });
    if (!source) return res.status(404).json(errorBody('NOT_FOUND', 'Page not found'));

    // Find a free slug rather than failing on the first collision.
    let slug = `${source.slug}-copy`;
    let attempt = 2;
    while (!(await checkSlugAvailability(slug, source.parentId ? String(source.parentId) : null)).available) {
      slug = `${source.slug}-copy-${attempt++}`;
      if (attempt > 50) return res.status(409).json(errorBody('CONFLICT', 'Could not find a free slug'));
    }

    const { path, depth } = await computePath(slug, source.parentId ? String(source.parentId) : null);

    const copy = await Page.create({
      ...source.toObject(),
      _id: undefined,
      slug,
      path,
      depth,
      // A duplicate starts unpublished and owns no redirects — inheriting the
      // original's previousPaths would hijack its URLs.
      previousPaths: [],
      title: `${source.title} (copy)`,
      status: 'DRAFT',
      isSystem: false,
    } as unknown as PageAttrs);

    res.status(201).json(copy);
  } catch (error) {
    logger.error({ err: error }, 'Failed to duplicate page');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to duplicate page'));
  }
});

// Admin: PUT /api/v1/admin/pages/:id/sections — replace the full ordered array.
router.put('/:id/sections', validateRequest(pageSectionsSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, ...LIVE });
    if (!page) return res.status(404).json(errorBody('NOT_FOUND', 'Page not found'));

    // Positions in the submitted array are authoritative, so a drag-reorder doesn't
    // depend on the client also getting every `order` value right.
    page.sections = (req.body.sections as PageAttrs['sections']).map((section, index) => ({
      ...section,
      order: index,
    }));
    await page.save();

    res.json(page);
  } catch (error) {
    logger.error({ err: error }, 'Failed to replace page sections');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to replace page sections'));
  }
});

// Admin: PATCH /api/v1/admin/pages/:id — metadata; recomputes paths on slug/parent change.
//
// Validated with the *partial* schema. The create schema's defaults would turn every
// omitted key into an unintended write: a client PATCHing only `{ slug, title }` would
// unpublish the page, show it in the nav and clear noIndex, all without asking.
router.patch('/:id', validateRequest(pagePatchSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, ...LIVE });
    if (!page) return res.status(404).json(errorBody('NOT_FOUND', 'Page not found'));

    const body = req.body as PagePatchInput;
    // An absent key means "leave this alone", so every field falls back to what is
    // already stored. `parentId` needs the `in` check because null is a real value
    // here — it means "move to the top level" — and `??` cannot tell it from absent.
    const nextParentId = 'parentId' in body ? body.parentId ?? null : (page.parentId ? String(page.parentId) : null);
    const slug = body.slug ?? page.slug;
    const nextStatus = body.status ?? page.status;

    const slugChanged = slug !== page.slug;
    const parentChanged = String(page.parentId ?? '') !== String(nextParentId ?? '');

    if (parentChanged) {
      await assertReparentIsLegal(page, nextParentId);
    }
    if (slugChanged || parentChanged) {
      const check = await checkSlugAvailability(slug, nextParentId, String(page._id));
      if (!check.available) {
        return res.status(409).json(errorBody('CONFLICT', check.reason ?? 'Path is unavailable', { path: check.path }));
      }
    }

    const warning = await draftParentWarning(nextStatus, nextParentId);
    // Only a transition into PUBLISHED counts; re-saving an already-live page must not
    // reset the timestamp, or "unpublished edits pending" becomes meaningless.
    const isPublishing = nextStatus === 'PUBLISHED' && page.status !== 'PUBLISHED';

    // `sections` has its own endpoint; a metadata PATCH must not clear them.
    const { sections: _ignoredSections, parentId: _ignoredParent, ...meta } = body;
    void _ignoredSections;
    void _ignoredParent;
    // Object.assign skips nothing, so strip the keys the client did not send rather
    // than writing `undefined` over stored values.
    for (const key of Object.keys(meta) as (keyof typeof meta)[]) {
      if (meta[key] === undefined) delete meta[key];
    }
    Object.assign(page, meta, { slug, status: nextStatus });
    if (isPublishing) page.lastPublishedAt = new Date();

    if (slugChanged || parentChanged) {
      const { path, depth } = await computePath(slug, nextParentId);
      page.parentId = toIdOrNull(nextParentId);
      await repathSubtree(page, path, depth);
    } else {
      await page.save();
    }

    const saved = (await Page.findById(page._id))!;
    res.json(warning ? { ...saved.toJSON(), warning } : saved);
  } catch (error) {
    if (error instanceof PageValidationError) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', error.message));
    }
    logger.error({ err: error }, 'Failed to update page');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update page'));
  }
});

// Admin: DELETE /api/v1/admin/pages/:id?strategy=promote|subtree
//
// Soft delete. Content removal is the one destructive action an admin regrets, and the
// recovery cost is trivial to provide — so the row survives for a restore window and a
// cleanup routine reaps it later.
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, ...LIVE });
    if (!page) return res.status(404).json(errorBody('NOT_FOUND', 'Page not found'));

    // System pages back hardcoded routes; removing one would 404 a URL the app still
    // links to. Enforced here, not just hidden in the UI.
    if (page.isSystem) {
      return res.status(403).json(errorBody('FORBIDDEN', 'System pages cannot be deleted'));
    }

    const descendants = await listDescendants(page);
    const strategy = req.query.strategy;

    if (descendants.length > 0 && strategy !== 'promote' && strategy !== 'subtree') {
      // Never pick silently: promoting and deleting the subtree are both reasonable and
      // the admin is the only one who knows which they meant.
      return res.status(409).json(
        errorBody(
          'CHOICE_REQUIRED',
          `This page has ${descendants.length} sub-page${descendants.length === 1 ? '' : 's'}. Choose whether to promote them or delete the whole subtree.`,
          {
            descendants: descendants.length,
            children: descendants.map((child) => ({ id: String(child._id), path: child.path, title: child.title })),
            strategies: ['promote', 'subtree'],
          }
        )
      );
    }

    const deletedAt = new Date();

    if (strategy === 'subtree') {
      await Page.updateMany({ _id: { $in: descendants.map((d) => d._id) } }, { $set: { deletedAt } });
    } else if (descendants.length > 0) {
      // Promote: direct children move up to the deleted page's parent, and each moved
      // subtree is repathed so its URLs still match its new position.
      const directChildren = descendants.filter((child) => String(child.parentId) === String(page._id));
      for (const child of directChildren) {
        const { path, depth } = await computePath(child.slug, page.parentId ? String(page.parentId) : null);
        child.parentId = page.parentId;
        await repathSubtree(child, path, depth);
      }
    }

    page.deletedAt = deletedAt;
    await page.save();

    res.json({
      deleted: String(page._id),
      strategy: descendants.length > 0 ? strategy : 'none',
      restorableUntil: new Date(deletedAt.getTime() + SOFT_DELETE_RETENTION_DAYS * 86400000),
    });
  } catch (error) {
    if (error instanceof PageValidationError) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', error.message));
    }
    logger.error({ err: error }, 'Failed to delete page');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete page'));
  }
});

// Admin: POST /api/v1/admin/pages/:id/restore
router.post('/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
    if (!page) return res.status(404).json(errorBody('NOT_FOUND', 'No deleted page with that id'));

    // Something may have taken the path in the meantime; restoring on top of it would
    // resurrect the ambiguity the resolver exists to prevent.
    const occupied = await Page.findOne({ path: page.path, ...LIVE });
    if (occupied) {
      return res.status(409).json(errorBody('CONFLICT', `Another page now occupies ${page.path}`));
    }

    // A restored child whose parent is gone would dangle, so it comes back at top level.
    if (page.parentId) {
      const parent = await Page.findOne({ _id: page.parentId, ...LIVE });
      if (!parent) {
        page.parentId = null;
        page.depth = 0;
        page.path = `/${page.slug}`;
      }
    }

    page.deletedAt = null;
    await page.save();

    res.json(page);
  } catch (error) {
    logger.error({ err: error }, 'Failed to restore page');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to restore page'));
  }
});

export default router;
