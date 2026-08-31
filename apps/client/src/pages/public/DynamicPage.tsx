import React from 'react';
import { Helmet } from 'react-helmet-async';
import { isSectionType, SectionType } from '@portfolio/shared';
import type { Page, PageSection } from '@portfolio/types';
import { sectionRegistry } from '../../components/sections/registry';
import { Breadcrumbs, Crumb } from '../../components/public/Breadcrumbs';
import { FileQuestion } from 'lucide-react';

const SITE_NAME = 'Kathan — Portfolio';
const DEFAULT_DESCRIPTION =
  'Full-stack engineer and solutions architect building production-grade web, AI, and data platforms.';
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

interface DynamicPageProps {
  page: Page & { ancestors?: Crumb[] };
}

export default function DynamicPage({ page }: DynamicPageProps) {
  const ancestors = page.ancestors ?? [];
  const title = page.metaTitle || page.title;
  const description = page.metaDescription || DEFAULT_DESCRIPTION;
  // previousPaths means several URLs can reach this content, so the canonical has to be
  // the page's current path rather than whatever URL the visitor arrived on.
  const canonical = `${SITE_URL}${page.path}`;

  const visible = page.sections ?? [];

  return (
    <div className="min-h-screen text-slate-700 dark:text-slate-100 pt-24 pb-16">
      <Helmet>
        <title>{title === SITE_NAME ? title : `${title} · ${SITE_NAME}`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        {page.noIndex && <meta name="robots" content="noindex" />}

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        {page.ogImageUrl && <meta property="og:image" content={page.ogImageUrl} />}

        {ancestors.length > 0 && (
          <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd(ancestors, page, canonical))}</script>
        )}
      </Helmet>

      {ancestors.length > 0 && (
        <div className="max-w-5xl mx-auto px-6">
          <Breadcrumbs ancestors={ancestors} current={page.navLabel || page.title} />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyPage title={page.title} />
      ) : (
        visible.map((section, index) => <SectionSlot key={section._id ?? index} section={section} />)
      )}
    </div>
  );
}

function SectionSlot({ section }: { section: PageSection }) {
  // The database can be ahead of the deployed frontend. One unrecognised section must
  // never blank the page, so it is skipped — silently in production, loudly in dev.
  if (!isSectionType(section.type)) {
    if (import.meta.env.DEV) {
      console.warn(`[sections] Unknown section type "${section.type}" — skipping. Is the frontend behind the API?`);
    }
    return null;
  }

  const Component = sectionRegistry[section.type as SectionType];
  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`[sections] No component registered for "${section.type}" — skipping.`);
    }
    return null;
  }

  return (
    <Component
      heading={section.heading}
      subheading={section.subheading}
      anchorId={section.anchorId}
      layoutVariant={section.layoutVariant}
      styleOptions={section.styleOptions}
      items={section.items ?? []}
      contentBlocks={section.contentBlocks ?? []}
      cta={section.cta}
    />
  );
}

/** A published page with nothing visible is deliberate, not a blank screen. */
function EmptyPage({ title }: { title: string }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <FileQuestion className="mx-auto mb-4 text-slate-400" size={40} aria-hidden="true" />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400">
        This page doesn&apos;t have any content yet.
      </p>
    </div>
  );
}

function breadcrumbJsonLd(ancestors: Crumb[], page: Page, canonical: string) {
  const trail = [
    { name: 'Home', item: SITE_URL || '/' },
    ...ancestors.map((a) => ({ name: a.navLabel || a.title, item: `${SITE_URL}${a.path}` })),
    { name: page.navLabel || page.title, item: canonical },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}
