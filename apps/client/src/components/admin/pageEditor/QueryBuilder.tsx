import React, { useEffect, useState } from 'react';
import { SECTION_TYPES, SectionType } from '@portfolio/shared';
import type { SectionQuery, ProjectDomain } from '@portfolio/types';
import { apiFetch } from '../../../lib/api';
import { DomainMultiSelect } from '../DomainMultiSelect';
import { SkillMultiSelect } from '../SkillMultiSelect';
import { TagInput } from '../TagInput';
import { Loader2 } from 'lucide-react';

/**
 * Sort fields offered per type. Kept in step with SORTABLE_FIELDS in resolve.service.ts —
 * offering a field the server rejects would silently fall back to the default sort,
 * which reads as a bug rather than a validation failure.
 */
const SORT_FIELDS: Record<string, { value: string; label: string }[]> = {
  PROJECT_LIST: [
    { value: 'order', label: 'Manual order' },
    { value: 'createdAt', label: 'Date added' },
    { value: 'title', label: 'Title' },
  ],
  BLOG_LIST: [
    { value: 'publishedAt', label: 'Publish date' },
    { value: 'title', label: 'Title' },
  ],
  CERTIFICATION_LIST: [
    { value: 'order', label: 'Manual order' },
    { value: 'issueDate', label: 'Issue date' },
    { value: 'name', label: 'Name' },
  ],
  SKILL_LIST: [
    { value: 'order', label: 'Manual order' },
    { value: 'level', label: 'Level' },
    { value: 'name', label: 'Name' },
  ],
  EXPERIENCE_TIMELINE: [
    { value: 'startDate', label: 'Start date' },
    { value: 'order', label: 'Manual order' },
  ],
  EDUCATION_TIMELINE: [
    { value: 'startDate', label: 'Start date' },
  ],
  TESTIMONIAL_LIST: [
    { value: 'order', label: 'Manual order' },
    { value: 'createdAt', label: 'Date added' },
  ],
};

/** Which controls make sense per type — a tag filter on testimonials is noise. */
const SUPPORTS = {
  domains: new Set(['PROJECT_LIST', 'BLOG_LIST', 'CERTIFICATION_LIST', 'SKILL_LIST', 'EXPERIENCE_TIMELINE']),
  tags: new Set(['PROJECT_LIST', 'BLOG_LIST']),
  skills: new Set(['CERTIFICATION_LIST', 'SKILL_LIST']),
  featured: new Set(['PROJECT_LIST', 'CERTIFICATION_LIST']),
  expired: new Set(['CERTIFICATION_LIST']),
};

interface CountResult {
  matching: number;
  total: number;
  shown: number;
  applicable: boolean;
}

interface QueryBuilderProps {
  type: SectionType;
  value: SectionQuery;
  onChange: (next: SectionQuery) => void;
}

export function QueryBuilder({ type, value, onChange }: QueryBuilderProps) {
  const [count, setCount] = useState<CountResult | null>(null);
  const [counting, setCounting] = useState(false);
  const [countError, setCountError] = useState(false);

  const set = <K extends keyof SectionQuery>(key: K, next: SectionQuery[K]) => onChange({ ...value, [key]: next });

  // Serialised so the effect keys off the query's *content*, not a fresh object identity
  // on every parent render.
  const queryKey = JSON.stringify(value);

  useEffect(() => {
    let cancelled = false;

    // The flags are set inside the timer, not in the effect body: the effect only
    // schedules work, and flipping state synchronously here would cascade a render on
    // every keystroke that never reaches the network anyway.
    const timer = setTimeout(async () => {
      setCounting(true);
      setCountError(false);
      try {
        const res = await apiFetch('/admin/sections/count', {
          method: 'POST',
          body: JSON.stringify({ type, query: JSON.parse(queryKey) }),
        });
        const body = await res.json();
        if (cancelled) return;
        if (res.ok) setCount(body);
        else setCountError(true);
      } catch {
        if (!cancelled) setCountError(true);
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [type, queryKey]);

  const noun = SECTION_TYPES[type].label.toLowerCase();
  const sortFields = SORT_FIELDS[type] ?? [{ value: 'order', label: 'Manual order' }];

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-indigo-400">Query</h3>

      {SUPPORTS.domains.has(type) && (
        <DomainMultiSelect
          label="Domains"
          value={value.domains as ProjectDomain[]}
          onChange={(next) => set('domains', next)}
        />
      )}

      {SUPPORTS.tags.has(type) && (
        <TagInput
          label={type === 'PROJECT_LIST' ? 'Tech stack' : 'Tags'}
          value={value.tags}
          onChange={(next) => set('tags', next)}
          placeholder="Type and press Enter"
        />
      )}

      {SUPPORTS.skills.has(type) && (
        <SkillMultiSelect label="Skills" value={value.skillIds} onChange={(next) => set('skillIds', next)} />
      )}

      {SUPPORTS.featured.has(type) && (
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={value.featuredOnly}
            onChange={(e) => set('featuredOnly', e.target.checked)}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">Featured only</span>
        </label>
      )}

      {SUPPORTS.expired.has(type) && (
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={value.includeExpired}
            onChange={(e) => set('includeExpired', e.target.checked)}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">Include expired</span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="qb-sort" className="text-slate-400 text-[11px] font-semibold block mb-1.5">Sort by</label>
          <select id="qb-sort" value={value.sortBy} onChange={(e) => set('sortBy', e.target.value)} className="input-field">
            {sortFields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="qb-dir" className="text-slate-400 text-[11px] font-semibold block mb-1.5">Direction</label>
          <select
            id="qb-dir"
            value={value.sortDir}
            onChange={(e) => set('sortDir', e.target.value as 'asc' | 'desc')}
            className="input-field"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="qb-limit" className="text-slate-400 text-[11px] font-semibold block mb-1.5">
          Limit <span className="text-slate-600 font-normal">(0 = no limit)</span>
        </label>
        <input
          id="qb-limit"
          type="number"
          min={0}
          value={value.limit}
          onChange={(e) => set('limit', Math.max(0, Number(e.target.value) || 0))}
          className="input-field"
        />
      </div>

      {/* The whole point of the builder: see the effect of a filter before publishing. */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs">
        {counting && !count ? (
          <span className="text-slate-500 inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Counting…
          </span>
        ) : countError ? (
          <span className="text-amber-400">Couldn’t load the result count.</span>
        ) : count?.applicable ? (
          <span className={counting ? 'text-slate-500' : 'text-slate-200'}>
            Showing <strong className="text-indigo-400">{count.shown}</strong> of{' '}
            <strong>{count.total}</strong> {noun}
            {count.matching !== count.shown && (
              <span className="text-slate-500"> · limit hides {count.matching - count.shown}</span>
            )}
            {count.matching === 0 && (
              <span className="block text-amber-400 mt-1">
                Nothing matches — this section will render empty.
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-500">No count for this section type.</span>
        )}
      </div>
    </div>
  );
}
