import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

/**
 * ADMIN-ONLY. A private bookmark. Has no slug, no public URL and no detail page — the
 * resolver never returns a RESOURCE kind, and nothing here reaches sitemap.xml.
 */
export interface ResourceAttrs {
  /**
   * Denormalized from `subType.mainTypeId` (module Section 0.1). Kept because listing and
   * filtering by main type is the primary use case and would otherwise need a $lookup on
   * every query. It can drift, so it is never trusted from the client: every create and
   * update re-loads the sub type and verifies the pair via assertTypePairIsConsistent.
   */
  mainTypeId: Types.ObjectId;
  subTypeId: Types.ObjectId;
  link: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  deletedAt?: Date | null;
}

const ResourceSchema = new Schema<ResourceAttrs>(
  {
    mainTypeId: { type: Schema.Types.ObjectId, ref: 'MainType', required: true, index: true },
    subTypeId: { type: Schema.Types.ObjectId, ref: 'SubType', required: true, index: true },
    link: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    deletedAt: { type: Date, default: null },
  },
  withJsonId({ timestamps: true })
);

// The same link filed under a different main type + sub type is legitimate — one page can
// be both a Postgres reference and a performance reference. Filing it twice in the same
// place is the accident worth blocking.
ResourceSchema.index(
  { mainTypeId: 1, subTypeId: 1, link: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
ResourceSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });

export const Resource = model<ResourceAttrs>('Resource', ResourceSchema);
export type ResourceDoc = HydratedDocument<ResourceAttrs>;
