import { normalizeImageUrl } from '@portfolio/shared';
import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

// Turns a pasted Drive share link into a direct image address on every write path.
const driveImage = (v?: string) => (typeof v === 'string' ? normalizeImageUrl(v.trim()) : v);

const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;
type ProjectDomain = (typeof PROJECT_DOMAINS)[number];

export interface BlogPostAttrs {
  title: string;
  slug: string;
  excerpt: string;
  content: string; // markdown fallback, rendered when contentBlocks is empty
  contentBlocks: unknown[]; // validated via Zod at the API layer — same block union as Project
  coverImageUrl?: string;
  tags: string[];
  domains: ProjectDomain[];
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt?: Date | null;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<BlogPostAttrs>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    contentBlocks: { type: Schema.Types.Mixed, default: [] },
    coverImageUrl: { type: String, set: driveImage },
    tags: { type: [String], default: [] },
    domains: { type: [String], enum: PROJECT_DOMAINS, default: [] },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' },
    publishedAt: Date,
    metaTitle: String,
    metaDescription: String,
    ogImageUrl: { type: String, set: driveImage },
  },
  withJsonId({ timestamps: true })
);

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(BlogPostSchema, 'BlogPost');

export const BlogPost = model<BlogPostAttrs>('BlogPost', BlogPostSchema);
export type BlogPostDoc = HydratedDocument<BlogPostAttrs>;
