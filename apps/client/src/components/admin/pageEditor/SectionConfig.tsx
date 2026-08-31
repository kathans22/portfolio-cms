import React from 'react';
import { SECTION_TYPES, SectionType, isSectionType } from '@portfolio/shared';
import type { ContentBlock } from '@portfolio/shared';
import type { PageSection, StyleOptions, SectionQuery } from '@portfolio/types';
import { ContentBlockEditor } from '../ContentBlockEditor';
import { QueryBuilder } from './QueryBuilder';

const BACKGROUNDS: StyleOptions['background'][] = ['none', 'subtle', 'accent', 'inverted'];
const PADDINGS: StyleOptions['paddingY'][] = ['none', 'sm', 'md', 'lg', 'xl'];
const MAX_WIDTHS: StyleOptions['maxWidth'][] = ['narrow', 'default', 'wide', 'full'];
const CTA_VARIANTS = ['primary', 'secondary', 'ghost'] as const;

interface SectionConfigProps {
  section: PageSection | null;
  onChange: (next: PageSection) => void;
}

export function SectionConfig({ section, onChange }: SectionConfigProps) {
  if (!section) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-xs text-slate-500 text-center">
          Select a section to configure it.
        </p>
      </div>
    );
  }

  if (!isSectionType(section.type)) {
    return (
      <div className="p-4 text-xs text-amber-500">
        <strong className="block mb-1">Unknown section type</strong>
        <code>{section.type}</code> is no longer in the registry. Delete it, or restore the
        type in <code>sectionTypes.ts</code>.
      </div>
    );
  }

  const type = section.type as SectionType;
  const meta = SECTION_TYPES[type];
  const set = <K extends keyof PageSection>(key: K, value: PageSection[K]) => onChange({ ...section, [key]: value });
  const setStyle = <K extends keyof StyleOptions>(key: K, value: StyleOptions[K]) =>
    onChange({ ...section, styleOptions: { ...section.styleOptions, [key]: value } });

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">{meta.label}</h2>
        <p className="text-[10px] text-slate-600 mt-0.5">{meta.kind}</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Heading and subheading apply to every kind — collections need a title too. */}
        <Field label="Heading">
          <input
            type="text"
            value={section.heading ?? ''}
            onChange={(e) => set('heading', e.target.value)}
            className="input-field"
            placeholder="Optional"
          />
        </Field>

        <Field label="Subheading">
          <input
            type="text"
            value={section.subheading ?? ''}
            onChange={(e) => set('subheading', e.target.value)}
            className="input-field"
            placeholder="Optional"
          />
        </Field>

        {meta.kind === 'content' && (
          <Field label="Content">
            <ContentBlockEditor
              value={(section.contentBlocks ?? []) as ContentBlock[]}
              onChange={(blocks) => set('contentBlocks', blocks)}
            />
          </Field>
        )}

        {meta.kind === 'collection' && (
          <QueryBuilder
            type={type}
            value={normalizeQuery(section.query)}
            onChange={(query) => set('query', query)}
          />
        )}

        {(meta.kind === 'widget' || meta.kind === 'system') && (
          <p className="text-[11px] text-slate-500 leading-relaxed rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2.5">
            {type === 'CONTACT_FORM' && 'Submissions go to the Messages inbox. No extra configuration needed.'}
            {type === 'RESUME_DOWNLOAD' && 'Serves the resume file set under Settings → Profile.'}
            {type === 'CHILD_PAGE_LIST' && 'Lists this page’s published sub-pages automatically. Add sub-pages from the Pages tree.'}
          </p>
        )}

        <Divider />

        {/* Layout and style apply to every kind. */}
        <Field label="Layout variant">
          <select
            value={section.layoutVariant}
            onChange={(e) => set('layoutVariant', e.target.value)}
            className="input-field"
          >
            {meta.variants.map((variant) => (
              <option key={variant} value={variant}>{variant}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Background">
            <select value={section.styleOptions.background} onChange={(e) => setStyle('background', e.target.value as StyleOptions['background'])} className="input-field">
              {BACKGROUNDS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Vertical padding">
            <select value={section.styleOptions.paddingY} onChange={(e) => setStyle('paddingY', e.target.value as StyleOptions['paddingY'])} className="input-field">
              {PADDINGS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Max width">
            <select value={section.styleOptions.maxWidth} onChange={(e) => setStyle('maxWidth', e.target.value as StyleOptions['maxWidth'])} className="input-field">
              {MAX_WIDTHS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Columns">
            <select value={section.styleOptions.columns} onChange={(e) => setStyle('columns', Number(e.target.value))} className="input-field">
              {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Alignment">
          <div className="flex gap-2">
            {(['left', 'center'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStyle('alignment', value)}
                aria-pressed={section.styleOptions.alignment === value}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  section.styleOptions.alignment === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={section.styleOptions.dividerAbove}
            onChange={(e) => setStyle('dividerAbove', e.target.checked)}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">Divider line above</span>
        </label>

        <Divider />

        <Field label="Anchor ID" hint="Enables deep links like /about#experience.">
          <input
            type="text"
            value={section.anchorId ?? ''}
            onChange={(e) => set('anchorId', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="input-field font-mono"
            placeholder="experience"
          />
        </Field>

        <Divider />

        <Field label="Call to action" hint="Leave the label empty to hide the button.">
          <div className="space-y-2">
            <input
              type="text"
              value={section.cta?.label ?? ''}
              onChange={(e) => set('cta', { ...(section.cta ?? { variant: 'primary' }), label: e.target.value })}
              className="input-field"
              placeholder="Button label"
            />
            <input
              type="text"
              value={section.cta?.href ?? ''}
              onChange={(e) => set('cta', { ...(section.cta ?? { variant: 'primary' }), href: e.target.value })}
              className="input-field font-mono"
              placeholder="/contact"
            />
            <select
              value={section.cta?.variant ?? 'primary'}
              onChange={(e) => set('cta', { ...(section.cta ?? {}), variant: e.target.value as 'primary' | 'secondary' | 'ghost' })}
              className="input-field"
            >
              {CTA_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </Field>
      </div>
    </div>
  );
}

/** Sections saved before a query field existed come back partial; fill the gaps. */
function normalizeQuery(query: PageSection['query']): SectionQuery {
  return {
    domains: query?.domains ?? [],
    tags: query?.tags ?? [],
    skillIds: query?.skillIds ?? [],
    featuredOnly: query?.featuredOnly ?? false,
    limit: query?.limit ?? 0,
    sortBy: query?.sortBy ?? 'order',
    sortDir: query?.sortDir ?? 'asc',
    includeExpired: query?.includeExpired ?? false,
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-slate-400 text-[11px] font-semibold block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1.5">{hint}</p>}
    </div>
  );
}

function Divider() {
  return <hr className="border-slate-800" />;
}
