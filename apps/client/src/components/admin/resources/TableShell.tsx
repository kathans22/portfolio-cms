import React from 'react';
import { Inbox, SearchX, Loader2 } from 'lucide-react';

/** Status pill, shared so ACTIVE/INACTIVE reads identically on all three screens. */
export function StatusBadge({ status, deletedAt }: { status: string; deletedAt?: string | null }) {
  if (deletedAt) {
    return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400">Deleted</span>;
  }
  return status === 'ACTIVE' ? (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Active</span>
  ) : (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">Inactive</span>
  );
}

export function TableSkeleton({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-800/60">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <td key={colIndex} className="px-4 py-4">
              <div className="h-3 rounded bg-slate-800 animate-pulse" style={{ width: `${40 + ((rowIndex + colIndex) % 4) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * "Nothing here yet" and "nothing matches your filters" are different problems with
 * different fixes, so they get different messages and different buttons. Showing the
 * create button to someone who has simply over-filtered sends them to make a duplicate.
 */
export function EmptyState({
  hasFilters,
  noun,
  onClear,
  onCreate,
}: {
  hasFilters: boolean;
  noun: string;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="text-center py-16 px-4">
      {hasFilters ? (
        <>
          <SearchX size={28} className="mx-auto text-slate-600 mb-3" aria-hidden="true" />
          <p className="text-slate-400 text-sm mb-4">No {noun} match these filters.</p>
          <button type="button" onClick={onClear} className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
            Clear filters
          </button>
        </>
      ) : (
        <>
          <Inbox size={28} className="mx-auto text-slate-600 mb-3" aria-hidden="true" />
          <p className="text-slate-400 text-sm mb-4">No {noun} yet.</p>
          <button
            type="button"
            onClick={onCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg"
          >
            Create the first one
          </button>
        </>
      )}
    </div>
  );
}

/** Modal shell matching the existing admin managers' pattern. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className={`bg-slate-900 border border-slate-800 rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto p-6`}>
        <div className="flex items-start justify-between mb-6">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}
