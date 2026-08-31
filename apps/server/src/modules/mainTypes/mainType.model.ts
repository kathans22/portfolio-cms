import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

/**
 * ADMIN-ONLY. Top level of a private reference taxonomy (Main Type -> Sub Type ->
 * Resource) used for bookmarking, never for portfolio content.
 *
 * Deliberately NOT registered in SECTION_TYPES, and deliberately separate from the
 * portfolio's public taxonomy. The two look alike but serve opposite audiences, and
 * merging them is precisely how private rows end up rendered on a public page. There is
 * no resolve-cache hook here either — nothing public can depend on this.
 */
export interface MainTypeAttrs {
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  /** Soft delete. Non-null means hidden from every read path but recoverable. */
  deletedAt?: Date | null;
}

const MainTypeSchema = new Schema<MainTypeAttrs>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    deletedAt: { type: Date, default: null },
  },
  withJsonId({ timestamps: true })
);

// Unique among non-deleted records only. A plain unique index would mean soft-deleting
// "Jobs" permanently reserved that name: the row still exists, so the index still
// enforces against it.
//
// Case-insensitive uniqueness is handled in the service by normalizing before the check,
// NOT by an index collation — doing both would mean every query that relies on the index
// has to carry a matching collation, which is easy to forget and silently degrades to a
// collection scan when omitted.
MainTypeSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
MainTypeSchema.index({ deletedAt: 1, status: 1 });

export const MainType = model<MainTypeAttrs>('MainType', MainTypeSchema);
export type MainTypeDoc = HydratedDocument<MainTypeAttrs>;
