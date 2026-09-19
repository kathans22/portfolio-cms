import { Router, Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import {
  resumeUpdateSchema,
  ResumeUpdateInput,
  resumeLinkSchema,
  ResumeLinkInput,
  extractDriveFileId,
  driveDownloadUrl,
  driveViewUrl,
} from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { uploadToCloud, deleteFromCloud } from '../../services/cloudinary';
import { UPLOADS_DIR } from '../../config/paths';
import { Resume } from './resume.model';
import { activateResume } from './resume.service';

/** ADMIN-ONLY. Mounted at /api/v1/admin/resume behind requireAdmin. */
const router = Router();
router.use(requireAdmin);

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (e: Error | null, dest: string) => void) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `resume-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — generous for a PDF resume
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // First gate only. The extension and the declared MIME type are both set by the
    // client, so the real check is the magic-byte test after the file is on disk.
    const extOk = path.extname(file.originalname).toLowerCase() === '.pdf';
    const typeOk = file.mimetype === 'application/pdf';
    if (extOk && typeOk) return cb(null, true);
    cb(new Error('Only PDF files are allowed'));
  },
});

// Runs multer and turns its errors into this API's error envelope instead of letting
// them fall through to the generic 500 handler.
function acceptPdf(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    const tooBig = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
    const message = tooBig
      ? 'The file exceeds the 8MB limit'
      : err instanceof Error
        ? err.message
        : 'Upload failed';
    res.status(400).json(errorBody('VALIDATION_ERROR', message));
  });
}

// A real PDF begins with the five bytes "%PDF-" (0x25 0x50 0x44 0x46 0x2D).
function isRealPdf(filePath: string): boolean {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    const bytesRead = fs.readSync(fd, buf, 0, 5, 0);
    return bytesRead === 5 && buf.toString('latin1') === '%PDF-';
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function safeUnlink(filePath?: string) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.warn({ err, filePath }, 'Failed to clean up rejected resume upload');
    }
  }
}

// Admin: GET /api/v1/admin/resume — every version, newest first.
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await Resume.find().sort({ createdAt: -1 }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to list resumes');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to list resumes'));
  }
});

// Admin: POST /api/v1/admin/resume/upload — multipart field `file`, optional `label`.
router.post('/upload', acceptPdf, validateRequest(resumeUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json(errorBody('VALIDATION_ERROR', 'No file uploaded'));
  }

  if (!isRealPdf(file.path)) {
    safeUnlink(file.path);
    return res.status(400).json(errorBody('VALIDATION_ERROR', 'That file is not a valid PDF'));
  }

  try {
    const result = await uploadToCloud(file.path, file.filename, {
      folder: 'portfolio/resume',
      resourceType: 'auto',
    });

    // The first resume ever uploaded goes live immediately — otherwise the public
    // link would 404 until the admin remembered a second, separate "activate" step.
    const isFirst = (await Resume.countDocuments()) === 0;

    const label = ((req.body as ResumeUpdateInput).label || '').trim();
    const resume = await Resume.create({
      label: label || undefined,
      fileUrl: result.url,
      originalName: file.originalname,
      provider: result.provider,
      storageKey: result.storageKey,
      storageResourceType: result.resourceType,
      mimeType: file.mimetype,
      fileSize: file.size,
      isActive: isFirst,
    });

    res.status(201).json(resume);
  } catch (error) {
    safeUnlink(file.path);
    logger.error({ err: error }, 'Resume upload failed');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Resume upload failed'));
  }
});

/**
 * Confirms a Drive file is publicly readable AND a PDF. A file that isn't shared as
 * "Anyone with the link" comes back as an HTML sign-in page, so the leading bytes —
 * not the status code — are what tell the two apart.
 */
async function driveFileIsPublicPdf(id: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(driveDownloadUrl(id), { redirect: 'follow', signal: controller.signal });
    if (!res.ok || !res.body) return false;
    const reader = res.body.getReader();
    const { value } = await reader.read();
    await reader.cancel().catch(() => undefined);
    return !!value && Buffer.from(value.subarray(0, 5)).toString('latin1') === '%PDF-';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Admin: POST /api/v1/admin/resume/link — register a Google Drive PDF instead of uploading.
router.post('/link', validateRequest(resumeLinkSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, label } = req.body as ResumeLinkInput;
    const id = extractDriveFileId(url);
    if (!id) {
      return res
        .status(400)
        .json(errorBody('VALIDATION_ERROR', 'That is not a Google Drive file link (drive.google.com/file/d/…)'));
    }
    if (!(await driveFileIsPublicPdf(id))) {
      return res
        .status(400)
        .json(
          errorBody(
            'VALIDATION_ERROR',
            'Could not read a PDF at that link. Share the file as "Anyone with the link → Viewer" and make sure it is a PDF.'
          )
        );
    }

    const isFirst = (await Resume.countDocuments()) === 0;
    const resume = await Resume.create({
      label: (label || '').trim() || undefined,
      fileUrl: driveViewUrl(id),
      originalName: 'Google Drive PDF',
      provider: 'drive',
      storageKey: id,
      mimeType: 'application/pdf',
      isActive: isFirst,
    });
    res.status(201).json(resume);
  } catch (error) {
    logger.error({ err: error }, 'Resume link failed');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to save the resume link'));
  }
});

// Admin: PATCH /api/v1/admin/resume/:id — rename only.
router.patch('/:id', validateRequest(resumeUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Resume not found'));
    }
    const label = ((req.body as ResumeUpdateInput).label || '').trim();
    const updated = await Resume.findByIdAndUpdate(
      req.params.id,
      { $set: { label: label || undefined } },
      { new: true }
    );
    if (!updated) return res.status(404).json(errorBody('NOT_FOUND', 'Resume not found'));
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update resume');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update resume'));
  }
});

// Admin: PATCH /api/v1/admin/resume/:id/activate — make this version the public one.
router.patch('/:id/activate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Resume not found'));
    }
    const activated = await activateResume(req.params.id);
    if (!activated) return res.status(404).json(errorBody('NOT_FOUND', 'Resume not found'));
    res.json(activated);
  } catch (error) {
    logger.error({ err: error }, 'Failed to activate resume');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to activate resume'));
  }
});

// Admin: DELETE /api/v1/admin/resume/:id — history only; the active version is locked.
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Resume not found'));
    }
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json(errorBody('NOT_FOUND', 'Resume not found'));

    if (resume.isActive) {
      return res
        .status(409)
        .json(errorBody('CONFLICT', 'This resume is live on the site. Activate a different one before deleting it.'));
    }

    const rt = (resume.storageResourceType === 'raw' || resume.storageResourceType === 'video'
      ? resume.storageResourceType
      : 'image') as 'image' | 'raw' | 'video';
    // A Drive link owns no stored file — only the row is removed.
    if (resume.provider !== 'drive') await deleteFromCloud(resume.provider, resume.storageKey, rt);
    await resume.deleteOne();
    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete resume');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete resume'));
  }
});

export default router;
