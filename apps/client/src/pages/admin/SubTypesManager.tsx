import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { subTypeSchema, SubTypeInput } from '@portfolio/shared';
import {
  adminRequest, queryString, useListFilters, useDebounced,
  ListEnvelope, SubTypeRow, TypeOption,
} from '../../lib/resourceAdmin';
import { Pagination } from '../../components/admin/Pagination';
import { StatusBadge, TableSkeleton, EmptyState, Modal, SubmitButton, formatDate } from '../../components/admin/resources/TableShell';
import { useToast } from '../../hooks/useToast';
import { Plus, Edit2, Trash2, RotateCcw, Search, Power } from 'lucide-react';

export default function SubTypesManager() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { get, set, clear, hasFilters } = useListFilters();

  const [searchInput, setSearchInput] = useState(get('search'));
  const debouncedSearch = useDebounced(searchInput);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: SubTypeRow } | null>(null);

  useEffect(() => {
    if (debouncedSearch !== get('search')) set({ search: debouncedSearch });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = {
    search: get('search'),
    status: get('status'),
    mainTypeId: get('mainTypeId'),
    includeDeleted: get('includeDeleted'),
    page: get('page') || '1',
    limit: '20',
  };

  const { data, isLoading } = useQuery<ListEnvelope<SubTypeRow>>({
    queryKey: ['adminSubTypes', params],
    queryFn: () => adminRequest(`/admin/sub-types${queryString(params)}`),
  });

  const { data: mainTypeOptions } = useQuery<TypeOption[]>({
    queryKey: ['mainTypeOptions'],
    queryFn: () => adminRequest('/admin/main-types/options'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adminSubTypes'] });
    queryClient.invalidateQueries({ queryKey: ['adminMainTypes'] });
    queryClient.invalidateQueries({ queryKey: ['subTypeOptions'] });
  };

  const saveMutation = useMutation({
    mutationFn: (values: SubTypeInput) =>
      modal?.mode === 'edit'
        ? adminRequest(`/admin/sub-types/${modal.item!.id}`, { method: 'PATCH', body: JSON.stringify(values) })
        : adminRequest('/admin/sub-types', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      showToast('success', modal?.mode === 'edit' ? 'Sub type updated' : 'Sub type created');
      setModal(null);
      invalidate();
    },
    onError: (error: Error) => showToast('error', error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminRequest(`/admin/sub-types/${id}/restore`, { method: 'POST' }),
    onSuccess: () => { showToast('success', 'Sub type restored'); invalidate(); },
    onError: (error: Error) => showToast('error', error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      adminRequest(`/admin/sub-types/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => { showToast('success', 'Status updated'); invalidate(); },
    onError: (error: Error) => showToast('error', error.message),
  });

  const cascadeMutation = useMutation({
    mutationFn: (id: string) => adminRequest(`/admin/sub-types/${id}?cascade=true`, { method: 'DELETE' }),
    onSuccess: () => { showToast('success', 'Sub type and its resources deleted'); invalidate(); },
    onError: (error: Error) => showToast('error', error.message),
  });

  const handleDelete = async (row: SubTypeRow) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    try {
      await adminRequest(`/admin/sub-types/${row.id}`, { method: 'DELETE' });
      showToast('success', 'Sub type deleted');
      invalidate();
    } catch (error) {
      const message = (error as Error).message;
      // The block is a choice, not a failure — only the admin knows if the resources
      // underneath should go too.
      if (/reference this sub type/i.test(message)) {
        if (confirm(`${message}.\n\nDelete "${row.name}" and its resources?`)) cascadeMutation.mutate(row.id);
        return;
      }
      showToast('error', message);
    }
  };

  const rows = data?.items ?? [];

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sub Types</h1>
          <p className="text-sm text-slate-500">Second level of the private resource taxonomy.</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'add' })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm"
        >
          <Plus size={16} /> New Sub Type
        </button>
      </header>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="st-search">Search sub types</label>
          <input
            id="st-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, description or main type…"
            className="input-field pl-9"
          />
        </div>

        <label className="sr-only" htmlFor="st-main">Filter by main type</label>
        <select id="st-main" value={get('mainTypeId')} onChange={(e) => set({ mainTypeId: e.target.value })} className="input-field w-auto">
          <option value="">All main types</option>
          {(mainTypeOptions ?? []).map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>

        <label className="sr-only" htmlFor="st-status">Filter by status</label>
        <select id="st-status" value={get('status')} onChange={(e) => set({ status: e.target.value })} className="input-field w-auto">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Main type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Resources</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableSkeleton cols={7} />}
              {!isLoading && rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                  <td className="px-4 py-3 text-slate-300">{row.mainTypeName ?? <span className="text-amber-400 text-xs">missing</span>}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={row.description}>{row.description || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} deletedAt={row.deletedAt} /></td>
                  <td className="px-4 py-3 text-slate-300">{row.resourceCount}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      row={row}
                      onEdit={() => setModal({ mode: 'edit', item: row })}
                      onDelete={() => handleDelete(row)}
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
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="font-semibold text-white">{row.name}</span>
                <StatusBadge status={row.status} deletedAt={row.deletedAt} />
              </div>
              <p className="text-xs text-indigo-400 mb-2">{row.mainTypeName}</p>
              <p className="text-xs text-slate-400 mb-3">{row.description || 'No description'}</p>
              <p className="text-[11px] text-slate-500 mb-3">{row.resourceCount} resources · {formatDate(row.createdAt)}</p>
              <RowActions
                row={row}
                onEdit={() => setModal({ mode: 'edit', item: row })}
                onDelete={() => handleDelete(row)}
                onRestore={() => restoreMutation.mutate(row.id)}
                onToggle={() => toggleMutation.mutate({ id: row.id, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
              />
            </div>
          ))}
        </div>

        {!isLoading && rows.length === 0 && (
          <EmptyState hasFilters={hasFilters} noun="sub types" onClear={() => { setSearchInput(''); clear(); }} onCreate={() => setModal({ mode: 'add' })} />
        )}

        {data && data.totalPages > 1 && (
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={(page) => set({ page: String(page) })} />
        )}
      </div>

      {modal && (
        <SubTypeForm
          initial={modal.item}
          mainTypeOptions={mainTypeOptions ?? []}
          pending={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function RowActions({ row, onEdit, onDelete, onRestore, onToggle }: {
  row: SubTypeRow;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggle: () => void;
}) {
  if (row.deletedAt) {
    return (
      <div className="flex justify-end">
        <button type="button" onClick={onRestore} aria-label={`Restore ${row.name}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded">
          <RotateCcw size={13} /> Restore
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button type="button" onClick={onToggle} aria-label={`Toggle status of ${row.name}`} title="Toggle active/inactive" className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded">
        <Power size={14} />
      </button>
      <button type="button" onClick={onEdit} aria-label={`Edit ${row.name}`} className="p-1.5 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded">
        <Edit2 size={14} />
      </button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${row.name}`} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function SubTypeForm({ initial, mainTypeOptions, pending, onSubmit, onClose }: {
  initial?: SubTypeRow;
  mainTypeOptions: TypeOption[];
  pending: boolean;
  onSubmit: (values: SubTypeInput) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SubTypeInput>({
    resolver: zodResolver(subTypeSchema),
    defaultValues: initial
      ? { name: initial.name, description: initial.description ?? '', status: initial.status, mainTypeId: initial.mainTypeId }
      : { name: '', description: '', status: 'ACTIVE', mainTypeId: '' },
  });

  return (
    <Modal title={initial ? 'Edit Sub Type' : 'New Sub Type'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="st-form-main" className="text-slate-400 text-xs font-semibold block mb-2">Main type</label>
          <select id="st-form-main" {...register('mainTypeId')} className="input-field">
            <option value="">Select a main type…</option>
            {mainTypeOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          {errors.mainTypeId && <p className="text-red-400 text-xs mt-1.5">A main type is required</p>}
          {initial && (
            <p className="text-[11px] text-amber-400/80 mt-1.5">
              Moving this sub type also re-files every resource under it.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="st-form-name" className="text-slate-400 text-xs font-semibold block mb-2">Name</label>
          <input id="st-form-name" {...register('name')} className="input-field" autoComplete="off" />
          {errors.name && <p className="text-red-400 text-xs mt-1.5">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="st-form-desc" className="text-slate-400 text-xs font-semibold block mb-2">Description</label>
          <textarea id="st-form-desc" {...register('description')} rows={3} className="input-field resize-y" />
        </div>

        <div>
          <label htmlFor="st-form-status" className="text-slate-400 text-xs font-semibold block mb-2">Status</label>
          <select id="st-form-status" {...register('status')} className="input-field">
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
