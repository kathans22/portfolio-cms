import type { PublicResume } from '@portfolio/types';
import { drivePreviewUrl } from '@portfolio/shared';
import { Resume, ResumeDoc } from './resume.model';

/**
 * Makes one resume the active one, clearing whichever row was active before.
 *
 * The order matters: the partial unique index on `{ isActive: true }` rejects a second
 * active row, so the previous active row is unset first. There is a sub-millisecond
 * window with zero active rows; that is acceptable for a single-admin tool on a
 * non-transactional free-tier database, and far better than the write failing.
 */
export async function activateResume(id: string): Promise<ResumeDoc | null> {
  const target = await Resume.findById(id);
  if (!target) return null;

  await Resume.updateMany(
    { _id: { $ne: target._id }, isActive: true },
    { $set: { isActive: false } }
  );

  if (!target.isActive) {
    target.isActive = true;
    await target.save();
  }
  return target;
}

/** The public projection — only the active row is ever passed here. */
export function toPublicResume(doc: ResumeDoc): PublicResume {
  return {
    fileUrl: doc.fileUrl,
    embedUrl: doc.provider === 'drive' ? drivePreviewUrl(doc.storageKey) : undefined,
    label: doc.label || undefined,
    originalName: doc.originalName,
    updatedAt: doc.updatedAt.toISOString(),
  };
}
