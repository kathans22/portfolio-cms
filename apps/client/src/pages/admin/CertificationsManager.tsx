import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { certificationSchema, CertificationInput, PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { Certification, Skill } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { getExpiryStatus, ExpiryState } from '../../lib/certificationExpiry';
import { DomainMultiSelect } from '../../components/admin/DomainMultiSelect';
import { SkillMultiSelect } from '../../components/admin/SkillMultiSelect';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { useDragReorder } from '../../hooks/useDragReorder';
import { Plus, Edit2, Trash2, X, Search, ShieldCheck, GripVertical, ExternalLink } from 'lucide-react';

type SortKey = 'order' | 'name' | 'newest';

function toDateInputValue(value?: string | null) {
  return value ? new Date(value).toISOString().split('T')[0] : '';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

const EMPTY_FORM: CertificationInput = {
  name: '', issuingOrganization: '', issuerLogoUrl: '',
  issueDate: '', expiryDate: '', neverExpires: false,
  credentialId: '', credentialUrl: '', certificateImageUrl: '',
  description: '', skillIds: [], domains: [],
  featured: false, showWhenExpired: false, order: 0, status: 'PUBLISHED',
};

const EXPIRY_BADGE: Record<ExpiryState, string> = {
  NEVER: 'text-slate-400',
  ACTIVE: 'text-emerald-400',
  EXPIRING: 'text-amber-400 font-semibold',
  EXPIRED: 'text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md',
};

export default function CertificationsManager() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: Certification } | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED'>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | ExpiryState>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('order');

  // Set by the Skills Manager's "Certified" column, so that link lands on a view
  // already narrowed to the credentials backing that one skill.
  const skillIdFilter = searchParams.get('skillId');

  const { data: certifications } = useQuery<Certification[]>({
    queryKey: ['adminCertifications'],
    queryFn: async () => (await apiFetch('/admin/certifications')).json(),
  });

  const { data: skills } = useQuery<Skill[]>({
    queryKey: ['adminSkillsPicker'],
    queryFn: async () => (await apiFetch('/skills')).json(),
  });

  const skillById = useMemo(() => new Map((skills ?? []).map((s) => [s.id, s])), [skills]);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CertificationInput>({
    resolver: zodResolver(certificationSchema),
    defaultValues: EMPTY_FORM,
  });

  // useWatch rather than watch(): watch() returns a fresh function each render, which
  // the React Compiler can't memoize safely.
  const neverExpires = useWatch({ control, name: 'neverExpires' });
  const credentialUrl = useWatch({ control, name: 'credentialUrl' });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['adminCertifications'] });
    // Skill badges are derived from this relation, so they go stale on any write.
    queryClient.invalidateQueries({ queryKey: ['skills'] });
    queryClient.invalidateQueries({ queryKey: ['certifications'] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiFetch(`/admin/certifications/${id}`, { method: 'DELETE' }); },
    onSuccess: invalidateAll,
  });

  const saveMutation = useMutation<Certification, Error, CertificationInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/admin/certifications' : `/admin/certifications/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save certification');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setCurrentModal(null);
    },
    onError: (err) => alert(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Certification[]) => {
      await apiFetch('/admin/certifications/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ ids: reordered.map((cert) => cert.id) }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminCertifications'] }),
  });

  const handleAddClick = () => {
    reset(EMPTY_FORM);
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: Certification) => {
    reset({
      ...item,
      issuerLogoUrl: item.issuerLogoUrl ?? '',
      credentialId: item.credentialId ?? '',
      credentialUrl: item.credentialUrl ?? '',
      certificateImageUrl: item.certificateImageUrl ?? '',
      description: item.description ?? '',
      issueDate: toDateInputValue(item.issueDate),
      expiryDate: toDateInputValue(item.expiryDate),
    });
    setCurrentModal({ mode: 'edit', item });
  };

  const filtered = useMemo(() => {
    if (!certifications) return [];
    const list = certifications.filter((cert) => {
      const matchesSearch =
        cert.name.toLowerCase().includes(search.toLowerCase()) ||
        cert.issuingOrganization.toLowerCase().includes(search.toLowerCase());
      const matchesDomain = domainFilter === 'ALL' || cert.domains.includes(domainFilter);
      const matchesStatus = statusFilter === 'ALL' || cert.status === statusFilter;
      const matchesExpiry = expiryFilter === 'ALL' || getExpiryStatus(cert).state === expiryFilter;
      const matchesSkill = !skillIdFilter || cert.skillIds.includes(skillIdFilter);
      return matchesSearch && matchesDomain && matchesStatus && matchesExpiry && matchesSkill;
    });
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'newest') return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
      return a.order - b.order;
    });
  }, [certifications, search, domainFilter, statusFilter, expiryFilter, skillIdFilter, sortKey]);

  // Dragging only makes sense while the table is in manual-order mode; under a name or
  // date sort, or a narrowed list, row positions aren't the thing being persisted.
  const isReorderable =
    sortKey === 'order' && !search && domainFilter === 'ALL' && statusFilter === 'ALL' && expiryFilter === 'ALL' && !skillIdFilter;
  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useDragReorder(filtered, (reordered) => reorderMutation.mutate(reordered));

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Certifications Manager</h1>
          <p className="text-slate-400 text-sm">Third-party credentials, and the skills they genuinely validate.</p>
        </div>
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Certification
        </button>
      </header>

      {skillIdFilter && (
        <div className="flex items-center justify-between gap-3 bg-indigo-500/10 border border-indigo-500/25 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-indigo-300">
            Showing credentials that validate <strong>{skillById.get(skillIdFilter)?.name ?? 'this skill'}</strong>
          </span>
          <button
            onClick={() => setSearchParams({})}
            className="text-xs font-semibold text-indigo-300 hover:text-white"
          >
            Clear filter
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or issuer..." className="input-field pl-9" aria-label="Search certifications" />
        </div>
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value as ProjectDomain | 'ALL')} className="input-field w-auto" aria-label="Filter by domain">
          <option value="ALL">All domains</option>
          {Object.entries(PROJECT_DOMAIN_META).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'DRAFT' | 'PUBLISHED')} className="input-field w-auto" aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
        <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value as 'ALL' | ExpiryState)} className="input-field w-auto" aria-label="Filter by expiry state">
          <option value="ALL">Any expiry</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRING">Expiring soon</option>
          <option value="EXPIRED">Expired</option>
          <option value="NEVER">Never expires</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="input-field w-auto" aria-label="Sort certifications">
          <option value="order">Sort: Order</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="newest">Sort: Newest issued</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-4 w-10"><span className="sr-only">Reorder</span></th>
              <th className="p-4">Certification</th>
              <th className="p-4">Issuer</th>
              <th className="p-4">Issued</th>
              <th className="p-4">Expiry</th>
              <th className="p-4">Skills</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cert, index) => {
              const expiry = getExpiryStatus(cert);
              return (
                <tr
                  key={cert.id}
                  draggable={isReorderable}
                  onDragStart={isReorderable ? handleDragStart(index) : undefined}
                  onDragOver={isReorderable ? handleDragOver(index) : undefined}
                  onDrop={isReorderable ? handleDrop(index) : undefined}
                  onDragEnd={isReorderable ? handleDragEnd : undefined}
                  className={`border-b border-slate-800 last:border-0 hover:bg-slate-950/20 ${isReorderable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragIndex === index ? 'opacity-40' : ''} ${overIndex === index && dragIndex !== index ? 'border-t-2 border-t-indigo-500' : ''}`}
                >
                  <td className="p-4 text-slate-600">{isReorderable ? <GripVertical size={16} /> : null}</td>
                  <td className="p-4 font-bold text-white">
                    <div className="flex items-center gap-2">
                      {cert.featured && <ShieldCheck size={14} className="text-indigo-400 shrink-0" aria-label="Featured" />}
                      {cert.name}
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{cert.issuingOrganization}</td>
                  <td className="p-4 text-xs text-slate-400 whitespace-nowrap">{formatDate(cert.issueDate)}</td>
                  <td className="p-4 text-xs whitespace-nowrap">
                    <span className={EXPIRY_BADGE[expiry.state]}>{expiry.label}</span>
                  </td>
                  <td className="p-4 text-xs text-slate-400">
                    {cert.skillIds.length === 0 ? <span className="text-slate-600">—</span> : cert.skillIds.length}
                  </td>
                  <td className="p-4">
                    {cert.status === 'PUBLISHED'
                      ? <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Published</span>
                      : <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Draft</span>}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEditClick(cert)} aria-label={`Edit ${cert.name}`} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => { if (confirm(`Delete "${cert.name}"? Any skill badges it backs will disappear.`)) deleteMutation.mutate(cert.id); }} aria-label={`Delete ${cert.name}`} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-slate-500">No certifications match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Certification</h3>

            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              {/* 1. Identity */}
              <div>
                <label htmlFor="cert-name" className="text-slate-400 text-xs font-semibold block mb-2">Certification Name</label>
                <input id="cert-name" type="text" {...register('name')} className="input-field" placeholder="AWS Certified Solutions Architect – Associate" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>

              <div>
                <label htmlFor="cert-issuer" className="text-slate-400 text-xs font-semibold block mb-2">Issuing Organization</label>
                <input id="cert-issuer" type="text" {...register('issuingOrganization')} className="input-field" placeholder="Amazon Web Services" />
                {errors.issuingOrganization && <p className="text-red-500 text-xs mt-1">{errors.issuingOrganization.message as string}</p>}
              </div>

              <Controller
                name="issuerLogoUrl"
                control={control}
                render={({ field }) => <ImageUploadField value={field.value || ''} onChange={field.onChange} label="Issuer Logo" />}
              />

              {/* 2. Validity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cert-issue-date" className="text-slate-400 text-xs font-semibold block mb-2">Issue Date</label>
                  <input id="cert-issue-date" type="date" {...register('issueDate')} className="input-field" />
                  {errors.issueDate && <p className="text-red-500 text-xs mt-1">{errors.issueDate.message as string}</p>}
                </div>
                <div>
                  <label htmlFor="cert-expiry-date" className="text-slate-400 text-xs font-semibold block mb-2">Expiry Date</label>
                  {/* Disabled rather than ignored, so the form can't hold a state that
                      contradicts itself. */}
                  <input id="cert-expiry-date" type="date" {...register('expiryDate')} className="input-field disabled:opacity-40 disabled:cursor-not-allowed" disabled={neverExpires} />
                  {errors.expiryDate && <p className="text-red-500 text-xs mt-1">{errors.expiryDate.message as string}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input id="cert-never-expires" type="checkbox" {...register('neverExpires')} className="rounded border-slate-800 bg-slate-950" />
                <label htmlFor="cert-never-expires" className="text-slate-400 text-xs font-semibold">This credential never expires</label>
              </div>

              {/* 3. Verification */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cert-credential-id" className="text-slate-400 text-xs font-semibold block mb-2">Credential ID (optional)</label>
                  <input id="cert-credential-id" type="text" {...register('credentialId')} className="input-field" />
                </div>
                <div>
                  <label htmlFor="cert-credential-url" className="text-slate-400 text-xs font-semibold block mb-2">Verification URL (optional)</label>
                  <div className="flex gap-2">
                    <input id="cert-credential-url" type="text" {...register('credentialUrl')} className="input-field" placeholder="https://..." />
                    {/* Confirm the link actually resolves before publishing — a dead
                        verification link is worse than none. */}
                    <a
                      href={credentialUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!credentialUrl}
                      onClick={(e) => { if (!credentialUrl) e.preventDefault(); }}
                      title={credentialUrl ? 'Open in a new tab to confirm it resolves' : 'Enter a URL first'}
                      className={`shrink-0 inline-flex items-center gap-1 px-3 rounded-lg text-xs font-semibold border ${
                        credentialUrl
                          ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      Test <ExternalLink size={11} />
                    </a>
                  </div>
                  {errors.credentialUrl && <p className="text-red-500 text-xs mt-1">{errors.credentialUrl.message as string}</p>}
                </div>
              </div>

              <Controller
                name="certificateImageUrl"
                control={control}
                render={({ field }) => <ImageUploadField value={field.value || ''} onChange={field.onChange} label="Certificate / Badge Image (optional)" />}
              />

              {/* 4. Scope */}
              <div>
                <label htmlFor="cert-description" className="text-slate-400 text-xs font-semibold block mb-2">
                  What this credential covers
                  <span className="text-slate-600 font-normal"> (required once skills are mapped)</span>
                </label>
                <textarea id="cert-description" rows={3} {...register('description')} className="input-field" placeholder="Scope of the exam or program — used to sanity-check the skill mapping below." />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message as string}</p>}
              </div>

              {/* 5. The mapping — the point of the whole record, so it sits in the body
                  of the form rather than a footer slot. */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
                <Controller
                  name="skillIds"
                  control={control}
                  render={({ field }) => <SkillMultiSelect value={field.value || []} onChange={field.onChange} />}
                />
                {errors.skillIds && <p className="text-red-500 text-xs mt-1">{errors.skillIds.message as string}</p>}
              </div>

              {/* 6. Placement */}
              <Controller
                name="domains"
                control={control}
                render={({ field }) => <DomainMultiSelect value={field.value || []} onChange={field.onChange} />}
              />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="cert-order" className="text-slate-400 text-xs font-semibold block mb-2">Order</label>
                  <input id="cert-order" type="number" {...register('order', { valueAsNumber: true })} className="input-field" />
                </div>
                <div>
                  <label htmlFor="cert-status" className="text-slate-400 text-xs font-semibold block mb-2">Status</label>
                  <select id="cert-status" {...register('status')} className="input-field">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="cert-featured" type="checkbox" {...register('featured')} className="rounded border-slate-800 bg-slate-950" />
                  <label htmlFor="cert-featured" className="text-slate-400 text-xs font-semibold">Featured</label>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-5">
                <div className="flex items-start gap-2">
                  <input id="cert-show-when-expired" type="checkbox" {...register('showWhenExpired')} className="rounded border-slate-800 bg-slate-950 mt-0.5" />
                  <div>
                    <label htmlFor="cert-show-when-expired" className="text-slate-400 text-xs font-semibold block">Keep visible publicly after it expires</label>
                    <p className="text-[11px] text-slate-500 mt-1">
                      By default, expiry quietly removes a credential from the public page and from any
                      skill badges it backed. Tick this to keep it listed — it stays labelled as expired.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button type="button" onClick={() => setCurrentModal(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm disabled:opacity-60">
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
