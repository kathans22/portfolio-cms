export type ProjectDomain = 'SOFTWARE_DEVELOPMENT' | 'AI_ENGINEERING' | 'DATA_ENGINEERING';
export type ContentStatus = 'DRAFT' | 'PUBLISHED';

export interface Admin {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ProjectImage {
  id: string;
  url: string;
  caption?: string;
  altText?: string;
  order: number;
}

export interface Media {
  id: string;
  url: string;
  originalName: string;
  provider: 'local' | 'cloudinary';
  mimeType?: string;
  size?: number;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  contentBlocks?: unknown[];
  techStack: string[];
  domains: ProjectDomain[];
  role?: string;
  liveUrl?: string;
  repoUrl?: string;
  coverImageUrl?: string;
  gallery: ProjectImage[];
  featured: boolean;
  /** Freelance / client work, as opposed to a personal or employer project. */
  isClientProject?: boolean;
  order: number;
  status: ContentStatus;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// A certification as summarized on a Skill (see Skill.certifications). Derived at
// read time from Certification.skillIds — the relation is never stored on Skill.
export interface SkillCertification {
  id: string;
  name: string;
  issuingOrganization: string;
  issuerLogoUrl?: string;
  credentialUrl?: string;
  issueDate: string;
  expiryDate?: string | null;
  neverExpires: boolean;
  isExpired: boolean;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  domains: ProjectDomain[];
  level: number;
  /** Suppress the self-rated level publicly where a credential speaks for itself. */
  hideLevel: boolean;
  order: number;
  /** Populated by GET /skills; absent/empty for the (common) uncertified case. */
  certifications?: SkillCertification[];
}

// What GET /api/v1/certifications actually returns. Admin-only editorial fields
// (status, showWhenExpired, order) and the renewal signal (expiresSoon) are projected
// out server-side, so they are absent here by design rather than merely unused.
export interface PublicCertification {
  id: string;
  name: string;
  issuingOrganization: string;
  issuerLogoUrl?: string;
  issueDate: string;
  expiryDate?: string | null;
  neverExpires: boolean;
  isExpired: boolean;
  credentialId?: string;
  credentialUrl?: string;
  certificateImageUrl?: string;
  description?: string;
  skillIds: string[];
  domains: ProjectDomain[];
}

/** The full document, as returned by the admin endpoints only. */
export interface Certification {
  id: string;
  name: string;
  issuingOrganization: string;
  issuerLogoUrl?: string;
  issueDate: string;
  expiryDate?: string | null;
  neverExpires: boolean;
  credentialId?: string;
  credentialUrl?: string;
  certificateImageUrl?: string;
  description?: string;
  skillIds: string[];
  domains: ProjectDomain[];
  featured: boolean;
  /** Keeps a lapsed credential publicly visible (still labelled expired). */
  showWhenExpired: boolean;
  order: number;
  status: ContentStatus;
  /** Virtuals — derived on read, never stored, so they cannot go stale. */
  isExpired: boolean;
  expiresSoon: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  domains: ProjectDomain[];
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description: string;
  order: number;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  startDate: string;
  endDate?: string;
  description?: string;
  order: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentBlocks?: unknown[];
  coverImageUrl?: string;
  tags: string[];
  domains: ProjectDomain[];
  status: ContentStatus;
  publishedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company?: string;
  quote: string;
  avatarUrl?: string;
  order: number;
  /** Visitor submissions land PENDING and are invisible until approved in admin. */
  status?: 'PENDING' | 'APPROVED';
  /** Admin-only. Public endpoints never project this field. */
  email?: string;
  submittedAt?: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PageView {
  id: string;
  path: string;
  referrer?: string;
  createdAt: string;
  updatedAt: string;
}

// Resume management. Every PDF upload is its own document; exactly one is active at a
// time and the public site links to whichever that is. Old versions stay in storage and
// stay listed in admin, but are never reachable publicly.
export interface Resume {
  id: string;
  label?: string;
  fileUrl: string;
  originalName: string;
  provider: 'local' | 'cloudinary' | 'drive';
  fileSize?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// What GET /api/v1/resume returns — only ever the active version, and only the fields
// the public site needs. Storage keys and inactive versions never cross this boundary.
export interface PublicResume {
  fileUrl: string;
  // Set for a Google Drive resume: an <iframe>-embeddable address. Uploaded PDFs are
  // embedded from /resume/file instead.
  embedUrl?: string;
  label?: string;
  originalName: string;
  updatedAt: string;
}

// Route-driven CMS

export interface StyleOptions {
  background: 'none' | 'subtle' | 'accent' | 'inverted';
  paddingY: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  maxWidth: 'narrow' | 'default' | 'wide' | 'full';
  columns: number;
  alignment: 'left' | 'center';
  dividerAbove: boolean;
}

/** Authored in the admin query builder; executed server-side by the resolver. */
export interface SectionQuery {
  domains: string[];
  tags: string[];
  skillIds: string[];
  featuredOnly: boolean;
  /** 0 means unlimited. */
  limit: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  includeExpired: boolean;
}

export interface PageSection {
  _id?: string;
  type: string;
  heading?: string;
  subheading?: string;
  anchorId?: string;
  isVisible: boolean;
  order: number;
  layoutVariant: string;
  styleOptions: StyleOptions;
  /** Only meaningful for collection sections; ignored for the other kinds. */
  query?: SectionQuery;
  contentBlocks?: unknown[];
  cta?: { label?: string; href?: string; variant: 'primary' | 'secondary' | 'ghost' };
  /** Populated by the resolver for collection and child-page sections. */
  items?: unknown[];
  /** Set when the stored type is no longer in the section registry. */
  unknownType?: boolean;
}

export interface Page {
  id: string;
  slug: string;
  /** Materialized full path, e.g. "/projects/case-studies". */
  path: string;
  parentId: string | null;
  depth: number;
  previousPaths: string[];
  title: string;
  navLabel?: string;
  sections: PageSection[];
  showInNav: boolean;
  navOrder: number;
  status: ContentStatus;
  isSystem: boolean;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  noIndex: boolean;
  /** Null until first published. Distinct from updatedAt, so pending edits are visible. */
  lastPublishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Exactly one of these comes back from GET /api/v1/resolve — the single server-side
// owner of what a URL means.
export type ResolveResult =
  | { kind: 'PAGE'; data: Page }
  | { kind: 'PROJECT'; data: Project }
  | { kind: 'BLOG_POST'; data: BlogPost }
  | { kind: 'REDIRECT'; to: string; status: 301 }
  | { kind: 'NOT_FOUND' };

// API Payloads
export interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; name: string };
}

export interface AnalyticsSummary {
  totalPageViews: number;
  topPages: { path: string; count: number }[];
  viewsOverTime: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  submissionsCount: number;
  unreadSubmissionsCount: number;
}

// Returned by list endpoints when the request includes ?page=&limit= — omitting both
// params keeps the plain array response these endpoints have always returned.
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
