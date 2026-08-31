import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { PageView } from './pageView.model';
import { ContactMessage } from '../messages/contactMessage.model';

const router = Router();

// Public: POST /api/v1/analytics (Log a page view)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { path, referrer } = req.body;
    if (!path) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'Path is required'));
    }

    await PageView.create({ path, referrer: referrer || req.headers.referer });

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error logging analytics');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to log analytics'));
  }
});

// Admin: GET /api/v1/analytics/summary (page views over time, top pages, referrers)
router.get('/summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const totalPageViews = await PageView.countDocuments();

    const topPathsAgg = await PageView.aggregate([
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const topPages = topPathsAgg.map((row) => ({ path: row._id as string, count: row.count as number }));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const viewsOverTimeAgg = await PageView.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const viewsOverTime = viewsOverTimeAgg.map((row) => ({ date: row._id as string, count: row.count as number }));

    const topReferrersAgg = await PageView.aggregate([
      { $match: { referrer: { $nin: [null, ''] } } },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const topReferrers = topReferrersAgg.map((row) => ({ referrer: row._id as string, count: row.count as number }));

    const submissionsCount = await ContactMessage.countDocuments();
    const unreadSubmissionsCount = await ContactMessage.countDocuments({ isRead: false });

    res.json({
      totalPageViews,
      topPages,
      viewsOverTime,
      topReferrers,
      submissionsCount,
      unreadSubmissionsCount,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching analytics summary');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch analytics summary'));
  }
});

export default router;
