import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { educationSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Education } from './education.model';

const router = Router();

// Public: GET /api/v1/education?page=&limit=
router.get('/', async (req: Request, res: Response) => {
  try {
    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Education.find().sort({ startDate: -1 }).skip(pagination.skip).limit(pagination.limit),
        Education.countDocuments(),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const educations = await Education.find().sort({ startDate: -1 });
    res.json(educations);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch education records');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch education records'));
  }
});

// Admin: POST /api/v1/education
router.post('/', requireAdmin, validateRequest(educationSchema), async (req: Request, res: Response) => {
  try {
    const edu = await Education.create(req.body);
    res.status(201).json(edu);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create education record');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create education record'));
  }
});

// Admin: PATCH /api/v1/education/:id
router.patch('/:id', requireAdmin, validateRequest(educationSchema), async (req: Request, res: Response) => {
  try {
    const edu = await Education.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!edu) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Education record not found'));
    }
    res.json(edu);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update education record');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update education record'));
  }
});

// Admin: DELETE /api/v1/education/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await Education.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Education record not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete education record');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete education record'));
  }
});

export default router;
