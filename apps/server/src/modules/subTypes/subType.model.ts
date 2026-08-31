import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

/** ADMIN-ONLY. Second level of the private reference taxonomy — see mainType.model.ts. */
export interface SubTypeAttrs {
  mainTypeId: Types.ObjectId;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  deletedAt?: Date | null;
}

const SubTypeSchema = new Schema<SubTypeAttrs>(
  {
    mainTypeId: { type: Schema.Types.ObjectId, ref: 'MainType', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    deletedAt: { type: Date, default: null },
  },
  withJsonId({ timestamps: true })
);

// The same name is allowed under different main types — "Hosting" under Infrastructure
// and "Hosting" under Docs are different things — but must be unique within one.
SubTypeSchema.index({ mainTypeId: 1, name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
SubTypeSchema.index({ mainTypeId: 1, deletedAt: 1, status: 1 });

export const SubType = model<SubTypeAttrs>('SubType', SubTypeSchema);
export type SubTypeDoc = HydratedDocument<SubTypeAttrs>;
