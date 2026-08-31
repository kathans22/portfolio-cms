import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { testimonialSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Testimonial } from './testimonial.model';

const router = Router();

// Public: GET /api/v1/testimonials?page=&limit=
router.get('/', async (req: Request, res: Response) => {
  try {
    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Testimonial.find().sort({ order: 1 }).skip(pagination.skip).limit(pagination.limit),
        Testimonial.countDocuments(),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const testimonials = await Testimonial.find().sort({ order: 1 });
    res.json(testimonials);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch testimonials');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch testimonials'));
  }
});

// Admin: POST /api/v1/testimonials
router.post('/', requireAdmin, validateRequest(testimonialSchema), async (req: Request, res: Response) => {
  try {
    const testimonial = await Testimonial.create(req.body);
    res.status(201).json(testimonial);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create testimonial');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create testimonial'));
  }
});

// Admin: PATCH /api/v1/testimonials/:id
router.patch('/:id', requireAdmin, validateRequest(testimonialSchema), async (req: Request, res: Response) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!testimonial) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Testimonial not found'));
    }
    res.json(testimonial);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update testimonial');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update testimonial'));
  }
});

// Admin: DELETE /api/v1/testimonials/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await Testimonial.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Testimonial not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete testimonial');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete testimonial'));
  }
});

export default router;
