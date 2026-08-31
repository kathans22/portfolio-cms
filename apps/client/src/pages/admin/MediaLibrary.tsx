import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Media, PaginatedResponse } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { Pagination } from '../../components/admin/Pagination';
import { Upload, Copy, Check, Trash2, AlertCircle, Image as ImageIcon } from 'lucide-react';

const PAGE_SIZE = 24;

export default function MediaLibrary() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: mediaPage } = useQuery<PaginatedResponse<Media>>({
    queryKey: ['adminMedia', page],
    queryFn: async () => (await apiFetch(`/media?page=${page}&limit=${PAGE_SIZE}`)).json(),
  });
  const media = mediaPage?.data;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/media/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminMedia'] }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/media/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setPage(1);
        queryClient.invalidateQueries({ queryKey: ['adminMedia'] });
      } else {
        setError(data.error?.message || 'Upload failed');
      }
    } catch {
      setError('Connection failure uploading asset.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Media Library</h1>
          <p className="text-slate-400 text-sm">Every image uploaded across projects, blog posts, and testimonials.</p>
        </div>
        <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors">
          <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload Image'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {media && media.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
            {media.map((item) => (
              <div key={item.id} className="group relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden aspect-square">
                <img src={item.url} alt={item.originalName} loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <button
                    onClick={() => handleCopy(item.id, item.url)}
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded flex items-center gap-1 w-full justify-center"
                  >
                    {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />} {copiedId === item.id ? 'Copied' : 'Copy URL'}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this image? Any content still referencing it will show a broken image.')) deleteMutation.mutate(item.id); }}
                    className="px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded flex items-center gap-1 w-full justify-center"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {mediaPage?.pagination && (
            <Pagination
              page={mediaPage.pagination.page}
              totalPages={mediaPage.pagination.totalPages}
              total={mediaPage.pagination.total}
              limit={mediaPage.pagination.limit}
              onPageChange={setPage}
            />
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-800 rounded-xl p-16 flex flex-col items-center justify-center text-slate-500">
          <ImageIcon size={40} className="mb-4 opacity-40" />
          <p className="text-sm">No media uploaded yet. Upload an image to get started.</p>
        </div>
      )}
    </div>
  );
}
