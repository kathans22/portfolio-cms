import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, apiFetch } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { Link2, Trash2, Globe } from 'lucide-react';

interface AdminSiteSettings {
  faviconSourceUrl: string | null;
  hasFavicon: boolean;
  updatedAt: string | null;
}

/**
 * Manages the browser-tab icon. Paste a Google Drive link (shared as "Anyone with the
 * link"); the server checks it is a real image before it goes live.
 */
export function FaviconManager() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [link, setLink] = useState('');

  const { data } = useQuery<AdminSiteSettings>({
    queryKey: ['adminSiteSettings'],
    queryFn: async () => (await apiFetch('/admin/site-settings')).json(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['adminSiteSettings'] });
    queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
  };

  const saveMutation = useMutation<void, Error, string>({
    mutationFn: async (url) => {
      const res = await apiFetch('/admin/site-settings/favicon', { method: 'PUT', body: JSON.stringify({ url }) });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Could not save the favicon');
    },
    onSuccess: () => {
      setLink('');
      refresh();
      showToast('success', 'Favicon updated.');
    },
    onError: (err) => showToast('error', err.message),
  });

  const removeMutation = useMutation<void, Error>({
    mutationFn: async () => {
      const res = await apiFetch('/admin/site-settings/favicon', { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Could not remove the favicon');
    },
    onSuccess: () => {
      refresh();
      showToast('success', 'Favicon removed. The default icon is back.');
    },
    onError: (err) => showToast('error', err.message),
  });

  const busy = saveMutation.isPending || removeMutation.isPending;

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-xl space-y-5">
      <h2 className="text-lg font-bold border-b border-slate-800 pb-3 flex items-center gap-2 text-white">
        <Globe size={18} className="text-indigo-400" /> Favicon (browser tab icon)
      </h2>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
          {data?.hasFavicon ? (
            <img
              src={`${API_BASE}/site-settings/favicon?v=${encodeURIComponent(data.updatedAt ?? '')}`}
              alt="Current favicon"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <Globe size={22} className="text-slate-600" />
          )}
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          {data?.hasFavicon ? 'This icon shows in the browser tab.' : 'None set — the site uses its default icon.'}
          {data?.faviconSourceUrl && <span className="mt-1 block break-all text-slate-500">{data.faviconSourceUrl}</span>}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) saveMutation.mutate(link.trim());
        }}
        className="space-y-3"
      >
        <label htmlFor="favicon-link" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Link2 size={15} className="text-indigo-400" /> Google Drive link to your logo
        </label>
        <p className="text-xs leading-relaxed text-slate-400">
          In Drive, click <span className="text-slate-300">Share</span> and set General access to{' '}
          <span className="text-slate-300">&ldquo;Anyone with the link&rdquo;</span>. Any PNG, JPG, WebP or ICO under 1MB —
          it is cropped to a circle automatically. It&apos;s checked before it goes live.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="favicon-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
            className="input-field flex-1"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !link.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
          >
            {saveMutation.isPending ? 'Checking link…' : 'Save favicon'}
          </button>
        </div>
      </form>

      {data?.hasFavicon && (
        <button
          onClick={() => {
            if (confirm('Remove the favicon and go back to the default icon?')) removeMutation.mutate();
          }}
          disabled={busy}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-60"
        >
          <Trash2 size={15} /> {removeMutation.isPending ? 'Removing…' : 'Remove favicon'}
        </button>
      )}
    </div>
  );
}
