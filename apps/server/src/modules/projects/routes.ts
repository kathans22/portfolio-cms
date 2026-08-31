import { Router, Response } from 'express';
import { requireAdmin, optionalAuth, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { projectSchema } from '@portfolio/shared';
import { errorBody, isDuplicateKeyError } from '../../utils/apiError';
import { findPageShadowingSlug } from '../pages/page.service';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { Project } from './project.model';

const router = Router();

// Public (auth-aware): GET /api/v1/projects?featured=&tag=&domain=&page=&limit=
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = req.userId ? {} : { status: 'PUBLISHED' };

    if (req.query.featured !== undefined) {
      filter.featured = req.query.featured === 'true';
    }
    if (typeof req.query.tag === 'string') {
      filter.techStack = req.query.tag;
    }
    if (typeof req.query.domain === 'string') {
      filter.domains = req.query.domain;
    }

    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        Project.find(filter).sort({ order: 1, createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
        Project.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const projects = await Project.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(projects);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch projects');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch projects'));
  }
});

// Public (auth-aware): GET /api/v1/projects/:slug
router.get('/:slug', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug });

    if (!project || (project.status !== 'PUBLISHED' && !req.userId)) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Project not found'));
    }

    res.json(project);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch project details');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch project details'));
  }
});

// Admin: POST /api/v1/projects
router.post('/', requireAdmin, validateRequest(projectSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Section 4.1 reverse check: a page already at this URL would shadow the entry,
    // because the resolver gives pages precedence. Blocked on both sides so
    // resolution never has to arbitrate an ambiguity that shouldn't exist.
    const shadowing = await findPageShadowingSlug('projects', req.body.slug);
    if (shadowing) {
      return res.status(409).json(errorBody('CONFLICT', `A page already exists at ${shadowing} and would hide this project`));
    }

    const project = await Project.create(req.body);
    res.status(201).json(project);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', 'A project with that slug already exists'));
    }
    logger.error({ err: error }, 'Failed to create project');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create project'));
  }
});

// Admin: PATCH /api/v1/projects/:id
router.patch('/:id', requireAdmin, validateRequest(projectSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Section 4.1 reverse check: a page already at this URL would shadow the entry,
    // because the resolver gives pages precedence. Blocked on both sides so
    // resolution never has to arbitrate an ambiguity that shouldn't exist.
    const shadowing = await findPageShadowingSlug('projects', req.body.slug);
    if (shadowing) {
      return res.status(409).json(errorBody('CONFLICT', `A page already exists at ${shadowing} and would hide this project`));
    }

    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!project) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Project not found'));
    }
    res.json(project);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', 'A project with that slug already exists'));
    }
    logger.error({ err: error }, 'Failed to update project');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update project'));
  }
});

// Admin: DELETE /api/v1/projects/:id
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Project not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete project');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete project'));
  }
});

export default router;
