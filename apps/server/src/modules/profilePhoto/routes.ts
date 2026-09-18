import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { profilePhotoLinkSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { uploadToCloud, deleteFromCloud } from '../../services/cloudinary';
import { UPLOADS_DIR } from '../../config/paths';
import { ProfilePhoto, ProfilePhotoDoc } from './profilePhoto.model';

/**
 * Home page portrait.
 *
 *   GET    /api/v1/profile-photo          public — { url, updatedAt } or 204
 *   POST   /api/v1/profile-photo          admin  — multipart `file`, replaces current
 *   POST   /api/v1/profile-photo/link     admin  — { url }, e.g. a Google Drive link
 *   DELETE /api/v1/profile-photo          admin  — removes it; site falls back
 *
 * Replacing deletes the previous file from storage, so old portraits don't pile up on
 * disk or in Cloudinary.
 */
const router = Router();

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `profile-${unique}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    // First gate only — both are client-declared. The byte check below is the real one.
    // SVG is deliberately not accepted: it is markup, and can carry script.
    const ok =
      ALLOWED_EXT.has(path.extname(file.originalname).toLowerCase()) &&
      ALLOWED_MIME.has(file.mimetype);
    if (ok) return cb(null, true);
    cb(new Error('Only JPEG, PNG or WebP images are allowed'));
  },
});

function acceptImage(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    const tooBig = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
    const message = tooBig
      ? 'The image exceeds the 5MB limit'
      : err instanceof Error
        ? err.message
        : 'Upload failed';
    res.status(400).json(errorBody('VALIDATION_ERROR', message));
  });
}

/** Identifies an image from its leading bytes. */
export function sniffImage(b: Buffer): 'jpeg' | 'png' | 'webp' | 'gif' | null {
  const n = b.length;
  if (n >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (n >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (n >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (n >= 6 && /^GIF8[79]a$/.test(b.toString('latin1', 0, 6))) return 'gif';
  return null;
}

/** Sniffs the real format of an uploaded file. GIF is not an accepted upload type. */
function detectImage(filePath: string): 'jpeg' | 'png' | 'webp' | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const b = Buffer.alloc(12);
    const n = fs.readSync(fd, b, 0, 12, 0);
    const kind = sniffImage(b.subarray(0, n));
    return kind === 'gif' ? null : kind;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Turns a Google Drive share link into a direct image address.
 *
 * A share link (`drive.google.com/file/d/<id>/view`) opens Google's viewer *page*, which
 * an <img> cannot render. Drive's own thumbnail endpoint redirects to
 * `lh3.googleusercontent.com/d/<id>=w<width>`, so that is stored directly — it saves a
 * redirect on every page view. Non-Drive links come back unchanged.
 */
export function toDirectImageUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return input;

  const id = url.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]{10,})/)?.[1] ?? url.searchParams.get('id');
  if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) return input;

  return `https://lh3.googleusercontent.com/d/${id}=w1600`;
}

const LINK_TIMEOUT_MS = 10_000;

/**
 * Confirms a link really serves an image before the site is pointed at it.
 *
 * A Drive file that isn't shared publicly comes back as an HTML error page rather than
 * an image, so checking the content type *and* the real leading bytes is what catches
 * "sharing isn't set to Anyone with the link".
 */
async function linkServesImage(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) {
      await res.body?.cancel().catch(() => undefined);
      return false;
    }
    // Only the first chunk is needed to sniff — don't download the whole photo.
    const reader = res.body?.getReader();
    const first = reader ? await reader.read() : undefined;
    await reader?.cancel().catch(() => undefined);
    return !!first?.value && sniffImage(Buffer.from(first.value)) !== null;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function safeUnlink(filePath?: string) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    logger.warn({ err, filePath }, 'Failed to clean up rejected profile photo upload');
  }
}

/** Best-effort: a stale file left behind is a disk-space problem, not a broken site. */
async function removeAsset(doc: Pick<ProfilePhotoDoc, 'provider' | 'storageKey'>) {
  // A pasted link lives on someone else's storage — there is nothing of ours to delete.
  if (doc.provider === 'external' || !doc.storageKey) return;
  try {
    await deleteFromCloud(doc.provider, doc.storageKey, 'image');
  } catch (err) {
    logger.error({ err, storageKey: doc.storageKey }, 'Failed to delete previous profile photo');
  }
}

const toPublic = (doc: ProfilePhotoDoc) => ({
  url: doc.url,
  source: doc.provider === 'external' ? ('link' as const) : ('upload' as const),
  sourceUrl: doc.provider === 'external' ? doc.sourceUrl : undefined,
  updatedAt: doc.updatedAt.toISOString(),
});

// Public: GET /api/v1/profile-photo
router.get('/', async (_req: Request, res: Response) => {
  try {
    const doc = await ProfilePhoto.findOne({ slot: 'hero' });
    if (!doc) return res.status(204).send();
    res.json(toPublic(doc));
  } catch (error) {
    logger.error({ err: error }, 'Failed to read profile photo');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to read profile photo'));
  }
});

// Admin: POST /api/v1/profile-photo
router.post('/', requireAdmin, acceptImage, async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json(errorBody('VALIDATION_ERROR', 'No image uploaded'));
  }

  if (!detectImage(file.path)) {
    safeUnlink(file.path);
    return res.status(400).json(errorBody('VALIDATION_ERROR', 'That file is not a valid JPEG, PNG or WebP image'));
  }

  // Order matters. Store the new image and point the record at it FIRST, and only then
  // delete the old one — if any step fails midway, the site still has a working photo.
  let stored: Awaited<ReturnType<typeof uploadToCloud>> | undefined;
  // Set once the record points at the new file. After that, the new file is the live
  // photo and must never be cleaned up as an "orphan", whatever else throws.
  let committed = false;
  try {
    stored = await uploadToCloud(file.path, file.filename, {
      folder: 'portfolio/profile',
      resourceType: 'image',
    });

    // Atomic swap that hands back the row it replaced, so each upload deletes exactly
    // the asset it superseded — even if two uploads race.
    const previous = await ProfilePhoto.findOneAndUpdate(
      { slot: 'hero' },
      {
        $set: {
          url: stored.url,
          provider: stored.provider,
          storageKey: stored.storageKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
        $unset: { sourceUrl: '' },
      },
      { upsert: true, returnDocument: 'before', runValidators: true }
    );
    committed = true;

    if (previous && previous.storageKey !== stored.storageKey) {
      await removeAsset(previous);
    }

    const current = await ProfilePhoto.findOne({ slot: 'hero' });
    res.status(201).json(toPublic(current!));
  } catch (error) {
    // Only an uncommitted file is an orphan. Deleting after the swap would blank the site.
    if (!committed) {
      if (stored) await removeAsset(stored);
      else safeUnlink(file.path);
    }
    logger.error({ err: error }, 'Profile photo upload failed');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Profile photo upload failed'));
  }
});

// Admin: POST /api/v1/profile-photo/link — use an image hosted elsewhere, e.g. Drive.
router.post(
  '/link',
  requireAdmin,
  validateRequest(profilePhotoLinkSchema),
  async (req: Request, res: Response) => {
    const sourceUrl: string = req.body.url;
    const direct = toDirectImageUrl(sourceUrl);

    if (!(await linkServesImage(direct))) {
      // By host, not by whether the link converted: a Drive *folder* link doesn't
      // convert, but still needs the Drive-specific advice.
      const isDrive = /(^|\.)(drive|docs)\.google\.com$/.test(new URL(sourceUrl).hostname);
      return res
        .status(400)
        .json(
          errorBody(
            'VALIDATION_ERROR',
            isDrive
              ? 'Could not load an image from that Drive link. In Drive, open Share and set General access to "Anyone with the link", and check the file is an image.'
              : 'Could not load an image from that link. It must open directly to a JPEG, PNG, WebP or GIF image.'
          )
        );
    }

    try {
      const previous = await ProfilePhoto.findOneAndUpdate(
        { slot: 'hero' },
        {
          $set: { url: direct, provider: 'external', storageKey: '', sourceUrl },
          $unset: { originalName: '', mimeType: '', size: '' },
        },
        { upsert: true, returnDocument: 'before', runValidators: true }
      );

      // Switching from an uploaded photo to a link still deletes the uploaded file.
      if (previous) await removeAsset(previous);

      const current = await ProfilePhoto.findOne({ slot: 'hero' });
      res.status(201).json(toPublic(current!));
    } catch (error) {
      logger.error({ err: error }, 'Failed to set profile photo link');
      res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to save the photo link'));
    }
  }
);

// Admin: DELETE /api/v1/profile-photo
router.delete('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const doc = await ProfilePhoto.findOneAndDelete({ slot: 'hero' });
    if (!doc) return res.status(404).json(errorBody('NOT_FOUND', 'No profile photo is set'));
    await removeAsset(doc);
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to remove profile photo');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to remove profile photo'));
  }
});

export default router;
