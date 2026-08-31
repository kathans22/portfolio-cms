import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { skillSchema } from '@portfolio/shared';
import { errorBody, isDuplicateKeyError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Skill } from './skill.model';
import { fetchSkillsWithCertifications } from './withCertifications';

const router = Router();

// Public: GET /api/v1/skills?domain=&withCertifications=true&page=&limit=
//
// The certification lookup is opt-in: pages that don't render badges shouldn't pay
// for the join.
router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.domain === 'string') {
      filter.domains = req.query.domain;
    }

    const withCertifications = req.query.withCertifications === 'true';
    const pagination = getPaginationParams(req);

    if (withCertifications) {
      const skills = await fetchSkillsWithCertifications(filter, pagination ?? {});
      if (pagination) {
        const total = await Skill.countDocuments(filter);
        return res.json(paginatedResponse(skills, total, pagination));
      }
      return res.json(skills);
    }

    if (pagination) {
      const [items, total] = await Promise.all([
        Skill.find(filter).sort({ order: 1 }).skip(pagination.skip).limit(pagination.limit),
        Skill.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    res.json(await Skill.find(filter).sort({ order: 1 }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch skills');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch skills'));
  }
});

// Admin: POST /api/v1/skills
router.post('/', requireAdmin, validateRequest(skillSchema), async (req: Request, res: Response) => {
  try {
    const skill = await Skill.create(req.body);
    res.status(201).json(skill);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', 'A skill with that name already exists'));
    }
    logger.error({ err: error }, 'Failed to create skill');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create skill'));
  }
});

// Admin: PATCH /api/v1/skills/:id
router.patch('/:id', requireAdmin, validateRequest(skillSchema), async (req: Request, res: Response) => {
  try {
    const skill = await Skill.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!skill) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Skill not found'));
    }
    res.json(skill);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', 'A skill with that name already exists'));
    }
    logger.error({ err: error }, 'Failed to update skill');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update skill'));
  }
});

// Admin: DELETE /api/v1/skills/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await Skill.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Skill not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete skill');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete skill'));
  }
});

export default router;
