import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { experienceSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Experience } from './experience.model';

const router = Router();

// Public: GET /api/v1/experience?domain=&page=&limit=
router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.domain === 'string') {
      filter.domains = req.query.domain;
    }

    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Experience.find(filter).sort({ startDate: -1 }).skip(pagination.skip).limit(pagination.limit),
        Experience.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const experiences = await Experience.find(filter).sort({ startDate: -1 });
    res.json(experiences);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch experience records');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch experience records'));
  }
});

// Admin: POST /api/v1/experience
router.post('/', requireAdmin, validateRequest(experienceSchema), async (req: Request, res: Response) => {
  try {
    const exp = await Experience.create(req.body);
    res.status(201).json(exp);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create experience');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create experience'));
  }
});

// Admin: PATCH /api/v1/experience/:id
router.patch('/:id', requireAdmin, validateRequest(experienceSchema), async (req: Request, res: Response) => {
  try {
    const exp = await Experience.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!exp) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Experience not found'));
    }
    res.json(exp);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update experience');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update experience'));
  }
});

// Admin: DELETE /api/v1/experience/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await Experience.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Experience not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete experience');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete experience'));
  }
});

export default router;
