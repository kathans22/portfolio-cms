import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { uploadToCloud, deleteFromCloud } from '../../services/cloudinary';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Media } from './media.model';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

// Configure local uploads storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(__dirname, '../../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extName && mimeType) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, png, gif, webp, svg) are allowed'));
  },
});

// Admin: GET /api/v1/media?page=&limit=
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Media.find().sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
        Media.countDocuments(),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const media = await Media.find().sort({ createdAt: -1 });
    res.json(media);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch media library');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch media library'));
  }
});

// Admin: POST /api/v1/media/upload
router.post('/upload', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'No file uploaded'));
    }
    const result = await uploadToCloud(req.file.path, req.file.filename);
    const media = await Media.create({
      url: result.url,
      originalName: req.file.originalname,
      provider: result.provider,
      storageKey: result.storageKey,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
    res.json({ url: media.url, id: media.id });
  } catch (error) {
    logger.error({ err: error }, 'File upload failed');
    const message = error instanceof Error ? error.message : 'File upload failed';
    res.status(500).json(errorBody('INTERNAL_ERROR', message));
  }
});

// Admin: DELETE /api/v1/media/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Media item not found'));
    }
    await deleteFromCloud(media.provider, media.storageKey);
    await media.deleteOne();
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete media item');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete media item'));
  }
});

export default router;
