import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectSchema, ProjectInput, PROJECT_DOMAIN_META, ProjectDomain, ContentBlock } from '@portfolio/shared';
import type { Project } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { DomainMultiSelect } from '../../components/admin/DomainMultiSelect';
import { TagInput } from '../../components/admin/TagInput';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { ContentBlockEditor } from '../../components/admin/ContentBlockEditor';
import { GalleryEditor } from '../../components/admin/GalleryEditor';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

type SortKey = 'order' | 'title' | 'newest';

export default function ProjectsManager() {
  const queryClient = useQueryClient();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: Project } | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('order');

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['adminProjects'],
    queryFn: async () => {
      // apiFetch attaches the admin's bearer token automatically, so this same
      // endpoint returns drafts too (see optionalAuth on the server route).
      const res = await apiFetch('/projects');
      return res.json();
    }
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProjects'] });
    }
  });

  const saveMutation = useMutation<Project, Error, ProjectInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/projects' : `/projects/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save project');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProjects'] });
      setCurrentModal(null);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let list = projects.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchesDomain = domainFilter === 'ALL' || p.domains.includes(domainFilter);
      return matchesSearch && matchesDomain;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      if (sortKey === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return a.order - b.order;
    });
    return list;
  }, [projects, search, domainFilter, sortKey]);

  const handleAddClick = () => {
    reset({
      title: '', slug: '', summary: '', description: '', contentBlocks: [],
      techStack: [], domains: [], role: '', liveUrl: '', repoUrl: '', coverImageUrl: '',
      gallery: [], featured: false, order: 0, status: 'PUBLISHED',
      metaTitle: '', metaDescription: '', ogImageUrl: '',
    });
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: Project) => {
    reset({ ...item, contentBlocks: (item.contentBlocks as ContentBlock[]) || [], gallery: item.gallery || [] });
    setCurrentModal({ mode: 'edit', item });
  };

  const onSubmit = (data: ProjectInput) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Projects Manager</h1>
          <p className="text-slate-400 text-sm">Create and modify case studies.</p>
        </div>
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Project
        </button>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title..." className="input-field pl-9" />
        </div>
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value as ProjectDomain | 'ALL')} className="input-field w-auto">
          <option value="ALL">All domains</option>
          {Object.entries(PROJECT_DOMAIN_META).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="input-field w-auto">
          <option value="order">Sort: Order</option>
          <option value="title">Sort: Title A-Z</option>
          <option value="newest">Sort: Newest</option>
        </select>
      </div>

      {filteredProjects && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4 w-16">Order</th>
                <th className="p-4">Cover</th>
                <th className="p-4">Title</th>
                <th className="p-4">Domains</th>
                <th className="p-4">Status</th>
                <th className="p-4">Featured</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((proj) => (
                <tr key={proj.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-950/20">
                  <td className="p-4 font-bold">{proj.order}</td>
                  <td className="p-4">
                    {proj.coverImageUrl && <img src={proj.coverImageUrl} alt="" loading="lazy" className="w-12 h-8 object-cover rounded border border-slate-800" />}
                  </td>
                  <td className="p-4 font-bold text-white">{proj.title}</td>
                  <td className="p-4 text-xs text-slate-400">{proj.domains.map((d: ProjectDomain) => PROJECT_DOMAIN_META[d]?.label ?? d).join(', ')}</td>
                  <td className="p-4">
                    {proj.status === 'PUBLISHED' ? <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Published</span> : <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Draft</span>}
                  </td>
                  <td className="p-4">
                    {proj.featured ? <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Featured</span> : <span className="text-slate-500">No</span>}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEditClick(proj)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => { if (confirm(`Delete "${proj.title}"?`)) deleteMutation.mutate(proj.id); }} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">No projects match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Project</h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="proj-title" className="text-slate-400 text-xs font-semibold block mb-2">Project Title</label>
                <input id="proj-title" type="text" {...register('title')} className="input-field" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message as string}</p>}
              </div>
              <div>
                <label htmlFor="proj-slug" className="text-slate-400 text-xs font-semibold block mb-2">URL Slug</label>
                <input id="proj-slug" type="text" {...register('slug')} className="input-field" placeholder="aura-cms-platform" />
                {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message as string}</p>}
              </div>
              <div>
                <label htmlFor="proj-summary" className="text-slate-400 text-xs font-semibold block mb-2">Summary</label>
                <input id="proj-summary" type="text" {...register('summary')} className="input-field" />
                {errors.summary && <p className="text-red-500 text-xs mt-1">{errors.summary.message as string}</p>}
              </div>

              <Controller
                name="coverImageUrl"
                control={control}
                render={({ field }) => <ImageUploadField value={field.value || ''} onChange={field.onChange} label="Cover Image" />}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="proj-repo-url" className="text-slate-400 text-xs font-semibold block mb-2">Repository URL</label>
                  <input id="proj-repo-url" type="text" {...register('repoUrl')} className="input-field" />
                </div>
                <div>
                  <label htmlFor="proj-live-url" className="text-slate-400 text-xs font-semibold block mb-2">Live Demo URL</label>
                  <input id="proj-live-url" type="text" {...register('liveUrl')} className="input-field" />
                </div>
              </div>
              <div>
                <label htmlFor="proj-role" className="text-slate-400 text-xs font-semibold block mb-2">Your Role</label>
                <input id="proj-role" type="text" {...register('role')} className="input-field" placeholder="Full-stack developer" />
              </div>

              <Controller
                name="techStack"
                control={control}
                render={({ field }) => <TagInput value={field.value || []} onChange={field.onChange} label="Tech Stack" placeholder="React, TypeScript, Docker..." />}
              />

              <Controller
                name="domains"
                control={control}
                render={({ field }) => <DomainMultiSelect value={field.value || []} onChange={field.onChange} />}
              />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="proj-order" className="text-slate-400 text-xs font-semibold block mb-2">Order Priority</label>
                  <input id="proj-order" type="number" {...register('order', { valueAsNumber: true })} className="input-field" />
                </div>
                <div>
                  <label htmlFor="proj-status" className="text-slate-400 text-xs font-semibold block mb-2">Status</label>
                  <select id="proj-status" {...register('status')} className="input-field">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="proj-featured" type="checkbox" {...register('featured')} className="rounded border-slate-800 bg-slate-950" />
                  <label htmlFor="proj-featured" className="text-slate-400 text-xs font-semibold">Featured showcase</label>
                </div>
              </div>

              <div>
                <label htmlFor="proj-description" className="text-slate-400 text-xs font-semibold block mb-2">Fallback Description (Markdown)</label>
                <textarea id="proj-description" rows={4} {...register('description')} className="input-field" placeholder="Used only if no content blocks are added below." />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message as string}</p>}
              </div>

              <Controller
                name="contentBlocks"
                control={control}
                render={({ field }) => <ContentBlockEditor value={field.value || []} onChange={field.onChange} />}
              />

              <Controller
                name="gallery"
                control={control}
                render={({ field }) => <GalleryEditor value={field.value || []} onChange={field.onChange} />}
              />

              <details className="border-t border-slate-800 pt-4">
                <summary className="text-slate-400 text-xs font-semibold cursor-pointer mb-4">SEO (optional)</summary>
                <div className="space-y-4 mt-4">
                  <input type="text" {...register('metaTitle')} className="input-field" placeholder="Meta title" />
                  <input type="text" {...register('metaDescription')} className="input-field" placeholder="Meta description" />
                  <Controller
                    name="ogImageUrl"
                    control={control}
                    render={({ field }) => <ImageUploadField value={field.value || ''} onChange={field.onChange} label="OG Image" />}
                  />
                </div>
              </details>

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
