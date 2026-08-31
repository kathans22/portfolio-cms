import React from 'react';
import { Link } from 'react-router-dom';
import type { SectionProps } from './types';
import { sectionStyles } from './sectionStyles';

/** Heading + subheading, rendered only when authored. */
export function SectionHeader({ heading, subheading }: Pick<SectionProps, 'heading' | 'subheading'>) {
  if (!heading && !subheading) return null;
  return (
    <header className="mb-8">
      {heading && <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{heading}</h2>}
      {subheading && <p className="text-slate-500 dark:text-slate-400 mt-2">{subheading}</p>}
    </header>
  );
}

const CTA_VARIANTS = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  secondary: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white',
  ghost: 'text-indigo-600 dark:text-indigo-400 hover:underline px-0',
} as const;

export function SectionCta({ cta }: Pick<SectionProps, 'cta'>) {
  if (!cta?.label || !cta.href) return null;

  const className = `inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
    CTA_VARIANTS[cta.variant ?? 'primary']
  }`;

  // Internal links go through the router; external ones leave safely.
  return cta.href.startsWith('/') ? (
    <Link to={cta.href} className={className}>{cta.label}</Link>
  ) : (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className}>{cta.label}</a>
  );
}

/** The wrapper every section shares: anchor target, background, width, alignment. */
export function SectionShell({
  anchorId,
  styleOptions,
  children,
}: Pick<SectionProps, 'anchorId' | 'styleOptions'> & { children: React.ReactNode }) {
  const styles = sectionStyles(styleOptions);
  return (
    <section id={anchorId || undefined} className={`${styles.section} scroll-mt-24`}>
      <div className={styles.container}>{children}</div>
    </section>
  );
}
