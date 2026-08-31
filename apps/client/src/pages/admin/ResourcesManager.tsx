import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resourceSchema, ResourceInput, isHttpUrl } from '@portfolio/shared';
import {
  adminRequest, queryString, useListFilters, useDebounced,
  ListEnvelope, ResourceRow, TypeOption,
} from '../../lib/resourceAdmin';
import { Pagination } from '../../components/admin/Pagination';
import { ResourceLink } from '../../components/admin/resources/ResourceLink';
import { StatusBadge, TableSkeleton, EmptyState, Modal, SubmitButton, formatDate } from '../../components/admin/resources/TableShell';
import { useToast } from '../../hooks/useToast';
import { Plus, Edit2, Trash2, RotateCcw, Search, Power, Eye, ExternalLink } from 'lucide-react';

export default function ResourcesManager() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { get, set, clear, hasFilters } = useListFilters();

  const [searchInput, setSearchInput] = useState(get('search'));
  const debouncedSearch = useDebounced(searchInput);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: ResourceRow } | null>(null);
  const [viewing, setViewing] = useState<ResourceRow | null>(null);

  useEffect(() => {
    if (debouncedSearch !== get('search')) set({ search: debouncedSearch });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterMainTypeId = get('mainTypeId');

  const params = {
    search: get('search'),
    mainTypeId: filterMainTypeId,
    subTypeId: get('subTypeId'),
    status: get('status'),
    createdFrom: get('createdFrom'),
    createdTo: get('createdTo'),
    includeDeleted: get('includeDeleted'),
    page: get('page') || '1',
    limit: '20',
  };

  const { data, isLoading } = useQuery<ListEnvelope<ResourceRow>>({
    queryKey: ['adminResources', params],
    queryFn: () => adminRequest(`/admin/resources${queryString(params)}`),
  });

  const { data: mainTypeOptions } = useQuery<TypeOption[]>({
    queryKey: ['mainTypeOptions'],
    queryFn: () => adminRequest('/admin/main-types/options'),
  });

  // The toolbar's sub type filter cascades from its main type filter, exactly like the
  // form's does.
  const { data: filterSubTypes } = useQuery<TypeOption[]>({
    queryKey: ['subTypeOptions', filterMainTypeId],
    queryFn: () => adminRequest(`/admin/sub-types/options?mainTypeId=${filterMainTypeId}`),
    enabled: !!filterMainTypeId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['adminResources'] });

  const saveMutation = useMutation({
    mutationFn: (values: ResourceInput) =>
      modal?.mode === 'edit'
        ? adminRequest(`/admin/resources/${modal.item!.id}`, { method: 'PATCH', body: JSON.stringify(values) })
        : adminRequest('/admin/resources', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      showToast('success', modal?.mode === 'edit' ? 'Resource updated' : 'Resource created');
      setModal(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['adminSubTypes'] });
    },
    onError: (error: Error) => showToast('error', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminRequest(`/admin/resources/${id}`, { method: 'DELETE' }),
    onSuccess: () => { showToast('success', 'Resource deleted'); invalidate(); },
    onError: (error: Error) => showToast('error', error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminRequest(`/admin/resources/${id}/restore`, { method: 'POST' }),
    onSuccess: () => { showToast('success', 'Resource restored'); invalidate(); },
    onError: (error: Error) => showToast('error', error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      adminRequest(`/admin/resources/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => { showToast('success', 'Status updated'); invalidate(); },
    onError: (error: Error) => showToast('error', error.message),
  });

  const rows = data?.items ?? [];

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Resources</h1>
          <p className="text-sm text-slate-500">Private bookmarks. Never shown on the public site.</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'add' })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
        >
          <Plus size={16} /> New Resource
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="rs-search">Search resources</label>
          <input
            id="rs-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search link, description or type…"
            className="input-field pl-9"
          />
        </div>

        <div>
          <label className="sr-only" htmlFor="rs-main">Filter by main type</label>
          <select
            id="rs-main"
            value={filterMainTypeId}
            // Changing the main type invalidates any sub type chosen under the old one.
            onChange={(e) => set({ mainTypeId: e.target.value, subTypeId: null })}
            className="input-field w-auto"
          >
            <option value="">All main types</option>
            {(mainTypeOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="sr-only" htmlFor="rs-sub">Filter by sub type</label>
          <select
            id="rs-sub"
            value={get('subTypeId')}
            onChange={(e) => set({ subTypeId: e.target.value })}
            disabled={!filterMainTypeId}
            className="input-field w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{filterMainTypeId ? 'All sub types' : 'Pick a main type first'}</option>
            {(filterSubTypes ?? []).map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="sr-only" htmlFor="rs-status">Filter by status</label>
          <select id="rs-status" value={get('status')} onChange={(e) => set({ status: e.target.value })} className="input-field w-auto">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div>
          <label htmlFor="rs-from" className="block text-[11px] text-slate-500 mb-1">Created from</label>
          <input id="rs-from" type="date" value={get('createdFrom')} onChange={(e) => set({ createdFrom: e.target.value })} className="input-field w-auto" />
        </div>
        <div>
          <label htmlFor="rs-to" className="block text-[11px] text-slate-500 mb-1">Created to</label>
          <input id="rs-to" type="date" value={get('createdTo')} onChange={(e) => set({ createdTo: e.target.value })} className="input-field w-auto" />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={get('includeDeleted') === 'true'}
            onChange={(e) => set({ includeDeleted: e.target.checked ? 'true' : null })}
            className="w-4 h-4 accent-indigo-500"
          />
          Show deleted
        </label>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Main type</th>
                <th className="px-4 py-3">Sub type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableSkeleton cols={7} />}
              {!isLoading && rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-4 py-3"><ResourceLink link={row.link} /></td>
                  <td className="px-4 py-3 text-slate-300">{row.mainTypeName ?? <span className="text-amber-400 text-xs">missing</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{row.subTypeName ?? <span className="text-amber-400 text-xs">missing</span>}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={row.description}>{row.description || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} deletedAt={row.deletedAt} /></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      row={row}
                      onView={() => setViewing(row)}
                      onEdit={() => setModal({ mode: 'edit', item: row })}
                      onDelete={() => { if (confirm(`Delete the bookmark for "${row.link}"?`)) deleteMutation.mutate(row.id); }}
                      onRestore={() => restoreMutation.mutate(row.id)}
                      onToggle={() => toggleMutation.mutate({ id: row.id, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-800">
          {!isLoading && rows.map((row) => (
            <div key={row.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <ResourceLink link={row.link} />
                <StatusBadge status={row.status} deletedAt={row.deletedAt} />
              </div>
              <p className="text-xs text-indigo-400 mb-2">{row.mainTypeName} › {row.subTypeName}</p>
              <p className="text-xs text-slate-400 mb-3">{row.description || 'No description'}</p>
              <RowActions
                row={row}
                onView={() => setViewing(row)}
                onEdit={() => setModal({ mode: 'edit', item: row })}
                onDelete={() => { if (confirm(`Delete the bookmark for "${row.link}"?`)) deleteMutation.mutate(row.id); }}
                onRestore={() => restoreMutation.mutate(row.id)}
                onToggle={() => toggleMutation.mutate({ id: row.id, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
              />
            </div>
          ))}
        </div>

        {!isLoading && rows.length === 0 && (
          <EmptyState hasFilters={hasFilters} noun="resources" onClear={() => { setSearchInput(''); clear(); }} onCreate={() => setModal({ mode: 'add' })} />
        )}

        {data && data.totalPages > 1 && (
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={(page) => set({ page: String(page) })} />
        )}
      </div>

      {modal && (
        <ResourceForm
          initial={modal.item}
          mainTypeOptions={mainTypeOptions ?? []}
          pending={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          onClose={() => setModal(null)}
        />
      )}

      {viewing && (
        <Modal title="Resource" onClose={() => setViewing(null)}>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500 text-xs font-semibold mb-1">Link</dt>
              <dd><ResourceLink link={viewing.link} /></dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs font-semibold mb-1">Category</dt>
              <dd className="text-slate-200">{viewing.mainTypeName} › {viewing.subTypeName}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs font-semibold mb-1">Description</dt>
              <dd className="text-slate-300 whitespace-pre-wrap">{viewing.description || '—'}</dd>
            </div>
            <div className="flex gap-8">
              <div>
                <dt className="text-slate-500 text-xs font-semibold mb-1">Status</dt>
                <dd><StatusBadge status={viewing.status} deletedAt={viewing.deletedAt} /></dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-semibold mb-1">Created</dt>
                <dd className="text-slate-400">{formatDate(viewing.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-semibold mb-1">Updated</dt>
                <dd className="text-slate-400">{formatDate(viewing.updatedAt)}</dd>
              </div>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}

function RowActions({ row, onView, onEdit, onDelete, onRestore, onToggle }: {
  row: ResourceRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggle: () => void;
}) {
  if (row.deletedAt) {
    return (
      <div className="flex justify-end">
        <button type="button" onClick={onRestore} aria-label="Restore resource" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded">
          <RotateCcw size={13} /> Restore
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button type="button" onClick={onView} aria-label="View resource" className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded">
        <Eye size={14} />
      </button>
      <button type="button" onClick={onToggle} aria-label="Toggle status" title="Toggle active/inactive" className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded">
        <Power size={14} />
      </button>
      <button type="button" onClick={onEdit} aria-label="Edit resource" className="p-1.5 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded">
        <Edit2 size={14} />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete resource" className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ResourceForm({ initial, mainTypeOptions, pending, onSubmit, onClose }: {
  initial?: ResourceRow;
  mainTypeOptions: TypeOption[];
  pending: boolean;
  onSubmit: (values: ResourceInput) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<ResourceInput>({
    resolver: zodResolver(resourceSchema),
    defaultValues: initial
      ? {
          link: initial.link, description: initial.description ?? '', status: initial.status,
          mainTypeId: initial.mainTypeId, subTypeId: initial.subTypeId,
        }
      : { link: '', description: '', status: 'ACTIVE', mainTypeId: '', subTypeId: '' },
  });

  // useWatch rather than watch(): watch() returns a new function each render, which the
  // React Compiler cannot memoize.
  const mainTypeId = useWatch({ control, name: 'mainTypeId' });
  const link = useWatch({ control, name: 'link' });
  const [touchedMainType, setTouchedMainType] = useState(false);

  const { data: subTypeOptions, isFetching: loadingSubTypes } = useQuery<TypeOption[]>({
    queryKey: ['subTypeOptions', mainTypeId],
    queryFn: () => adminRequest(`/admin/sub-types/options?mainTypeId=${mainTypeId}`),
    enabled: !!mainTypeId,
  });

  return (
    <Modal title={initial ? 'Edit Resource' : 'New Resource'} onClose={onClose} wide>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="rs-form-link" className="text-slate-400 text-xs font-semibold block mb-2">Link</label>
          <div className="flex gap-2">
            <input id="rs-form-link" {...register('link')} className="input-field font-mono" placeholder="https://example.com/page" autoComplete="off" />
            <a
              href={isHttpUrl(link ?? '') ? link : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!isHttpUrl(link ?? '')}
              title={isHttpUrl(link ?? '') ? 'Open in a new tab' : 'Enter a valid http(s) URL first'}
              className={`inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold shrink-0 ${
                isHttpUrl(link ?? '')
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-slate-800/50 text-slate-600 pointer-events-none'
              }`}
            >
              <ExternalLink size={13} /> Test
            </a>
          </div>
          {errors.link && <p className="text-red-400 text-xs mt-1.5">{errors.link.message}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rs-form-main" className="text-slate-400 text-xs font-semibold block mb-2">Main type</label>
            <select
              id="rs-form-main"
              {...register('mainTypeId', {
                onChange: () => {
                  // Clearing the sub type here is what keeps the pair consistent. Keeping
                  // a selection from the previous main type is exactly the mismatch the
                  // server rejects — and it would look like the form was broken.
                  setTouchedMainType(true);
                  setValue('subTypeId', '', { shouldValidate: false });
                },
              })}
              className="input-field"
            >
              <option value="">Select a main type…</option>
              {mainTypeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
            {errors.mainTypeId && <p className="text-red-400 text-xs mt-1.5">A main type is required</p>}
          </div>

          <div>
            <label htmlFor="rs-form-sub" className="text-slate-400 text-xs font-semibold block mb-2">Sub type</label>
            <select id="rs-form-sub" {...register('subTypeId')} disabled={!mainTypeId} className="input-field disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">
                {!mainTypeId ? 'Select a main type first' : loadingSubTypes ? 'Loading…' : 'Select a sub type…'}
              </option>
              {(subTypeOptions ?? []).map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
            {errors.subTypeId && <p className="text-red-400 text-xs mt-1.5">A sub type is required</p>}
            {touchedMainType && initial && (
              <p className="text-[11px] text-amber-400/80 mt-1.5">Main type changed — pick a sub type again.</p>
            )}
            {mainTypeId && !loadingSubTypes && (subTypeOptions ?? []).length === 0 && (
              <p className="text-[11px] text-amber-400/80 mt-1.5">
                This main type has no active sub types yet.
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="rs-form-desc" className="text-slate-400 text-xs font-semibold block mb-2">Description</label>
          <textarea id="rs-form-desc" {...register('description')} rows={4} className="input-field resize-y" placeholder="Why is this worth keeping?" />
          {errors.description && <p className="text-red-400 text-xs mt-1.5">{errors.description.message}</p>}
        </div>

        <div>
          <label htmlFor="rs-form-status" className="text-slate-400 text-xs font-semibold block mb-2">Status</label>
          <select id="rs-form-status" {...register('status')} className="input-field">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
            Cancel
          </button>
          <SubmitButton pending={pending} label={initial ? 'Save changes' : 'Create'} />
        </div>
      </form>
    </Modal>
  );
}
