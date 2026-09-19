import { Router, Request, Response } from 'express';
import { extractDriveFileId, driveImageUrl, faviconLinkSchema } from '@portfolio/shared';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { sniffImage } from '../profilePhoto/routes';
import { SiteSettings } from './siteSettings.model';

/**
 *   GET    /api/v1/site-settings                 public — { hasFavicon, updatedAt }
 *   GET    /api/v1/site-settings/favicon         public — the icon bytes
 *   GET    /api/v1/admin/site-settings           admin  — includes the pasted source link
 *   PUT    /api/v1/admin/site-settings/favicon   admin  — { url } (Google Drive link or https image)
 *   DELETE /api/v1/admin/site-settings/favicon   admin  — back to the built-in icon
 *
 * The icon is fetched by the SERVER and re-served, never hot-linked. Drive answers 429
 * to requests carrying a foreign Referer, and a favicon is requested by the browser
 * outside the page's control — proxying it sidesteps that entirely.
 */
export const publicRouter = Router();
export const adminRouter = Router();
adminRouter.use(requireAdmin);

const MAX_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

type IconMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/x-icon';

function sniffIcon(b: Buffer): IconMime | null {
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'image/x-icon';
  const kind = sniffImage(b);
  return kind ? (`image/${kind}` as IconMime) : null;
}

/** Drive share link -> a 256px direct image; any other https link is used as given. */
function toFetchableUrl(input: string): string | null {
  const id = extractDriveFileId(input);
  if (id) return driveImageUrl(id, 256);
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' || PRIVATE_HOST.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchIcon(url: string): Promise<{ buffer: Buffer; mime: IconMime } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
    const mime = sniffIcon(buffer);
    return mime ? { buffer, mime } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// One entry: the current icon, keyed by the address it came from.
let cache: { url: string; buffer: Buffer; mime: IconMime } | null = null;

publicRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const doc = await SiteSettings.findOne({ key: 'site' });
    res.json({ hasFavicon: !!doc?.faviconUrl, updatedAt: doc?.updatedAt?.toISOString() ?? null });
  } catch (error) {
    logger.error({ err: error }, 'Failed to read site settings');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to read site settings'));
  }
});

publicRouter.get('/favicon', async (_req: Request, res: Response) => {
  try {
    const doc = await SiteSettings.findOne({ key: 'site' });
    if (!doc?.faviconUrl) return res.status(404).json(errorBody('NOT_FOUND', 'No favicon set'));

    if (!cache || cache.url !== doc.faviconUrl) {
      const icon = await fetchIcon(doc.faviconUrl);
      if (!icon) return res.status(502).json(errorBody('BAD_GATEWAY', 'Could not fetch the favicon'));
      cache = { url: doc.faviconUrl, ...icon };
    }
    // helmet defaults to same-origin, which would stop the client origin loading this.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', cache.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(cache.buffer);
  } catch (error) {
    logger.error({ err: error }, 'Failed to serve favicon');
    if (!res.headersSent) res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to serve favicon'));
  }
});

adminRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const doc = await SiteSettings.findOne({ key: 'site' });
    res.json({
      faviconSourceUrl: doc?.faviconSourceUrl ?? null,
      hasFavicon: !!doc?.faviconUrl,
      updatedAt: doc?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to read site settings');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to read site settings'));
  }
});

adminRouter.put('/favicon', validateRequest(faviconLinkSchema), async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url: string };
    const fetchable = toFetchableUrl(url);
    if (!fetchable) {
      return res
        .status(400)
        .json(errorBody('VALIDATION_ERROR', 'Use a Google Drive file link or a public https image link'));
    }
    const icon = await fetchIcon(fetchable);
    if (!icon) {
      return res
        .status(400)
        .json(
          errorBody(
            'VALIDATION_ERROR',
            'Could not read an image at that link. Share the file as "Anyone with the link → Viewer" (PNG, JPG, WebP or ICO, under 1MB).'
          )
        );
    }
    const doc = await SiteSettings.findOneAndUpdate(
      { key: 'site' },
      { $set: { faviconSourceUrl: url, faviconUrl: fetchable } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    cache = { url: fetchable, ...icon };
    res.json({ faviconSourceUrl: doc.faviconSourceUrl, hasFavicon: true, updatedAt: doc.updatedAt.toISOString() });
  } catch (error) {
    logger.error({ err: error }, 'Failed to save favicon');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to save favicon'));
  }
});

adminRouter.delete('/favicon', async (_req: Request, res: Response) => {
  try {
    await SiteSettings.findOneAndUpdate({ key: 'site' }, { $unset: { faviconSourceUrl: 1, faviconUrl: 1 } });
    cache = null;
    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Failed to remove favicon');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to remove favicon'));
  }
});
