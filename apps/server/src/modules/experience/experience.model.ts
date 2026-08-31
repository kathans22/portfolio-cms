import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;
type ProjectDomain = (typeof PROJECT_DOMAINS)[number];

export interface ExperienceAttrs {
  company: string;
  role: string;
  domains: ProjectDomain[];
  startDate: Date;
  endDate?: Date | null;
  isCurrent: boolean;
  description: string;
  order: number;
}

const ExperienceSchema = new Schema<ExperienceAttrs>(
  {
    company: { type: String, required: true },
    role: { type: String, required: true },
    domains: { type: [String], enum: PROJECT_DOMAINS, default: [] },
    startDate: { type: Date, required: true },
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    description: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  withJsonId()
);

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(ExperienceSchema, 'Experience');

export const Experience = model<ExperienceAttrs>('Experience', ExperienceSchema);
export type ExperienceDoc = HydratedDocument<ExperienceAttrs>;
