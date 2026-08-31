import { Router, Response } from 'express';
import { requireAdmin, optionalAuth, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { blogSchema } from '@portfolio/shared';
import { errorBody, isDuplicateKeyError } from '../../utils/apiError';
import { findPageShadowingSlug } from '../pages/page.service';
import { logger } from '../../utils/logger';
import { getPaginationParams, paginatedResponse } from '../../utils/pagination';
import { BlogPost } from './blogPost.model';

const router = Router();

// Public (auth-aware): GET /api/v1/blog?tag=&domain=&status=published&page=&limit=
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = req.userId ? {} : { status: 'PUBLISHED' };

    if (typeof req.query.tag === 'string') {
      filter.tags = req.query.tag;
    }
    if (typeof req.query.domain === 'string') {
      filter.domains = req.query.domain;
    }
    if (req.userId && typeof req.query.status === 'string') {
      filter.status = req.query.status.toUpperCase();
    }

    const pagination = getPaginationParams(req);
    if (pagination) {
      const [items, total] = await Promise.all([
        BlogPost.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
        BlogPost.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, pagination));
    }

    const posts = await BlogPost.find(filter).sort({ publishedAt: -1, createdAt: -1 });
    res.json(posts);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch blog posts');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch blog posts'));
  }
});

// Public (auth-aware): GET /api/v1/blog/:slug
router.get('/:slug', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug });

    if (!post || (post.status !== 'PUBLISHED' && !req.userId)) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Blog post not found'));
    }

    res.json(post);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch blog post details');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch blog post details'));
  }
});

// Admin: POST /api/v1/blog
router.post('/', requireAdmin, validateRequest(blogSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Section 4.1 reverse check: a page already at this URL would shadow the entry,
    // because the resolver gives pages precedence. Blocked on both sides so
    // resolution never has to arbitrate an ambiguity that shouldn't exist.
    const shadowing = await findPageShadowingSlug('blog', req.body.slug);
    if (shadowing) {
      return res.status(409).json(errorBody('CONFLICT', `A page already exists at ${shadowing} and would hide this blog post`));
    }

    const data = { ...req.body };
    if (data.status === 'PUBLISHED' && !data.publishedAt) {
      data.publishedAt = new Date();
    }
    const post = await BlogPost.create(data);
    res.status(201).json(post);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', 'A blog post with that slug already exists'));
    }
    logger.error({ err: error }, 'Failed to create blog post');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to create blog post'));
  }
});

// Admin: PATCH /api/v1/blog/:id
router.patch('/:id', requireAdmin, validateRequest(blogSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Section 4.1 reverse check: a page already at this URL would shadow the entry,
    // because the resolver gives pages precedence. Blocked on both sides so
    // resolution never has to arbitrate an ambiguity that shouldn't exist.
    const shadowing = await findPageShadowingSlug('blog', req.body.slug);
    if (shadowing) {
      return res.status(409).json(errorBody('CONFLICT', `A page already exists at ${shadowing} and would hide this blog post`));
    }

    const existing = await BlogPost.findById(req.params.id);
    if (!existing) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Blog post not found'));
    }

    const data = { ...req.body };
    if (data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED' && !data.publishedAt) {
      data.publishedAt = new Date();
    } else if (data.status !== 'PUBLISHED') {
      data.publishedAt = null;
    }

    const post = await BlogPost.findByIdAndUpdate(req.params.id, data, { returnDocument: 'after', runValidators: true });
    res.json(post);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json(errorBody('CONFLICT', 'A blog post with that slug already exists'));
    }
    logger.error({ err: error }, 'Failed to update blog post');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update blog post'));
  }
});

// Admin: DELETE /api/v1/blog/:id
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await BlogPost.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Blog post not found'));
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete blog post');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete blog post'));
  }
});

export default router;
