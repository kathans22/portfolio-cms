import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;
const PROJECT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

export type ProjectDomain = (typeof PROJECT_DOMAINS)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectImageAttrs {
  url: string;
  caption?: string;
  altText?: string;
  order: number;
}

export interface ProjectAttrs {
  title: string;
  slug: string;
  summary: string;
  description: string; // markdown fallback
  contentBlocks: unknown[]; // validated via Zod at the API layer
  techStack: string[];
  domains: ProjectDomain[];
  role?: string;
  liveUrl?: string;
  repoUrl?: string;
  coverImageUrl?: string;
  gallery: ProjectImageAttrs[];
  featured: boolean;
  order: number;
  status: ProjectStatus;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectImageSchema = new Schema<ProjectImageAttrs>(
  {
    url: { type: String, required: true },
    caption: String,
    altText: String,
    order: { type: Number, default: 0 },
  },
  withJsonId({ _id: true }) // still gets its own id, useful for reordering/deleting a single gallery image
);

const ProjectSchema = new Schema<ProjectAttrs>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, required: true },
    description: { type: String, required: true },
    contentBlocks: { type: Schema.Types.Mixed, default: [] },
    techStack: { type: [String], default: [] },
    domains: { type: [String], enum: PROJECT_DOMAINS, default: [] },
    role: String,
    liveUrl: String,
    repoUrl: String,
    coverImageUrl: String,
    gallery: { type: [ProjectImageSchema], default: [] },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: { type: String, enum: PROJECT_STATUSES, default: 'PUBLISHED' },
    metaTitle: String,
    metaDescription: String,
    ogImageUrl: String,
  },
  withJsonId({ timestamps: true })
);

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(ProjectSchema, 'Project');

export const Project = model<ProjectAttrs>('Project', ProjectSchema);
export type ProjectDoc = HydratedDocument<ProjectAttrs>;
