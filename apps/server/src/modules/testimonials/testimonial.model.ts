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
  status: 'PENDING' | 'APPROVED';
  /** Visitor-supplied contact, so the owner can verify a claimed identity. Never public. */
  email?: string;
  submittedAt?: Date | null;
}

/**
 * Only these reach the public site. A visitor submission lands as PENDING and stays
 * invisible until the owner approves it.
 *
 * `$ne: 'PENDING'` rather than `eq: 'APPROVED'` on purpose: testimonials created
 * before this field existed have no `status` at all, and a MongoDB equality filter
 * would silently hide every one of them (schema defaults are applied on hydration,
 * not inside the query). This matches both the new APPROVED docs and the old ones.
 */
export const publicTestimonialFilter = { status: { $ne: 'PENDING' } } as const;

/** Field list for public reads — keeps `email` out of every public payload. */
export const PUBLIC_TESTIMONIAL_FIELDS = 'name role company quote avatarUrl order';

const TestimonialSchema = new Schema<TestimonialAttrs>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    company: String,
    quote: { type: String, required: true },
    avatarUrl: String,
    order: { type: Number, default: 0 },
    // Defaults to APPROVED so the admin's own create/update paths behave exactly as
    // before; the public submission route sets PENDING explicitly.
    status: { type: String, enum: ['PENDING', 'APPROVED'], default: 'APPROVED', index: true },
    email: String,
    submittedAt: { type: Date, default: null },
  },
  withJsonId({ timestamps: true })
);

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(TestimonialSchema, 'Testimonial');

export const Testimonial = model<TestimonialAttrs>('Testimonial', TestimonialSchema);
export type TestimonialDoc = HydratedDocument<TestimonialAttrs>;
