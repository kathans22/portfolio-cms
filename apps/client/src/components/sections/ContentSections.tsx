import React from 'react';
import type { ContentBlock } from '@portfolio/shared';
import { BlockRenderer } from '../public/BlockRenderer';
import { SectionShell, SectionHeader, SectionCta } from './shared';
import { sectionStyles } from './sectionStyles';
import type { SectionProps } from './types';
import { CircleCheck } from 'lucide-react';

export function HeroSection(props: SectionProps) {
  const centered = props.layoutVariant === 'centered' || props.layoutVariant === 'minimal';
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <div className={centered ? 'text-center max-w-3xl mx-auto' : ''}>
        {props.heading && (
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
            {props.heading}
          </h1>
        )}
        {props.subheading && (
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            {props.subheading}
          </p>
        )}
        {props.layoutVariant !== 'minimal' && props.contentBlocks.length > 0 && (
          <BlockRenderer blocks={props.contentBlocks as ContentBlock[]} />
        )}
        <SectionCta cta={props.cta} />
      </div>
    </SectionShell>
  );
}

export function RichContentSection(props: SectionProps) {
  const columns = props.layoutVariant === 'two-column' ? 'md:columns-2 md:gap-10' : '';
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <div className={`prose-content ${columns}`}>
        <BlockRenderer blocks={props.contentBlocks as ContentBlock[]} />
      </div>
      <SectionCta cta={props.cta} />
    </SectionShell>
  );
}

interface Stat {
  label?: string;
  value?: string;
}

export function StatsStripSection(props: SectionProps) {
  const styles = sectionStyles(props.styleOptions);
  // Stats are authored as callout blocks: title = value, body = label.
  const stats: Stat[] = (props.contentBlocks as { type?: string; title?: string; body?: string }[])
    .filter((block) => block?.type === 'callout')
    .map((block) => ({ value: block.title, label: block.body }));

  if (stats.length === 0) return null;

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <dl className={styles.grid}>
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`text-center ${
              props.layoutVariant === 'bordered'
                ? 'border border-slate-200 dark:border-slate-800 rounded-xl p-6'
                : ''
            }`}
          >
            <dt className="text-3xl font-extrabold text-slate-900 dark:text-white">{stat.value}</dt>
            <dd className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}

export function CtaBannerSection(props: SectionProps) {
  const boxed = props.layoutVariant === 'boxed';
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <div
        className={
          boxed
            ? 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-10 text-center'
            : props.layoutVariant === 'inline'
              ? 'flex flex-wrap items-center justify-between gap-6'
              : 'text-center'
        }
      >
        <div>
          {props.heading && (
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{props.heading}</h2>
          )}
          {props.subheading && <p className="text-slate-500 dark:text-slate-400 mt-2">{props.subheading}</p>}
        </div>
        <div className={props.layoutVariant === 'inline' ? '' : 'mt-6'}>
          <SectionCta cta={props.cta} />
        </div>
      </div>
    </SectionShell>
  );
}

export function AvailabilityBannerSection(props: SectionProps) {
  // Recruiters look for two things first: are you available, and where's the CV.
  const compact = props.layoutVariant === 'compact';
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <div
        className={`flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 ${
          compact ? 'px-4 py-3' : 'px-6 py-5'
        }`}
      >
        <CircleCheck className="text-emerald-500 shrink-0" size={compact ? 18 : 22} aria-hidden="true" />
        <div className="min-w-0 flex-grow">
          {props.heading && (
            <p className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-sm' : 'text-base'}`}>
              {props.heading}
            </p>
          )}
          {props.subheading && (
            <p className="text-sm text-slate-600 dark:text-slate-400">{props.subheading}</p>
          )}
        </div>
        <SectionCta cta={props.cta} />
      </div>
    </SectionShell>
  );
}
