import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { sectionQuerySchema, SECTION_TYPE_KEYS, SectionType } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { Project } from '../projects/project.model';
import { BlogPost } from '../blog/blogPost.model';
import { Skill } from '../skills/skill.model';
import { Experience } from '../experience/experience.model';
import { Education } from '../education/education.model';
import { Testimonial } from '../testimonials/testimonial.model';
import { Certification, publicCertificationFilter } from '../certifications/certification.model';

const router = Router();
router.use(requireAdmin);

const countSchema = z.object({
  type: z.enum(SECTION_TYPE_KEYS),
  query: sectionQuerySchema.default({}),
});

type CountQuery = z.infer<typeof countSchema>['query'];

/**
 * Builds the same filter the resolver would, so the number shown in the query builder
 * is the number the page will actually render — not an approximation.
 */
function filterFor(type: SectionType, q: CountQuery): { model: { countDocuments: (f: Record<string, unknown>) => Promise<number> }; filter: Record<string, unknown> } | null {
  switch (type) {
    case 'PROJECT_LIST': {
      const filter: Record<string, unknown> = { status: 'PUBLISHED' };
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.tags?.length) filter.techStack = { $in: q.tags };
      if (q.featuredOnly) filter.featured = true;
      return { model: Project, filter };
    }
    case 'BLOG_LIST': {
      const filter: Record<string, unknown> = { status: 'PUBLISHED' };
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.tags?.length) filter.tags = { $in: q.tags };
      return { model: BlogPost, filter };
    }
    case 'CERTIFICATION_LIST': {
      const filter: Record<string, unknown> = publicCertificationFilter(q.includeExpired ?? false);
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.skillIds?.length) filter.skillIds = { $in: q.skillIds };
      if (q.featuredOnly) filter.featured = true;
      return { model: Certification, filter };
    }
    case 'SKILL_LIST': {
      const filter: Record<string, unknown> = {};
      if (q.domains?.length) filter.domains = { $in: q.domains };
      if (q.skillIds?.length) filter._id = { $in: q.skillIds };
      return { model: Skill, filter };
    }
    case 'EXPERIENCE_TIMELINE': {
      const filter: Record<string, unknown> = {};
      if (q.domains?.length) filter.domains = { $in: q.domains };
      return { model: Experience, filter };
    }
    case 'EDUCATION_TIMELINE':
      return { model: Education, filter: {} };
    case 'TESTIMONIAL_LIST':
      return { model: Testimonial, filter: {} };
    default:
      return null;
  }
}

/** Everything of this type that exists, ignoring the section's own filters. */
function unfilteredFor(type: SectionType): Record<string, unknown> {
  switch (type) {
    case 'PROJECT_LIST':
    case 'BLOG_LIST':
      return { status: 'PUBLISHED' };
    case 'CERTIFICATION_LIST':
      return publicCertificationFilter(true);
    default:
      return {};
  }
}

// Admin: POST /api/v1/admin/sections/count
//
// POST rather than GET because the query carries arrays; it is still a pure read.
// Powers "Showing 6 of 14 projects" so the admin sees the effect of a filter before
// saving, instead of publishing and checking.
router.post('/count', validateRequest(countSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, query } = req.body as z.infer<typeof countSchema>;

    const resolved = filterFor(type as SectionType, query);
    if (!resolved) {
      // Content and widget sections have nothing to count.
      return res.json({ matching: 0, total: 0, applicable: false });
    }

    const [matching, total] = await Promise.all([
      resolved.model.countDocuments(resolved.filter),
      resolved.model.countDocuments(unfilteredFor(type as SectionType)),
    ]);

    // `limit` caps what renders, so report it separately from what the filter matched.
    const shown = query.limit && query.limit > 0 ? Math.min(query.limit, matching) : matching;

    res.json({ matching, total, shown, applicable: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to count section results');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to count section results'));
  }
});

export default router;
