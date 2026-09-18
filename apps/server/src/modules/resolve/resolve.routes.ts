import { Router, Request, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { Page } from '../pages/page.model';
import { Project } from '../projects/project.model';
import { BlogPost } from '../blog/blogPost.model';
import { LIVE } from '../pages/page.service';
import { normalizePath, resolvePath, strongETag, ResolveOutcome } from './resolve.service';
import { getCachedResolve, setCachedResolve, getDerived, setDerived } from './resolveCache';

const router = Router();

// max-age keeps a warm copy for a minute; stale-while-revalidate lets a shared cache
// serve that copy for another five while it refreshes in the background, so a visitor
// arriving after expiry never waits on a Render cold start. Publishes bust the
// server-side cache explicitly, so the stale window is bounded by the CDN, not by us.
const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

// The derived list endpoints (/nav, /sitemap*) are now busted server-side on any
// Page/Project/BlogPost write, so their wire cache only has to smooth cold starts —
// it no longer has to paper over staleness. Hence a much shorter window than the
// page cache: a delete a visitor's browser already cached self-corrects in ~30s.
const DERIVED_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=120';

// GET /api/v1/resolve?path=/some/path[&preview=true]
router.get('/resolve', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const path = normalizePath(String(req.query.path ?? ''));
    if (path === null) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'Invalid path'));
    }

    // Draft content is never visible without a valid admin token, whatever the query
    // string says.
    const preview = req.query.preview === 'true' && !!req.userId;

    // A preview is per-admin and per-draft, so it is neither served from nor written to
    // the cache — otherwise an unpublished draft could be handed to a visitor.
    if (!preview) {
      const cached = getCachedResolve<ResolveOutcome>(path);
      if (cached) {
        res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
        res.setHeader('ETag', cached.etag);
        res.setHeader('X-Cache', 'HIT');
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        return res.json(cached.payload);
      }
    }

    const { outcome, dependsOn } = await resolvePath(path, preview);

    // Only public page reads are cacheable.
    if (outcome.kind === 'PAGE' && !preview) {
      const etag = strongETag(outcome);
      setCachedResolve(path, outcome, etag, dependsOn);

      res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
      res.setHeader('ETag', etag);
      res.setHeader('X-Cache', 'MISS');
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    return res.json(outcome);
  } catch (error) {
    logger.error({ err: error, path: req.query.path }, 'Failed to resolve path');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to resolve path'));
  }
});

interface NavNode {
  id: string;
  path: string;
  label: string;
  navOrder: number;
  children: NavNode[];
}

async function buildNavTree(): Promise<NavNode[]> {
  const pages = await Page.find({ status: 'PUBLISHED', showInNav: true, ...LIVE })
    .select('path title navLabel parentId navOrder')
    .sort({ navOrder: 1 });

  const byId = new Map<string, NavNode>();
  for (const page of pages) {
    byId.set(String(page._id), {
      id: String(page._id),
      path: page.path,
      label: page.navLabel || page.title,
      navOrder: page.navOrder,
      children: [],
    });
  }

  const roots: NavNode[] = [];
  for (const page of pages) {
    const node = byId.get(String(page._id))!;
    const parent = page.parentId ? byId.get(String(page.parentId)) : undefined;
    // A child whose parent is unpublished or hidden from nav has no place to hang,
    // so it surfaces at the top level rather than vanishing.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (nodes: NavNode[]): NavNode[] =>
    nodes
      .sort((a, b) => a.navOrder - b.navOrder)
      .map((node) => ({ ...node, children: sortTree(node.children) }));

  return sortTree(roots);
}

// GET /api/v1/nav — the published navigation tree, nested.
router.get('/nav', async (req: Request, res: Response) => {
  try {
    const cached = getDerived<NavNode[]>('nav');
    const tree = cached ?? (await buildNavTree());
    if (!cached) setDerived('nav', tree, new Set(['Page']));

    res.setHeader('Cache-Control', DERIVED_CACHE_CONTROL);
    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
    res.json(tree);
  } catch (error) {
    logger.error({ err: error }, 'Failed to build navigation tree');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to build navigation tree'));
  }
});

// GET /api/v1/sitemap — paths plus lastmod, for sitemap.xml generation.
router.get('/sitemap', async (req: Request, res: Response) => {
  try {
    let entries = getDerived<{ path: string; lastmod: Date }[]>('sitemap');
    const hit = !!entries;
    if (!entries) {
      const pages = await Page.find({ status: 'PUBLISHED', noIndex: false, ...LIVE })
        .select('path updatedAt')
        .sort({ path: 1 });
      entries = pages.map((page) => ({
        path: page.path,
        lastmod: (page as unknown as { updatedAt: Date }).updatedAt,
      }));
      setDerived('sitemap', entries, new Set(['Page']));
    }

    res.setHeader('Cache-Control', DERIVED_CACHE_CONTROL);
    res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(entries);
  } catch (error) {
    logger.error({ err: error }, 'Failed to build sitemap');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to build sitemap'));
  }
});

// GET /api/v1/sitemap.xml — the real sitemap, generated on request.
//
// Once routes are admin-created this cannot be a build-time file: a page published
// after the last deploy would be missing until someone rebuilt. SITE_URL must point at
// the public origin, since the sitemap advertises the site's own URLs, not the API's.
router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
    if (!siteUrl) {
      return res.status(503).type('text/plain').send('SITE_URL is not configured');
    }

    let xml = getDerived<string>('sitemap.xml');
    const hit = !!xml;
    if (!xml) {
      const [pages, projects, posts] = await Promise.all([
        Page.find({ status: 'PUBLISHED', noIndex: false, ...LIVE }).select('path updatedAt').sort({ path: 1 }),
        Project.find({ status: 'PUBLISHED' }).select('slug updatedAt').sort({ slug: 1 }),
        BlogPost.find({ status: 'PUBLISHED' }).select('slug updatedAt').sort({ slug: 1 }),
      ]);

      const entries = [
        ...pages.map((p) => ({ loc: p.path, lastmod: (p as unknown as { updatedAt: Date }).updatedAt })),
        ...projects.map((p) => ({ loc: `/projects/${p.slug}`, lastmod: (p as unknown as { updatedAt: Date }).updatedAt })),
        ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: (p as unknown as { updatedAt: Date }).updatedAt })),
      ];

      xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url><loc>${escapeXml(siteUrl + entry.loc)}</loc>${
        entry.lastmod ? `<lastmod>${new Date(entry.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''
      }</url>`
  )
  .join('\n')}
</urlset>
`;
      setDerived('sitemap.xml', xml, new Set(['Page', 'Project', 'BlogPost']));
    }

    res.setHeader('Cache-Control', DERIVED_CACHE_CONTROL);
    res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
    res.type('application/xml').send(xml);
  } catch (error) {
    logger.error({ err: error }, 'Failed to build sitemap.xml');
    res.status(500).type('text/plain').send('Failed to build sitemap');
  }
});

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] as string
  );
}

export default router;
