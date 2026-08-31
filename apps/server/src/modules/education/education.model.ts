import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

export interface EducationAttrs {
  institution: string;
  degree: string;
  startDate: Date;
  endDate?: Date | null;
  description?: string;
  order: number;
}

const EducationSchema = new Schema<EducationAttrs>(
  {
    institution: { type: String, required: true },
    degree: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: Date,
    description: String,
    order: { type: Number, default: 0 },
  },
  withJsonId()
);

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(EducationSchema, 'Education');

export const Education = model<EducationAttrs>('Education', EducationSchema);
export type EducationDoc = HydratedDocument<EducationAttrs>;
