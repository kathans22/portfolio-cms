import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;

/** Hard cap: /a/b/c is the deepest useful URL on a portfolio. */
export const MAX_PAGE_DEPTH = 2;

export interface StyleOptions {
  background: 'none' | 'subtle' | 'accent' | 'inverted';
  paddingY: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  maxWidth: 'narrow' | 'default' | 'wide' | 'full';
  columns: number;
  alignment: 'left' | 'center';
  dividerAbove: boolean;
}

export interface SectionQuery {
  domains: string[];
  tags: string[];
  skillIds: Types.ObjectId[];
  featuredOnly: boolean;
  limit: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  includeExpired: boolean;
}

export interface SectionAttrs {
  type: string;
  heading?: string;
  subheading?: string;
  anchorId?: string;
  isVisible: boolean;
  order: number;
  layoutVariant: string;
  styleOptions: StyleOptions;
  query: SectionQuery;
  contentBlocks: unknown[];
  cta?: { label?: string; href?: string; variant: 'primary' | 'secondary' | 'ghost' };
}

export interface PageAttrs {
  slug: string;
  path: string;
  parentId: Types.ObjectId | null;
  depth: number;
  previousPaths: string[];
  title: string;
  navLabel?: string;
  sections: SectionAttrs[];
  showInNav: boolean;
  navOrder: number;
  status: 'DRAFT' | 'PUBLISHED';
  isSystem: boolean;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  noIndex: boolean;
  /** Soft delete. Non-null means removed from every read path but restorable. */
  deletedAt?: Date | null;
  /** Distinct from updatedAt, so pending unpublished edits are visible at a glance. */
  lastPublishedAt?: Date | null;
}

/** How long a soft-deleted page stays restorable before the cleanup routine reaps it. */
export const SOFT_DELETE_RETENTION_DAYS = 30;

/** previousPaths is a redirect table, not an audit log — keep only recent renames. */
export const MAX_PREVIOUS_PATHS = 10;

const StyleOptionsSchema = new Schema<StyleOptions>(
  {
    background: { type: String, enum: ['none', 'subtle', 'accent', 'inverted'], default: 'none' },
    paddingY: { type: String, enum: ['none', 'sm', 'md', 'lg', 'xl'], default: 'lg' },
    maxWidth: { type: String, enum: ['narrow', 'default', 'wide', 'full'], default: 'default' },
    columns: { type: Number, min: 1, max: 4, default: 3 },
    alignment: { type: String, enum: ['left', 'center'], default: 'left' },
    dividerAbove: { type: Boolean, default: false },
  },
  { _id: false }
);

const SectionSchema = new Schema<SectionAttrs>(
  {
    // Validated against SECTION_TYPES by the Zod layer rather than a Mongoose enum,
    // so the registry stays the single source of truth.
    type: { type: String, required: true },
    heading: String,
    subheading: String,
    anchorId: String,
    isVisible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },

    layoutVariant: { type: String, default: 'default' },
    styleOptions: { type: StyleOptionsSchema, default: () => ({}) },

    // Collection sections: what to query.
    query: {
      domains: { type: [String], enum: PROJECT_DOMAINS, default: [] },
      tags: { type: [String], default: [] },
      skillIds: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
      featuredOnly: { type: Boolean, default: false },
      limit: { type: Number, default: 0 }, // 0 = unlimited
      sortBy: { type: String, default: 'order' },
      sortDir: { type: String, enum: ['asc', 'desc'], default: 'asc' },
      includeExpired: { type: Boolean, default: false },
    },

    // Content sections: the block union from the content-blocks schema.
    contentBlocks: { type: Schema.Types.Mixed, default: [] },

    cta: {
      label: String,
      href: String,
      variant: { type: String, enum: ['primary', 'secondary', 'ghost'], default: 'primary' },
    },
  },
  { _id: true }
);

const PageSchema = new Schema<PageAttrs>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    // Materialized path. Resolution is then a single indexed exact-match instead of
    // walking the parent chain on every request; the cost is recomputing it whenever a
    // slug or parent changes. Reads vastly outnumber writes here.
    //
    // Uniqueness is declared below as a *partial* index rather than here, because a
    // soft-deleted page keeps its path and must not block a replacement at the same URL.
    path: { type: String, required: true, lowercase: true },

    // Not indexed here: the compound { parentId, navOrder } below already serves a
    // parentId-only lookup from its prefix, and a second index would cost write
    // throughput on every page save for nothing.
    parentId: { type: Schema.Types.ObjectId, ref: 'Page', default: null },
    depth: { type: Number, default: 0, max: MAX_PAGE_DEPTH },

    // Powers 301s after a rename, so shared links never rot.
    previousPaths: { type: [String], default: [], index: true },

    title: { type: String, required: true },
    navLabel: String,

    sections: { type: [SectionSchema], default: [] },

    showInNav: { type: Boolean, default: true },
    navOrder: { type: Number, default: 0 },

    status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' },
    isSystem: { type: Boolean, default: false },

    metaTitle: String,
    metaDescription: String,
    ogImageUrl: String,
    noIndex: { type: Boolean, default: false },

    // Content deletion is the one destructive action an admin regrets, and recovery is
    // cheap to provide — so removal is reversible for a window rather than immediate.
    deletedAt: { type: Date, default: null, index: true },

    // updatedAt moves on every save; this only moves on a publish. The gap between
    // them is what tells an admin they have unpublished changes.
    lastPublishedAt: { type: Date, default: null },
  },
  withJsonId({ timestamps: true })
);

// Every read path the resolver takes is covered here, so a page view never scans:
//
//   path              — the resolver's step 1, an exact match on every page view.
//                       Unique only among live pages: a soft-deleted page keeps its path,
//                       so two rows can legitimately share one until it is reaped.
//   previousPaths     — the resolver's step 2 (declared on the field, multikey).
//   status/showInNav  — GET /nav and the sitemap.
//   parentId/navOrder — CHILD_PAGE_LIST sections and the admin tree.
PageSchema.index({ path: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
PageSchema.index({ status: 1, showInNav: 1, navOrder: 1 });
PageSchema.index({ parentId: 1, navOrder: 1 });

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(PageSchema, 'Page');

export const Page = model<PageAttrs>('Page', PageSchema);
export type PageDoc = HydratedDocument<PageAttrs>;
