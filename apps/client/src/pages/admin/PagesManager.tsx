import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MAX_PAGE_DEPTH_CLIENT, slugify } from '../../lib/pageUtils';
import { apiFetch } from '../../lib/api';
import { NewPageDialog } from '../../components/admin/NewPageDialog';
import {
  Plus, Edit2, Copy, Trash2, Lock, Eye, EyeOff, GripVertical,
  ChevronRight, ChevronDown, ExternalLink, RotateCcw,
} from 'lucide-react';

export interface PageTreeNode {
  id: string;
  path: string;
  title: string;
  slug: string;
  status: string;
  showInNav: boolean;
  navOrder: number;
  isSystem: boolean;
  children: PageTreeNode[];
}

interface PageRecord {
  id: string;
  path: string;
  title: string;
  slug: string;
  status: string;
  showInNav: boolean;
  navOrder: number;
  isSystem: boolean;
  parentId: string | null;
  sections: unknown[];
  deletedAt?: string | null;
}

interface PagesResponse {
  items: PageRecord[];
  tree: PageTreeNode[];
  deleted: PageRecord[];
}

export default function PagesManager() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; mode: 'into' | 'before' } | null>(null);

  const { data } = useQuery<PagesResponse>({
    queryKey: ['adminPages'],
    queryFn: async () => (await apiFetch('/admin/pages?includeDeleted=true')).json(),
  });

  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const page of data?.items ?? []) counts.set(page.id, page.sections?.length ?? 0);
    return counts;
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adminPages'] });
    queryClient.invalidateQueries({ queryKey: ['nav'] });
  };

  const treeMutation = useMutation<unknown, Error, { id: string; parentId: string | null; navOrder: number }[]>({
    mutationFn: async (items) => {
      const res = await apiFetch('/admin/pages/tree', { method: 'PATCH', body: JSON.stringify({ items }) });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Failed to move page');
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err) => alert(err.message),
  });

  const toggleNavMutation = useMutation<unknown, Error, PageRecord>({
    mutationFn: async (page) => {
      const res = await apiFetch(`/admin/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          slug: page.slug,
          title: page.title,
          parentId: page.parentId,
          status: page.status,
          navOrder: page.navOrder,
          showInNav: !page.showInNav,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Failed to update page');
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err) => alert(err.message),
  });

  const duplicateMutation = useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const res = await apiFetch(`/admin/pages/${id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Failed to duplicate page');
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err) => alert(err.message),
  });

  const deleteMutation = useMutation<unknown, Error, { id: string; strategy?: string }>({
    mutationFn: async ({ id, strategy }) => {
      const res = await apiFetch(`/admin/pages/${id}${strategy ? `?strategy=${strategy}` : ''}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error?.message || 'Failed to delete page'), { body });
      return body;
    },
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const res = await apiFetch(`/admin/pages/${id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Failed to restore page');
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err) => alert(err.message),
  });

  // Deleting is a two-step conversation when children exist: the API refuses without a
  // strategy and tells us what they are, so the admin chooses rather than us guessing.
  const handleDelete = async (node: PageTreeNode) => {
    try {
      if (!confirm(`Delete "${node.title}"? It stays restorable for 30 days.`)) return;
      await deleteMutation.mutateAsync({ id: node.id });
    } catch (error) {
      const details = (error as { body?: { error?: { code?: string; details?: { descendants?: number } } } }).body?.error;
      if (details?.code !== 'CHOICE_REQUIRED') {
        alert((error as Error).message);
        return;
      }
      const count = details.details?.descendants ?? 0;
      const promote = confirm(
        `"${node.title}" has ${count} sub-page${count === 1 ? '' : 's'}.\n\n` +
          `OK — keep them, moving them up one level.\n` +
          `Cancel — delete the whole subtree.`
      );
      try {
        await deleteMutation.mutateAsync({ id: node.id, strategy: promote ? 'promote' : 'subtree' });
      } catch (retryError) {
        alert((retryError as Error).message);
      }
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDrop = (target: PageTreeNode, mode: 'into' | 'before') => {
    if (!dragId || dragId === target.id) return;
    const dragged = data?.items.find((p) => p.id === dragId);
    if (!dragged) return;

    // "Into" reparents; "before" reorders among the target's siblings. Depth and cycle
    // rules are enforced server-side — this only expresses the intent.
    const parentId = mode === 'into' ? target.id : (data?.items.find((p) => p.id === target.id)?.parentId ?? null);
    const navOrder = mode === 'into' ? 0 : Math.max(0, target.navOrder - 1);

    treeMutation.mutate([{ id: dragId, parentId, navOrder }]);
    setDragId(null);
    setDropTarget(null);
  };

  const renderNode = (node: PageTreeNode, depth: number): React.ReactNode => {
    const record = data?.items.find((p) => p.id === node.id);
    const isCollapsed = collapsed.has(node.id);
    const canNest = depth < MAX_PAGE_DEPTH_CLIENT;

    return (
      <li key={node.id}>
        <div
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragEnd={() => { setDragId(null); setDropTarget(null); }}
          onDragOver={(e) => {
            e.preventDefault();
            // Top third of the row reorders; the rest reparents into the node.
            const rect = e.currentTarget.getBoundingClientRect();
            const mode = e.clientY - rect.top < rect.height / 3 || !canNest ? 'before' : 'into';
            setDropTarget({ id: node.id, mode });
          }}
          onDrop={(e) => { e.preventDefault(); handleDrop(node, dropTarget?.mode ?? 'before'); }}
          style={{ paddingLeft: `${depth * 24}px` }}
          className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-grab active:cursor-grabbing ${
            dragId === node.id ? 'opacity-40' : ''
          } ${
            dropTarget?.id === node.id && dropTarget.mode === 'into'
              ? 'bg-indigo-500/10 ring-1 ring-indigo-500/40'
              : dropTarget?.id === node.id
                ? 'border-t-2 border-t-indigo-500'
                : 'hover:bg-slate-950/40'
          }`}
        >
          <GripVertical size={14} className="text-slate-600 shrink-0" aria-hidden="true" />

          {node.children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleCollapse(node.id)}
              aria-label={isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`}
              aria-expanded={!isCollapsed}
              className="text-slate-500 hover:text-white shrink-0"
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          <span className="min-w-0 flex-grow">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">{node.title}</span>
              {node.isSystem && (
                // Explains the disabled delete rather than leaving it a mystery. The
                // tooltip lives on a wrapper because lucide icons don't take `title`.
                <span
                  className="shrink-0 inline-flex"
                  title="System page — backs a built-in route, so it can't be deleted"
                >
                  <Lock size={12} className="text-amber-400" aria-label="System page" />
                </span>
              )}
            </span>
            <span className="block font-mono text-[11px] text-slate-500 truncate">{node.path}</span>
          </span>

          <span className="shrink-0 text-[11px] text-slate-500 w-20 text-right">
            {sectionCounts.get(node.id) ?? 0} section{(sectionCounts.get(node.id) ?? 0) === 1 ? '' : 's'}
          </span>

          <span className="shrink-0">
            {node.status === 'PUBLISHED' ? (
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Published</span>
            ) : (
              <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Draft</span>
            )}
          </span>

          <span className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => record && toggleNavMutation.mutate(record)}
              aria-label={node.showInNav ? `Hide ${node.title} from navigation` : `Show ${node.title} in navigation`}
              title={node.showInNav ? 'In navigation' : 'Hidden from navigation'}
              className={`p-1.5 rounded ${node.showInNav ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-600 bg-slate-800'}`}
            >
              {node.showInNav ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <a
              href={node.path}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${node.title} in a new tab`}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"
            >
              <ExternalLink size={13} />
            </a>
            <Link
              to={`/admin/pages/${node.id}`}
              aria-label={`Edit ${node.title}`}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"
            >
              <Edit2 size={13} />
            </Link>
            <button
              type="button"
              onClick={() => duplicateMutation.mutate(node.id)}
              aria-label={`Duplicate ${node.title}`}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(node)}
              disabled={node.isSystem}
              aria-label={`Delete ${node.title}`}
              title={node.isSystem ? "System pages can't be deleted" : 'Delete'}
              className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
            </button>
          </span>
        </div>

        {!isCollapsed && node.children.length > 0 && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const tree = data?.tree ?? [];
  const deleted = data?.deleted ?? [];

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Pages</h1>
          <p className="text-slate-400 text-sm">Drag to reorder, or drop onto a page to nest beneath it.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Plus size={16} /> New Page
        </button>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        {tree.length === 0 ? (
          <p className="text-center text-slate-500 py-12">
            No pages yet. Create one — it goes live at its URL without a deploy.
          </p>
        ) : (
          <ul>{tree.map((node) => renderNode(node, 0))}</ul>
        )}
      </div>

      {deleted.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-bold text-white mb-1">Recently deleted</h2>
          <p className="text-xs text-slate-500 mb-4">Restorable for 30 days, then removed permanently.</p>
          <ul className="space-y-2">
            {deleted.map((page) => (
              <li key={page.id} className="flex items-center justify-between gap-3 bg-slate-950/40 border border-slate-800 rounded-lg px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-300 truncate">{page.title}</span>
                  <span className="block font-mono text-[11px] text-slate-500 truncate">{page.path}</span>
                </span>
                <button
                  type="button"
                  onClick={() => restoreMutation.mutate(page.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 shrink-0"
                >
                  <RotateCcw size={13} /> Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating && (
        <NewPageDialog
          pages={data?.items.filter((p) => !p.deletedAt) ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); invalidate(); }}
        />
      )}
    </div>
  );
}

export { slugify };
