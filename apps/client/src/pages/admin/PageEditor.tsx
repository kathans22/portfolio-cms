import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Page, PageSection } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { SectionList } from '../../components/admin/pageEditor/SectionList';
import { LivePreview } from '../../components/admin/pageEditor/LivePreview';
import { SectionConfig } from '../../components/admin/pageEditor/SectionConfig';
import { PageSettings, PageMeta } from '../../components/admin/pageEditor/PageSettings';
import { useToast } from '../../hooks/useToast';
import { ArrowLeft, ExternalLink, Save, Globe, FileEdit, Loader2, AlertTriangle } from 'lucide-react';

type Tab = 'sections' | 'settings';

function metaFrom(page: Page): PageMeta {
  return {
    title: page.title,
    slug: page.slug,
    parentId: page.parentId ?? null,
    navLabel: page.navLabel ?? '',
    showInNav: page.showInNav,
    navOrder: page.navOrder,
    metaTitle: page.metaTitle ?? '',
    metaDescription: page.metaDescription ?? '',
    ogImageUrl: page.ogImageUrl ?? '',
    noIndex: page.noIndex,
  };
}

export default function PageEditor() {
  const { id = '' } = useParams();

  const pageQuery = useQuery<Page>({
    queryKey: ['admin-page', id],
    queryFn: async () => {
      const res = await apiFetch(`/admin/pages/${id}`);
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Page not found');
      return res.json();
    },
  });

  // Needed for the parent picker in settings.
  const listQuery = useQuery<{ items: Page[] }>({
    queryKey: ['admin-pages'],
    queryFn: async () => {
      const res = await apiFetch('/admin/pages');
      if (!res.ok) throw new Error('Failed to load pages');
      return res.json();
    },
  });

  if (pageQuery.isError) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-red-400 mb-4">{(pageQuery.error as Error).message}</p>
        <Link to="/admin/pages" className="text-indigo-400 text-sm">Back to pages</Link>
      </div>
    );
  }

  if (!pageQuery.data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    // Keying on updatedAt reseeds the draft state from the server copy after every save
    // — the server renumbers section order and can rewrite the path, so the local copy
    // would otherwise drift. A remount is cheaper to reason about than a sync effect.
    <Editor
      key={`${pageQuery.data.id}:${pageQuery.data.updatedAt}`}
      page={pageQuery.data}
      allPages={listQuery.data?.items ?? []}
    />
  );
}

function Editor({ page, allPages }: { page: Page; allPages: Page[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('sections');
  const [sections, setSections] = useState<PageSection[]>(() => page.sections ?? []);
  const [meta, setMeta] = useState<PageMeta>(() => metaFrom(page));
  const [selected, setSelected] = useState<number | null>(0);
  const [dirty, setDirty] = useState(false);

  // Covers tab close and reload. In-app navigation is guarded explicitly on the exits
  // this screen owns (below) — this app uses a non-data router, so useBlocker is
  // unavailable and a global interceptor would be worse than an explicit one.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const updateSections = useCallback((next: PageSection[]) => {
    setSections(next);
    setDirty(true);
  }, []);

  const updateMeta = useCallback((next: PageMeta) => {
    setMeta(next);
    setDirty(true);
  }, []);

  const saveMutation = useMutation<Page, Error, { status?: 'DRAFT' | 'PUBLISHED' }>({
    mutationFn: async ({ status }) => {
      // Sections and metadata are separate endpoints by design: PUT replaces the whole
      // ordered array atomically, while PATCH recomputes paths and redirects.
      const sectionsRes = await apiFetch(`/admin/pages/${page.id}/sections`, {
        method: 'PUT',
        body: JSON.stringify({ sections: sections.map((s, index) => ({ ...s, order: index })) }),
      });
      if (!sectionsRes.ok) throw new Error((await sectionsRes.json()).error?.message || 'Failed to save sections');

      const metaRes = await apiFetch(`/admin/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...meta, status: status ?? page.status }),
      });
      const body = await metaRes.json();
      if (!metaRes.ok) throw new Error(body.error?.message || 'Failed to save page settings');
      if (body.warning) showToast('error', body.warning);
      return body;
    },
    onSuccess: (saved) => {
      setDirty(false);
      queryClient.setQueryData(['admin-page', page.id], saved);
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      showToast('success', saved.status === 'PUBLISHED' ? 'Published' : 'Saved as draft');
    },
    onError: (error) => showToast('error', error.message),
  });

  const leave = () => {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/admin/pages');
  };

  const selectedSection = useMemo(
    () => (selected !== null ? sections[selected] ?? null : null),
    [sections, selected]
  );

  const isPublished = page.status === 'PUBLISHED';
  // updatedAt moves on every save; lastPublishedAt only on a publish. A gap between them
  // is exactly "there are edits the public can't see yet".
  const hasPendingEdits =
    isPublished && !!page.lastPublishedAt && new Date(page.updatedAt) > new Date(page.lastPublishedAt);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
        <button onClick={leave} className="text-slate-400 hover:text-white shrink-0" aria-label="Back to pages">
          <ArrowLeft size={18} />
        </button>

        <div className="min-w-0 flex-grow">
          <h1 className="text-sm font-bold text-white truncate">{page.title}</h1>
          <p className="text-[11px] text-slate-500 font-mono truncate">{page.path}</p>
        </div>

        <div className="hidden xl:block text-right text-[10px] leading-tight text-slate-500 shrink-0">
          <div>Edited {formatWhen(page.updatedAt)}</div>
          <div>{page.lastPublishedAt ? `Published ${formatWhen(page.lastPublishedAt)}` : 'Never published'}</div>
        </div>

        {hasPendingEdits && (
          <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded shrink-0">
            <AlertTriangle size={11} /> Unpublished edits
          </span>
        )}

        {dirty && (
          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded shrink-0">
            Unsaved
          </span>
        )}

        <div className="flex bg-slate-950 rounded-lg p-0.5 shrink-0" role="tablist">
          {(['sections', 'settings'] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                tab === key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <a
          href={`${page.path}?preview=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold shrink-0"
        >
          <ExternalLink size={13} /> Preview
        </a>

        <button
          type="button"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate({})}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Save size={13} /> Save
        </button>

        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => {
            if (isPublished && !confirm('Unpublish this page? Visitors will get a 404.')) return;
            saveMutation.mutate({ status: isPublished ? 'DRAFT' : 'PUBLISHED' });
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 disabled:opacity-40 ${
            isPublished
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {saveMutation.isPending
            ? <Loader2 size={13} className="animate-spin" />
            : isPublished ? <FileEdit size={13} /> : <Globe size={13} />}
          {isPublished ? 'Unpublish' : 'Publish'}
        </button>
      </header>

      {tab === 'sections' ? (
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] min-h-0 divide-x divide-slate-800">
          <div className="hidden lg:block min-h-0 bg-slate-900">
            <SectionList sections={sections} selectedIndex={selected} onSelect={setSelected} onChange={updateSections} />
          </div>

          {/* min-w-0 is load-bearing: a grid item defaults to min-width:auto, so the
              preview's intrinsic width would push the config pane off screen instead of
              letting the centre column shrink and scroll. */}
          <div className="min-h-0 min-w-0">
            <LivePreview sections={sections} selectedIndex={selected} onSelect={setSelected} />
          </div>

          <div className="hidden lg:block min-h-0 bg-slate-900">
            <SectionConfig
              section={selectedSection}
              onChange={(next) => updateSections(sections.map((s, i) => (i === selected ? next : s)))}
            />
          </div>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto min-h-0">
          <PageSettings page={page} meta={meta} allPages={allPages} onChange={updateMeta} />
        </div>
      )}

      <p className="lg:hidden text-center text-[11px] text-slate-500 py-3 border-t border-slate-800">
        The section list and config panes need a wider screen.
      </p>
    </div>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString();
}
