import { Router, Request, Response } from 'express';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Certification, publicCertificationFilter } from './certification.model';
import { toPublicCertification } from './publicView';

const router = Router();

// Public: GET /api/v1/certifications?domain=&featured=&includeExpired=false&page=&limit=
//
// Expired credentials stay in the database and remain visible in admin, but drop out
// of the public list unless explicitly requested or individually opted back in with
// showWhenExpired.
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeExpired = req.query.includeExpired === 'true';
    const filter: Record<string, unknown> = publicCertificationFilter(includeExpired);

    if (typeof req.query.domain === 'string') {
      filter.domains = req.query.domain;
    }
    if (req.query.featured !== undefined) {
      filter.featured = req.query.featured === 'true';
    }
    if (typeof req.query.skillId === 'string') {
      filter.skillIds = req.query.skillId;
    }

    const sort = { order: 1 as const, issueDate: -1 as const };

    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Certification.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit),
        Certification.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items.map(toPublicCertification), total, pagination));
    }

    const certifications = await Certification.find(filter).sort(sort);
    res.json(certifications.map(toPublicCertification));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch certifications');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch certifications'));
  }
});

// Public: GET /api/v1/certifications/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const certification = await Certification.findOne({
      _id: req.params.id,
      ...publicCertificationFilter(true),
    });

    if (!certification) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Certification not found'));
    }

    res.json(toPublicCertification(certification));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch certification details');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch certification details'));
  }
});

export default router;
