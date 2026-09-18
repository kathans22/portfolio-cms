import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

/**
 * PUBLIC-FACING. Every PDF upload is one of these. Files are never overwritten in
 * place — a new upload is a new document — and exactly one row is `isActive`. The
 * public site reads only that row (see modules/resume/routes.ts); every other row is
 * admin-only history and a rollback target.
 */
export interface ResumeAttrs {
  label?: string;
  fileUrl: string;
  originalName: string;
  provider: 'local' | 'cloudinary';
  storageKey: string; // local filename, or Cloudinary public_id — needed to delete later
  // The Cloudinary resource_type the file landed under ('image' for PDFs, usually).
  // destroy() defaults to 'image' and no-ops on a mismatch, so it is stored, not guessed.
  storageResourceType?: string;
  mimeType?: string;
  fileSize?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSchema = new Schema<ResumeAttrs>(
  {
    label: { type: String, trim: true },
    fileUrl: { type: String, required: true },
    originalName: { type: String, required: true },
    provider: { type: String, enum: ['local', 'cloudinary'], required: true },
    storageKey: { type: String, required: true },
    storageResourceType: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    isActive: { type: Boolean, default: false },
  },
  withJsonId({ timestamps: true })
);

// At most one active resume, enforced at the database level: a race between two
// activate calls can't leave two rows active. Partial, so the many inactive rows are
// simply not in the index and never collide. `activateResume` clears the old active
// row before setting the new one, because this index would otherwise reject the write.
ResumeSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
ResumeSchema.index({ createdAt: -1 });

export const Resume = model<ResumeAttrs>('Resume', ResumeSchema);
export type ResumeDoc = HydratedDocument<ResumeAttrs>;
