import { logger } from '../../utils/logger';
import { Page, SOFT_DELETE_RETENTION_DAYS } from './page.model';

/**
 * Hard-deletes pages whose restore window has elapsed. Idempotent and safe to call
 * repeatedly, so it can be driven by a scheduler, a cron endpoint, or startup.
 */
export async function purgeExpiredDeletedPages(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SOFT_DELETE_RETENTION_DAYS * 86400000);
  const result = await Page.deleteMany({ deletedAt: { $ne: null, $lt: cutoff } });

  if (result.deletedCount > 0) {
    logger.info({ count: result.deletedCount, cutoff }, 'Purged soft-deleted pages past their restore window');
  }
  return result.deletedCount ?? 0;
}
