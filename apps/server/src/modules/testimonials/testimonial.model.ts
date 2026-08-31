import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

export interface TestimonialAttrs {
  name: string;
  role: string;
  company?: string;
  quote: string;
  avatarUrl?: string;
  order: number;
}

const TestimonialSchema = new Schema<TestimonialAttrs>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    company: String,
    quote: { type: String, required: true },
    avatarUrl: String,
    order: { type: Number, default: 0 },
  },
  withJsonId()
);

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(TestimonialSchema, 'Testimonial');

export const Testimonial = model<TestimonialAttrs>('Testimonial', TestimonialSchema);
export type TestimonialDoc = HydratedDocument<TestimonialAttrs>;
