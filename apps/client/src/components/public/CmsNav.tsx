import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { ChevronDown } from 'lucide-react';

export interface NavNode {
  id: string;
  path: string;
  label: string;
  children: NavNode[];
}

/**
 * Paths the header still renders as hardcoded links.
 *
 * Build-order step 11 backfilled these six as Page documents, so without this filter the
 * header would list every one of them twice — once hardcoded, once from the CMS. Delete a
 * path from here at the same moment you delete its `<Route>` from App.tsx and its link
 * from PublicLayout, and the CMS-managed entry takes over automatically.
 */
export const HARDCODED_NAV_PATHS = new Set(['/', '/projects', '/blog', '/contact', '/certifications', '/about']);

function useNav() {
  const query = useQuery<NavNode[]>({
    queryKey: ['nav'],
    queryFn: async () => (await apiFetch('/nav')).json(),
    staleTime: 5 * 60_000,
    // Nav is additive to the hardcoded links; if it fails the header still works.
    retry: 1,
  });

  // Filtering here rather than in each component keeps the two navs from disagreeing.
  return (query.data ?? []).filter((node) => !HARDCODED_NAV_PATHS.has(node.path));
}

/** Desktop: top-level links, with a hover/focus dropdown for children. */
export function CmsNavDesktop() {
  const nodes = useNav();
  if (nodes.length === 0) return null;

  return (
    <>
      {nodes.map((node) =>
        node.children.length === 0 ? (
          <Link key={node.id} to={node.path} className="hover:text-slate-900 dark:hover:text-white transition-colors">
            {node.label}
          </Link>
        ) : (
          <div key={node.id} className="relative group">
            <Link
              to={node.path}
              className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {node.label}
              <ChevronDown size={13} aria-hidden="true" />
            </Link>
            {/* Shown on hover and on keyboard focus, so the children aren't
                mouse-only. */}
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-all absolute left-0 top-full pt-3 z-50">
              <ul className="min-w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl">
                {node.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      to={child.path}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      )}
    </>
  );
}

/** Mobile: an accordion. A hover dropdown has no meaning on touch. */
export function CmsNavMobile({ onNavigate }: { onNavigate: () => void }) {
  const nodes = useNav();
  const [openId, setOpenId] = useState<string | null>(null);
  if (nodes.length === 0) return null;

  return (
    <>
      {nodes.map((node) =>
        node.children.length === 0 ? (
          <Link key={node.id} to={node.path} onClick={onNavigate}>
            {node.label}
          </Link>
        ) : (
          <div key={node.id}>
            <button
              type="button"
              onClick={() => setOpenId(openId === node.id ? null : node.id)}
              aria-expanded={openId === node.id}
              aria-controls={`nav-${node.id}`}
              className="flex w-full items-center justify-between text-left"
            >
              {node.label}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform ${openId === node.id ? 'rotate-180' : ''}`}
              />
            </button>
            {openId === node.id && (
              <ul id={`nav-${node.id}`} className="mt-2 ml-3 space-y-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                <li>
                  <Link to={node.path} onClick={onNavigate} className="text-sm text-slate-500 dark:text-slate-400">
                    Overview
                  </Link>
                </li>
                {node.children.map((child) => (
                  <li key={child.id}>
                    <Link to={child.path} onClick={onNavigate} className="text-sm">
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}
    </>
  );
}
