import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { slugify, MAX_PAGE_DEPTH_CLIENT } from '../../lib/pageUtils';
import { X, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface ParentOption {
  id: string;
  path: string;
  title: string;
  depth?: number;
}

interface SlugCheck {
  available: boolean;
  path: string;
  reason?: string;
}

interface NewPageDialogProps {
  pages: ParentOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function NewPageDialog({ pages, onClose, onCreated }: NewPageDialogProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  // Once the admin edits the slug we stop overwriting it from the title, or their
  // deliberate choice gets clobbered on the next keystroke.
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState('');
  const [check, setCheck] = useState<SlugCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Focusing on mount rather than via autoFocus: the attribute fires before the dialog
  // is positioned, which yanks the page scroll on smaller screens.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const effectiveSlug = slugTouched ? slug : slugify(title);

  // Only pages that can still take a child are offered, so the depth cap is visible in
  // the picker rather than surfacing as an error after submitting.
  const parentOptions = pages.filter((p) => (p.path.split('/').length - 1) <= MAX_PAGE_DEPTH_CLIENT - 1);

  useEffect(() => {
    let cancelled = false;
    // Debounced: this fires per keystroke otherwise. State changes live inside the
    // timer so the effect body itself never triggers a cascading render.
    const timer = setTimeout(async () => {
      if (!effectiveSlug) {
        setCheck(null);
        return;
      }
      setChecking(true);
      try {
        const params = new URLSearchParams({ slug: effectiveSlug });
        if (parentId) params.set('parentId', parentId);
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
  }, [effectiveSlug, parentId]);

  const createMutation = useMutation<{ id: string }, Error, void>({
    mutationFn: async () => {
      const res = await apiFetch('/admin/pages', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          slug: effectiveSlug,
          parentId: parentId || null,
          status: 'DRAFT',
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Failed to create page');
      return body;
    },
    onSuccess: (page) => {
      onCreated();
      // Straight into the editor — a page with no sections is not a finished task.
      navigate(`/admin/pages/${page.id}`);
    },
    onError: (err) => alert(err.message),
  });

  const previewPath = check?.path || `${parentOptions.find((p) => p.id === parentId)?.path ?? ''}/${effectiveSlug || '…'}`;
  const canSubmit = title.trim().length >= 2 && !!effectiveSlug && check?.available === true && !checking;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>
        <h3 className="text-xl font-bold text-white mb-6">New page</h3>

        <div className="space-y-5">
          <div>
            <label htmlFor="np-title" className="text-slate-400 text-xs font-semibold block mb-2">Title</label>
            <input
              id="np-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              ref={titleRef}
              className="input-field"
              placeholder="Engineering Guides"
            />
          </div>

          <div>
            <label htmlFor="np-parent" className="text-slate-400 text-xs font-semibold block mb-2">Parent page</label>
            <select id="np-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="input-field">
              <option value="">Top level</option>
              {parentOptions.map((page) => (
                <option key={page.id} value={page.id}>
                  {'— '.repeat(Math.max(0, page.path.split('/').length - 2))}{page.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="np-slug" className="text-slate-400 text-xs font-semibold block mb-2">
              Slug <span className="text-slate-600 font-normal">(auto-filled from the title)</span>
            </label>
            <input
              id="np-slug"
              type="text"
              value={effectiveSlug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              className="input-field font-mono"
              placeholder="engineering-guides"
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold block mb-1">URL preview</span>
            <code className="text-sm text-slate-200 break-all">{previewPath}</code>

            <div className="mt-2 text-xs flex items-start gap-1.5">
              {checking ? (
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Checking…
                </span>
              ) : check?.available ? (
                <span className="text-emerald-400 inline-flex items-center gap-1.5">
                  <Check size={12} /> Available
                </span>
              ) : check ? (
                <span className="text-amber-400 inline-flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-px shrink-0" /> {check.reason}
                </span>
              ) : (
                <span className="text-slate-600">Enter a title to see the URL.</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating…' : 'Create & edit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
