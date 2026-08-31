import { Router, Request, Response } from 'express';
import { validateRequest } from '../../middleware/validateRequest';
import { contactRateLimiter } from '../../middleware/rateLimiter';
import { contactSchema } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { sendContactNotification } from '../../services/email';
import { ContactMessage } from './contactMessage.model';

const router = Router();

// Public: POST /api/v1/contact
router.post('/', contactRateLimiter, validateRequest(contactSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot tripped — pretend success so the bot doesn't learn anything, but don't persist.
    if (website) {
      return res.status(201).json({ success: true, submissionId: null });
    }

    const submission = await ContactMessage.create({ name, email, subject, message });

    sendContactNotification({ name, email, subject, message }).catch((err) => {
      logger.error({ err }, 'Async contact notification failed');
    });

    res.status(201).json({ success: true, submissionId: submission.id });
  } catch (error) {
    logger.error({ err: error }, 'Error saving contact message');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to submit contact form'));
  }
});

export default router;
