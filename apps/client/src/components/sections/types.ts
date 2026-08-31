import type { PageSection } from '@portfolio/types';

/**
 * Every section component receives exactly this and nothing else.
 *
 * Sections are purely presentational: no useQuery, no fetch, no data loading of any
 * kind. The resolver already expanded `items` server-side so a page view costs one
 * round trip. A section that fetches its own data reintroduces the request waterfall
 * the resolver exists to remove — and it grows with page complexity.
 */
export interface SectionProps {
  heading?: string;
  subheading?: string;
  layoutVariant: string;
  styleOptions: PageSection['styleOptions'];
  items: unknown[];
  contentBlocks: unknown[];
  cta?: PageSection['cta'];
  anchorId?: string;
}
