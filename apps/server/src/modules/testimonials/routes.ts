import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { contactRateLimiter } from '../../middleware/rateLimiter';
import { testimonialSchema, testimonialSubmissionSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Testimonial, publicTestimonialFilter, PUBLIC_TESTIMONIAL_FIELDS } from './testimonial.model';

const router = Router();

// Public: GET /api/v1/testimonials?page=&limit=  — approved only, never `email`.
router.get('/', async (req: Request, res: Response) => {
  try {
    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Testimonial.find(publicTestimonialFilter)
          .select(PUBLIC_TESTIMONIAL_FIELDS)
          .sort({ order: 1 })
          .skip(pagination.skip)
          .limit(pagination.limit),
        Testimonial.countDocuments(publicTestimonialFilter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const testimonials = await Testimonial.find(publicTestimonialFilter)
      .select(PUBLIC_TESTIMONIAL_FIELDS)
      .sort({ order: 1 });
    res.json(testimonials);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch testimonials');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch testimonials'));
  }
});

// Public: POST /api/v1/testimonials/submit — anyone may leave one; nothing they send
// reaches the site until an admin approves it.
router.post(
  '/submit',
  contactRateLimiter,
  validateRequest(testimonialSubmissionSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, role, company, email, quote, website } = req.body;

      // Honeypot tripped — report success so the bot learns nothing, but persist nothing.
      if (website) return res.status(201).json({ success: true, id: null });

      const created = await Testimonial.create({
        name,
        role,
        company: company || undefined,
        email,
        quote,
        // Never trust the client for either of these.
        status: 'PENDING',
        submittedAt: new Date(),
        // New submissions sort to the end of the list once approved.
        order: 999,
      });

      res.status(201).json({ success: true, id: created.id });
    } catch (error) {
      logger.error({ err: error }, 'Failed to submit testimonial');
      res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to submit testimonial'));
    }
  }
);

// Admin: GET /api/v1/testimonials/all — the moderation view, pending included.
// Declared before any '/:id' route so 'all' is never read as an id.
router.get('/all', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const testimonials = await Testimonial.find().sort({ status: 1, order: 1, createdAt: -1 });
    res.json(testimonials);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch testimonials for moderation');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch testimonials'));
  }
});

// Admin: PATCH /api/v1/testimonials/:id/approve — publish a pending submission.
router.patch('/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'APPROVED' } },
      { returnDocument: 'after' }
    );
    if (!testimonial) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Testimonial not found'));
    }
    res.json(testimonial);
  } catch (error) {
    logger.error({ err: error }, 'Failed to approve testimonial');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to approve testimonial'));
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
