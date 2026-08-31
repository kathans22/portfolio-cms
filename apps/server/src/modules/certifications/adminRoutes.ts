import { Router, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { certificationSchema, reorderSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Certification } from './certification.model';
import { findMissingSkillIds } from './skillRefs';

const router = Router();

// Everything below is admin-only and, unlike the public routes, shows drafts and
// expired credentials.
router.use(requireAdmin);

// Admin: GET /api/v1/admin/certifications
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.domain === 'string') filter.domains = req.query.domain;
    if (typeof req.query.status === 'string') filter.status = req.query.status.toUpperCase();
    if (typeof req.query.skillId === 'string') filter.skillIds = req.query.skillId;

    const sort = { order: 1 as const, issueDate: -1 as const };

    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Certification.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit),
        Certification.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    res.json(await Certification.find(filter).sort(sort));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch certifications for admin');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch certifications'));
  }
});

// Admin: PATCH /api/v1/admin/certifications/reorder
// Declared before /:id so "reorder" isn't captured as an id.
router.patch('/reorder', validateRequest(reorderSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };

    const result = await Certification.bulkWrite(
      ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      }))
    );

    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) {
    logger.error({ err: error }, 'Failed to reorder certifications');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to reorder certifications'));
  }
});

// Admin: POST /api/v1/admin/certifications
router.post('/', validateRequest(certificationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const missing = await findMissingSkillIds(req.body.skillIds ?? []);
    if (missing.length > 0) {
      return res
        .status(400)
        .json(errorBody('VALIDATION_ERROR', 'One or more mapped skills do not exist', { skillIds: missing }));
    }

    const certification = await Certification.create(req.body);
    res.status(201).json(certification);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create certification');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create certification'));
  }
});

// Admin: PATCH /api/v1/admin/certifications/:id
router.patch('/:id', validateRequest(certificationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const missing = await findMissingSkillIds(req.body.skillIds ?? []);
    if (missing.length > 0) {
      return res
        .status(400)
        .json(errorBody('VALIDATION_ERROR', 'One or more mapped skills do not exist', { skillIds: missing }));
    }

    const certification = await Certification.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!certification) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Certification not found'));
    }
    res.json(certification);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update certification');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update certification'));
  }
});

// Admin: DELETE /api/v1/admin/certifications/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await Certification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Certification not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete certification');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete certification'));
  }
});

export default router;
