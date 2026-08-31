import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { ContactMessage } from './contactMessage.model';

const router = Router();

// Admin: GET /api/v1/messages?isRead=&page=&limit=
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        ContactMessage.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
        ContactMessage.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const submissions = await ContactMessage.find(filter).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch contact submissions');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch contact submissions'));
  }
});

// Admin: PATCH /api/v1/messages/:id/read
router.patch('/:id/read', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isRead } = req.body;
    const submission = await ContactMessage.findByIdAndUpdate(req.params.id, { isRead }, { returnDocument: 'after', runValidators: true });
    if (!submission) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Contact submission not found'));
    }
    res.json(submission);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update contact submission read status');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update contact submission read status'));
  }
});

// Admin: DELETE /api/v1/messages/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Contact submission not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete contact submission');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete contact submission'));
  }
});

export default router;
