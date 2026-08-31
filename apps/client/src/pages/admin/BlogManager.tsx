import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { blogSchema, BlogInput, PROJECT_DOMAIN_META, ProjectDomain, ContentBlock } from '@portfolio/shared';
import type { BlogPost } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { DomainMultiSelect } from '../../components/admin/DomainMultiSelect';
import { TagInput } from '../../components/admin/TagInput';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { ContentBlockEditor } from '../../components/admin/ContentBlockEditor';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

type SortKey = 'newest' | 'title' | 'status';

export default function BlogManager() {
  const queryClient = useQueryClient();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: BlogPost } | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const { data: blogs } = useQuery<BlogPost[]>({
    queryKey: ['adminBlogs'],
    queryFn: async () => {
      // apiFetch attaches the admin's bearer token automatically, so this same
      // endpoint returns drafts too (see optionalAuth on the server route).
      const res = await apiFetch('/blog');
      return res.json();
    }
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<BlogInput>({
    resolver: zodResolver(blogSchema),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/blog/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogs'] });
    }
  });

  const saveMutation = useMutation<BlogPost, Error, BlogInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/blog' : `/blog/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save blog post');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogs'] });
      setCurrentModal(null);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const filteredBlogs = useMemo(() => {
    if (!blogs) return [];
    let list = blogs.filter((b) => {
      const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase());
      const matchesDomain = domainFilter === 'ALL' || b.domains.includes(domainFilter);
      return matchesSearch && matchesDomain;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      if (sortKey === 'status') return a.status.localeCompare(b.status);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [blogs, search, domainFilter, sortKey]);

  const handleAddClick = () => {
    reset({
      slug: '', title: '', excerpt: '', content: '', contentBlocks: [],
      status: 'DRAFT', coverImageUrl: '', tags: [], domains: [], publishedAt: '',
      metaTitle: '', metaDescription: '', ogImageUrl: '',
    });
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: BlogPost) => {
    const editItem: BlogInput = { ...item, contentBlocks: (item.contentBlocks as ContentBlock[]) || [] };
    if (item.publishedAt) editItem.publishedAt = new Date(item.publishedAt).toISOString().split('T')[0];
    reset(editItem);
    setCurrentModal({ mode: 'edit', item });
  };

  const onSubmit = (data: BlogInput) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-heading">Blog Manager</h1>
          <p className="text-slate-400 text-sm">Write, edit, and organize articles.</p>
        </div>
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Article
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
          <option value="newest">Sort: Newest</option>
          <option value="title">Sort: Title A-Z</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {filteredBlogs && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">URL Slug</th>
                <th className="p-4">Domains</th>
                <th className="p-4">Status</th>
                <th className="p-4">Published At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBlogs.map((b) => (
                <tr key={b.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-950/20">
                  <td className="p-4 font-bold text-white">{b.title}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">/{b.slug}</td>
                  <td className="p-4 text-xs text-slate-400">{b.domains.map((d: ProjectDomain) => PROJECT_DOMAIN_META[d]?.label ?? d).join(', ')}</td>
                  <td className="p-4">
                    {b.status === 'PUBLISHED' ? <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-md font-semibold">Published</span> : <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-md">Draft</span>}
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {b.publishedAt ? new Date(b.publishedAt).toLocaleDateString() : 'N/A'}
                    {b.publishedAt && new Date(b.publishedAt) > new Date() && <span className="ml-2 text-amber-400">(scheduled)</span>}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEditClick(b)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => { if (confirm(`Delete "${b.title}"?`)) deleteMutation.mutate(b.id); }} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBlogs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-500">No articles match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Article</h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="blog-title" className="text-slate-400 text-xs font-semibold block mb-2">Title</label>
                <input id="blog-title" type="text" {...register('title')} className="input-field" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message as string}</p>}
              </div>
              <div>
                <label htmlFor="blog-slug" className="text-slate-400 text-xs font-semibold block mb-2">URL Slug</label>
                <input id="blog-slug" type="text" {...register('slug')} className="input-field" placeholder="exploring-nextjs-relations" />
                {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message as string}</p>}
              </div>
              <div>
                <label htmlFor="blog-excerpt" className="text-slate-400 text-xs font-semibold block mb-2">Excerpt</label>
                <input id="blog-excerpt" type="text" {...register('excerpt')} className="input-field" />
                {errors.excerpt && <p className="text-red-500 text-xs mt-1">{errors.excerpt.message as string}</p>}
              </div>

              <Controller
                name="coverImageUrl"
                control={control}
                render={({ field }) => <ImageUploadField value={field.value || ''} onChange={field.onChange} label="Cover Image" />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => <TagInput value={field.value || []} onChange={field.onChange} label="Tags" placeholder="React, DevOps..." />}
                />
                <div>
                  <label htmlFor="blog-status" className="text-slate-400 text-xs font-semibold block mb-2">Status</label>
                  <select id="blog-status" {...register('status')} className="input-field">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="blog-published-at" className="text-slate-400 text-xs font-semibold block mb-2">Publish Date (optional — schedule a future date, or leave blank to publish immediately)</label>
                <input id="blog-published-at" type="date" {...register('publishedAt')} className="input-field" />
              </div>

              <Controller
                name="domains"
                control={control}
                render={({ field }) => <DomainMultiSelect value={field.value || []} onChange={field.onChange} />}
              />

              <div>
                <label htmlFor="blog-content" className="text-slate-400 text-xs font-semibold block mb-2">Fallback Content (Markdown)</label>
                <textarea id="blog-content" rows={6} {...register('content')} className="input-field" placeholder="Used only if no content blocks are added below." />
                {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content.message as string}</p>}
              </div>

              <Controller
                name="contentBlocks"
                control={control}
                render={({ field }) => <ContentBlockEditor value={field.value || []} onChange={field.onChange} />}
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
