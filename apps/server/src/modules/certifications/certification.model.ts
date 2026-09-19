import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { normalizeImageUrl } from '@portfolio/shared';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

// Turns a pasted Drive share link into a direct image address on every write path.
const driveImage = (v?: string) => (typeof v === 'string' ? normalizeImageUrl(v.trim()) : v);

const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;
type ProjectDomain = (typeof PROJECT_DOMAINS)[number];

export interface CertificationAttrs {
  name: string;
  issuingOrganization: string;
  issuerLogoUrl?: string;

  issueDate: Date;
  expiryDate?: Date | null;
  neverExpires: boolean;

  credentialId?: string;
  credentialUrl?: string;
  certificateImageUrl?: string;

  description?: string;

  // THE MAPPING — real Skill references, never free text. Free-text skill names
  // ("Node.js" vs "NodeJS" vs "Node") match zero Skill documents, which would make
  // every skill-to-credential lookup silently return nothing.
  skillIds: Types.ObjectId[];

  domains: ProjectDomain[];

  featured: boolean;
  showWhenExpired: boolean;
  order: number;
  status: 'DRAFT' | 'PUBLISHED';
}

// Derived on read, never stored — an `isExpired` column would be wrong the day it
// expires and stay wrong until something happened to rewrite it. Declared on the
// document type rather than as a Schema generic, because the generic form doesn't
// compose with the shared withJsonId() options helper.
export interface CertificationVirtuals {
  isExpired: boolean;
  expiresSoon: boolean;
}

const EXPIRES_SOON_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const CertificationSchema = new Schema<CertificationAttrs>(
  {
    name: { type: String, required: true, trim: true },
    issuingOrganization: { type: String, required: true, trim: true },
    issuerLogoUrl: { type: String, set: driveImage },

    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null },
    neverExpires: { type: Boolean, default: false },

    credentialId: String,
    credentialUrl: String, // public verification link
    certificateImageUrl: { type: String, set: driveImage }, // badge or certificate scan

    description: String, // what the credential actually covers

    skillIds: [{ type: Schema.Types.ObjectId, ref: 'Skill', index: true }],

    domains: { type: [String], enum: PROJECT_DOMAINS, default: [] },

    featured: { type: Boolean, default: false },
    showWhenExpired: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'PUBLISHED' },
  },
  // withJsonId already sets toJSON.virtuals — needed for isExpired/expiresSoon to
  // serialize — and maps _id to id so this matches every other entity's contract.
  withJsonId({ timestamps: true, toObject: { virtuals: true } })
);

CertificationSchema.virtual('isExpired').get(function (this: CertificationAttrs) {
  if (this.neverExpires || !this.expiryDate) return false;
  return this.expiryDate.getTime() < Date.now();
});

CertificationSchema.virtual('expiresSoon').get(function (this: CertificationAttrs) {
  if (this.neverExpires || !this.expiryDate) return false;
  const delta = this.expiryDate.getTime() - Date.now();
  return delta > 0 && delta < EXPIRES_SOON_WINDOW_MS;
});

CertificationSchema.index({ status: 1, order: 1 });
CertificationSchema.index({ domains: 1 });

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(CertificationSchema, 'Certification');

export const Certification = model<CertificationAttrs>('Certification', CertificationSchema);
export type CertificationDoc = HydratedDocument<CertificationAttrs, CertificationVirtuals>;

// A credential is publicly visible when it is published AND either still valid or
// explicitly opted back in via showWhenExpired. Expressed as a query filter rather
// than a post-fetch check so expiry is applied in the database — including inside
// the $lookup that derives skill badges.
export function publicCertificationFilter(includeExpired = false): Record<string, unknown> {
  if (includeExpired) return { status: 'PUBLISHED' };
  return {
    status: 'PUBLISHED',
    $or: [
      { neverExpires: true },
      { expiryDate: null },
      { expiryDate: { $gte: new Date() } },
      { showWhenExpired: true },
    ],
  };
}
