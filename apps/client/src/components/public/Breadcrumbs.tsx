import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  path: string;
  title: string;
  navLabel?: string;
}

/**
 * Built from the ancestor chain the resolver returns, not reconstructed from the path —
 * a path string carries slugs, not titles, so rebuilding it client-side would mean
 * guessing at names.
 */
export function Breadcrumbs({ ancestors, current }: { ancestors: Crumb[]; current: string }) {
  if (ancestors.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <li>
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
        </li>
        {ancestors.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-1.5">
            <ChevronRight size={13} aria-hidden="true" className="text-slate-400" />
            <Link to={crumb.path} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              {crumb.navLabel || crumb.title}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <ChevronRight size={13} aria-hidden="true" className="text-slate-400" />
          <span aria-current="page" className="text-slate-900 dark:text-white font-medium">{current}</span>
        </li>
      </ol>
    </nav>
  );
}
