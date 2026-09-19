import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { drivePreviewUrl, driveDownloadUrl } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { UPLOADS_DIR } from '../../config/paths';
import { Resume } from './resume.model';
import { toPublicResume } from './resume.service';

/**
 * PUBLIC. Mounted at /api/v1/resume. Only ever exposes the one active version — an
 * inactive/old resume has no reachable URL here.
 */
const router = Router();

// Public: GET /api/v1/resume — metadata for the active version (or 404).
router.get('/', async (_req: Request, res: Response) => {
  try {
    const active = await Resume.findOne({ isActive: true });
    if (!active) return res.status(404).json(errorBody('NOT_FOUND', 'No resume is available'));
    res.json(toPublicResume(active));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch active resume');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch active resume'));
  }
});

// Public: GET /api/v1/resume/file — the active PDF served for INLINE viewing (an
// <iframe>/<object> on the About page). Framing headers are stripped here on purpose:
// helmet sets X-Frame-Options: SAMEORIGIN + a restrictive CSP globally, which would
// stop the client origin from embedding a same-content file from the API origin.
router.get('/file', async (_req: Request, res: Response) => {
  try {
    const active = await Resume.findOne({ isActive: true });
    if (!active) return res.status(404).json(errorBody('NOT_FOUND', 'No resume is available'));

    // A Drive resume is embedded straight from Drive's own preview page; nothing to proxy.
    if (active.provider === 'drive') return res.redirect(302, drivePreviewUrl(active.storageKey));

    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${active.originalName.replace(/[^\w.\- ]+/g, '_')}"`
    );
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (active.provider === 'local') {
      const filePath = path.join(UPLOADS_DIR, active.storageKey);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json(errorBody('NOT_FOUND', 'The resume file is missing from storage'));
      }
      return fs.createReadStream(filePath).pipe(res);
    }

    // Cloudinary (or any absolute URL): proxy it so this response's headers apply.
    // A resume PDF is a few hundred KB, so buffering is fine and avoids web/node
    // stream-type juggling.
    const upstream = await fetch(active.fileUrl);
    if (!upstream.ok) {
      return res.status(502).json(errorBody('BAD_GATEWAY', 'Could not fetch the resume file'));
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  } catch (error) {
    logger.error({ err: error }, 'Failed to serve resume file');
    if (!res.headersSent) res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to serve resume file'));
  }
});

// Public: GET /api/v1/resume/download — 302 to the active file. A stable link that
// always points at the current version, so it keeps working after a rollback.
router.get('/download', async (req: Request, res: Response) => {
  try {
    const active = await Resume.findOne({ isActive: true });
    if (!active) return res.status(404).json(errorBody('NOT_FOUND', 'No resume is available'));

    if (active.provider === 'drive') return res.redirect(302, driveDownloadUrl(active.storageKey));

    // A local-provider URL is relative to this API; make it absolute so the redirect
    // resolves when the client sits on a different origin.
    const target = active.fileUrl.startsWith('http')
      ? active.fileUrl
      : `${req.protocol}://${req.get('host')}${active.fileUrl}`;

    res.redirect(302, target);
  } catch (error) {
    logger.error({ err: error }, 'Failed to redirect to active resume');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch active resume'));
  }
});

export default router;
