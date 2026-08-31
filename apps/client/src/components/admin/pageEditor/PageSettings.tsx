import React, { useEffect, useState } from 'react';
import type { Page } from '@portfolio/types';
import { apiFetch } from '../../../lib/api';
import { slugify, MAX_PAGE_DEPTH_CLIENT } from '../../../lib/pageUtils';
import { Check, AlertTriangle, Loader2, Lock } from 'lucide-react';

export interface PageMeta {
  title: string;
  slug: string;
  parentId: string | null;
  navLabel: string;
  showInNav: boolean;
  navOrder: number;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  noIndex: boolean;
}

interface PageSettingsProps {
  page: Page;
  meta: PageMeta;
  allPages: Page[];
  onChange: (next: PageMeta) => void;
}

export function PageSettings({ page, meta, allPages, onChange }: PageSettingsProps) {
  const [check, setCheck] = useState<{ available: boolean; path: string; reason?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const set = <K extends keyof PageMeta>(key: K, value: PageMeta[K]) => onChange({ ...meta, [key]: value });

  const slugOrParentChanged = meta.slug !== page.slug || (meta.parentId ?? null) !== (page.parentId ?? null);

  useEffect(() => {
    let cancelled = false;
    // State changes live inside the timer so the effect body never cascades a render.
    const timer = setTimeout(async () => {
      // Only ask when something that affects the path actually moved — otherwise the
      // page reports a conflict with itself.
      if (!slugOrParentChanged || !meta.slug) {
        setCheck(null);
        return;
      }
      setChecking(true);
      try {
        const params = new URLSearchParams({ slug: meta.slug, excludeId: page.id });
        if (meta.parentId) params.set('parentId', meta.parentId);
        const res = await apiFetch(`/admin/pages/validate-slug?${params}`);
        const body = await res.json();
        if (!cancelled) setCheck(res.ok ? body : { available: false, path: '', reason: body.error?.message });
      } catch {
        if (!cancelled) setCheck(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [meta.slug, meta.parentId, page.id, slugOrParentChanged]);

  // A page can't be its own parent or nest under its own descendant, and the depth cap
  // has to leave room for whatever this page already has beneath it.
  const descendantPaths = allPages.filter((p) => p.path.startsWith(`${page.path}/`));
  const ownHeight = descendantPaths.reduce((max, p) => Math.max(max, p.depth - page.depth), 0);
  const parentOptions = allPages.filter(
    (p) =>
      p.id !== page.id &&
      !p.path.startsWith(`${page.path}/`) &&
      p.depth + 1 + ownHeight <= MAX_PAGE_DEPTH_CLIENT
  );

  const previewPath = check?.path ?? page.path;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <section className="space-y-5">
        <h2 className="text-sm font-bold text-white">Page</h2>

        <Field label="Title">
          <input type="text" value={meta.title} onChange={(e) => set('title', e.target.value)} className="input-field" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Slug"
            hint={page.isSystem ? 'System pages keep their slug — code links to this path.' : undefined}
          >
            <div className="relative">
              <input
                type="text"
                value={meta.slug}
                disabled={page.isSystem}
                onChange={(e) => set('slug', slugify(e.target.value))}
                className="input-field font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {page.isSystem && <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />}
            </div>
          </Field>

          <Field label="Parent page" hint={page.isSystem ? 'System pages stay where they are.' : undefined}>
            <select
              value={meta.parentId ?? ''}
              disabled={page.isSystem}
              onChange={(e) => set('parentId', e.target.value || null)}
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Top level</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {'— '.repeat(p.depth)}{p.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold block mb-1">URL</span>
          <code className="text-sm text-slate-200 break-all">{previewPath}</code>
          {slugOrParentChanged && (
            <div className="mt-2 text-xs">
              {checking ? (
                <span className="text-slate-500 inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Checking…</span>
              ) : check?.available ? (
                <span className="text-emerald-400 inline-flex items-center gap-1.5">
                  <Check size={12} /> Available — the old URL will redirect here permanently.
                </span>
              ) : check ? (
                <span className="text-amber-400 inline-flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-px shrink-0" /> {check.reason}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-bold text-white">Navigation</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nav label" hint="Defaults to the title when empty.">
            <input
              type="text"
              value={meta.navLabel}
              onChange={(e) => set('navLabel', e.target.value)}
              className="input-field"
              placeholder={meta.title}
            />
          </Field>
          <Field label="Nav order">
            <input
              type="number"
              value={meta.navOrder}
              onChange={(e) => set('navOrder', Number(e.target.value) || 0)}
              className="input-field"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={meta.showInNav} onChange={(e) => set('showInNav', e.target.checked)} className="w-4 h-4 accent-indigo-500" />
          <span className="text-sm text-slate-300">Show in navigation</span>
        </label>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-bold text-white">SEO</h2>

        <Field label="Meta title" hint={`${(meta.metaTitle || meta.title).length} characters — Google truncates around 60.`}>
          <input type="text" value={meta.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} className="input-field" placeholder={meta.title} />
        </Field>

        <Field label="Meta description" hint={`${meta.metaDescription.length} characters — aim for 120–160.`}>
          <textarea
            value={meta.metaDescription}
            onChange={(e) => set('metaDescription', e.target.value)}
            rows={3}
            className="input-field resize-y"
          />
        </Field>

        <Field label="Social share image URL">
          <input type="text" value={meta.ogImageUrl} onChange={(e) => set('ogImageUrl', e.target.value)} className="input-field font-mono" placeholder="https://…" />
        </Field>

        {/* Abstract character counts don't tell you whether a title reads well in the
            place it actually appears. This does. */}
        <div>
          <span className="text-slate-400 text-[11px] font-semibold block mb-2">Search result preview</span>
          <div className="rounded-lg bg-white p-4 font-sans">
            <div className="text-[#202124] text-xs truncate">yoursite.com{previewPath}</div>
            <div className="text-[#1a0dab] text-lg leading-snug truncate mt-0.5">
              {truncate(meta.metaTitle || meta.title, 60)}
            </div>
            <div className="text-[#4d5156] text-[13px] leading-snug mt-1">
              {meta.metaDescription
                ? truncate(meta.metaDescription, 160)
                : <span className="italic text-[#70757a]">No description — Google will invent one from the page content.</span>}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={meta.noIndex} onChange={(e) => set('noIndex', e.target.checked)} className="w-4 h-4 accent-indigo-500" />
          <span className="text-sm text-slate-300">
            Hide from search engines
            <span className="block text-[11px] text-slate-500">Adds noindex and drops the page from the sitemap.</span>
          </span>
        </label>
      </section>
    </div>
  );
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
