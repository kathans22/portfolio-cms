import { Router, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { Certification } from '../certifications/certification.model';
import { Skill } from './skill.model';

const router = Router();

router.use(requireAdmin);

// Admin: GET /api/v1/admin/skills/:id/certifications
//
// Backs the "certified" column in the skills table, and the delete confirmation —
// removing a skill strips it from every certification that referenced it, so the
// admin is told how many that is before confirming rather than after.
router.get('/:id/certifications', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Skill not found'));
    }

    // Drafts and expired credentials included — this is the true reference count,
    // which is what matters when warning about a cascade.
    const certifications = await Certification.find({ skillIds: skill._id })
      .sort({ order: 1, issueDate: -1 })
      .select('name issuingOrganization status expiryDate neverExpires');

    res.json(certifications);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch certifications for skill');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch certifications for skill'));
  }
});

export default router;
