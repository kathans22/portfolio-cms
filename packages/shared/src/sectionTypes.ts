// Single source of truth for section types. The admin picker, the API's validation,
// and the frontend component registry all read from this object — adding a section
// type here is the only edit needed to make it selectable, validated, and renderable.
export const SECTION_TYPES = {
  HERO:                { label: 'Hero',             kind: 'content',    variants: ['default', 'split', 'minimal', 'centered'] },
  RICH_CONTENT:        { label: 'Rich Content',     kind: 'content',    variants: ['default', 'prose', 'two-column'] },
  STATS_STRIP:         { label: 'Stats Strip',      kind: 'content',    variants: ['default', 'bordered'] },
  CTA_BANNER:          { label: 'Call to Action',   kind: 'content',    variants: ['default', 'boxed', 'inline'] },
  AVAILABILITY_BANNER: { label: 'Availability',     kind: 'content',    variants: ['default', 'compact'] },

  // `filtered` and `grouped` add client-side controls over the items the resolver has
  // already returned — no extra request, so the one-request-per-page rule still holds.
  // Added as variants rather than as new section types, per the boundary note in the
  // README: reach for a wider variant before a new type.
  PROJECT_LIST:        { label: 'Projects',         kind: 'collection', collection: 'Project',       variants: ['grid', 'list', 'featured', 'compact', 'filtered'] },
  CERTIFICATION_LIST:  { label: 'Certifications',   kind: 'collection', collection: 'Certification', variants: ['grid', 'list', 'compact', 'logos', 'grouped'] },
  SKILL_LIST:          { label: 'Skills',           kind: 'collection', collection: 'Skill',         variants: ['grouped', 'chips', 'bars'] },
  EXPERIENCE_TIMELINE: { label: 'Experience',       kind: 'collection', collection: 'Experience',    variants: ['timeline', 'list'] },
  EDUCATION_TIMELINE:  { label: 'Education',        kind: 'collection', collection: 'Education',     variants: ['timeline', 'list'] },
  TESTIMONIAL_LIST:    { label: 'Testimonials',     kind: 'collection', collection: 'Testimonial',   variants: ['grid', 'carousel', 'single'] },
  BLOG_LIST:           { label: 'Blog Posts',       kind: 'collection', collection: 'BlogPost',      variants: ['grid', 'list', 'compact'] },

  CONTACT_FORM:        { label: 'Contact Form',     kind: 'widget',     variants: ['default', 'split'] },
  RESUME_DOWNLOAD:     { label: 'Resume Download',  kind: 'widget',     variants: ['default', 'inline'] },
  // Renders links to this page's published children, so a parent route like
  // /case-studies is useful in its own right rather than an empty shell above its
  // sub-pages.
  CHILD_PAGE_LIST:     { label: 'Sub-page Links',   kind: 'system',     variants: ['cards', 'list'] },
} as const;

export type SectionType = keyof typeof SECTION_TYPES;
export type SectionKind = (typeof SECTION_TYPES)[SectionType]['kind'];

export const SECTION_TYPE_KEYS = Object.keys(SECTION_TYPES) as [SectionType, ...SectionType[]];

export function isSectionType(value: string): value is SectionType {
  return value in SECTION_TYPES;
}

/** Sections whose content comes from a queried collection rather than authored blocks. */
export function isCollectionSection(type: SectionType): boolean {
  return SECTION_TYPES[type].kind === 'collection';
}

export function sectionVariants(type: SectionType): readonly string[] {
  return SECTION_TYPES[type].variants;
}

/** The Mongoose model name a collection section reads from; undefined for other kinds. */
export function sectionCollection(type: SectionType): string | undefined {
  const meta = SECTION_TYPES[type] as { collection?: string };
  return meta.collection;
}
