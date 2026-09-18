import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, assetUrl } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { ImageIcon, Link2, Trash2, Upload, X } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface ProfilePhoto {
  url: string;
  source: 'upload' | 'link';
  /** For links: what was pasted, shown back so it's clear where the photo comes from. */
  sourceUrl?: string;
  updatedAt: string;
}

/**
 * Manages the home page portrait. Choosing a file shows it beside the current photo
 * before anything is sent, because saving permanently deletes the one it replaces.
 */
export function ProfilePhotoManager() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [link, setLink] = useState('');

  const { data: current, isLoading } = useQuery<ProfilePhoto | null>({
    queryKey: ['profilePhoto'],
    queryFn: async () => {
      const res = await apiFetch('/profile-photo');
      return res.status === 200 ? res.json() : null;
    },
  });

  // Object URLs hold the file in memory until revoked.
  useEffect(() => {
    if (!pending) {
      // Synchronizing to the browser's Blob URL registry (an external system), not
      // deriving UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pending);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const clearPending = () => {
    setPending(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploadMutation = useMutation<ProfilePhoto, Error, File>({
    mutationFn: async (file) => {
      const body = new FormData();
      body.append('file', file);
      const res = await apiFetch('/profile-photo', { method: 'POST', body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (photo) => {
      queryClient.setQueryData(['profilePhoto'], photo);
      clearPending();
      showToast('success', 'Photo updated. The previous one was deleted.');
    },
    onError: (err) => showToast('error', err.message),
  });

  const linkMutation = useMutation<ProfilePhoto, Error, string>({
    mutationFn: async (url) => {
      const res = await apiFetch('/profile-photo/link', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Field-level zod errors (e.g. "must start with https://") arrive in details.
        throw new Error(err.error?.details?.[0]?.message || err.error?.message || 'Could not use that link');
      }
      return res.json();
    },
    onSuccess: (photo) => {
      queryClient.setQueryData(['profilePhoto'], photo);
      setLink('');
      showToast(
        'success',
        current?.source === 'upload' ? 'Photo updated. The previously uploaded file was deleted.' : 'Photo updated.'
      );
    },
    onError: (err) => showToast('error', err.message),
  });

  const removeMutation = useMutation<void, Error>({
    mutationFn: async () => {
      const res = await apiFetch('/profile-photo', { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Could not remove the photo');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['profilePhoto'], null);
      showToast('success', 'Photo removed.');
    },
    onError: (err) => showToast('error', err.message),
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Fast feedback only — the server re-checks the actual bytes.
    if (!ACCEPTED.includes(file.type)) {
      showToast('error', 'Please choose a JPEG, PNG or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast('error', 'That image is over 5MB.');
      e.target.value = '';
      return;
    }
    setPending(file);
  };

  const busy = uploadMutation.isPending || removeMutation.isPending || linkMutation.isPending;

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-xl space-y-6">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
          <ImageIcon size={18} className="text-indigo-400" /> Home page photo
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Shown in the hero on the first page. JPEG, PNG or WebP, up to 5MB — square works best.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <figure className="space-y-2">
          <figcaption className="text-xs font-semibold text-slate-400">Current</figcaption>
          <div className="h-36 w-36 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            {isLoading ? (
              <div className="h-full w-full animate-pulse bg-slate-800/60" />
            ) : current ? (
              <img
                src={assetUrl(current.url)}
                alt="Current portrait"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-3 text-center text-[11px] text-slate-500">
                None uploaded — the site shows its default image
              </div>
            )}
          </div>
          {current && (
            <p className="font-mono text-[10px] text-slate-500">
              {current.source === 'link' ? 'From a link · ' : 'Uploaded · '}
              {new Date(current.updatedAt).toLocaleDateString()}
            </p>
          )}
          {current?.source === 'link' && current.sourceUrl && (
            <a
              href={current.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-[9rem] truncate font-mono text-[10px] text-indigo-400 hover:underline"
              title={current.sourceUrl}
            >
              {current.sourceUrl}
            </a>
          )}
        </figure>

        {previewUrl && (
          <figure className="space-y-2">
            <figcaption className="text-xs font-semibold text-indigo-300">New</figcaption>
            <div className="h-36 w-36 overflow-hidden rounded-xl border-2 border-indigo-500/60 bg-slate-950">
              <img src={previewUrl} alt="Selected replacement" className="h-full w-full object-cover" />
            </div>
            <p className="max-w-[9rem] truncate font-mono text-[10px] text-slate-500">{pending?.name}</p>
          </figure>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={onPick}
        className="hidden"
        id="profile-photo-input"
      />

      {pending ? (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4">
          {current && (
            <p className="text-xs text-amber-200">
              Saving replaces the current photo and permanently deletes it from storage.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => uploadMutation.mutate(pending)}
              disabled={busy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-60"
            >
              <Upload size={15} /> {uploadMutation.isPending ? 'Uploading…' : current ? 'Replace photo' : 'Save photo'}
            </button>
            <button
              type="button"
              onClick={clearPending}
              disabled={busy}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg flex items-center gap-1.5 disabled:opacity-60"
            >
              <X size={15} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <label
            htmlFor="profile-photo-input"
            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            <Upload size={15} /> {current ? 'Choose a new photo' : 'Upload a photo'}
          </label>
          {current && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove the home page photo? The file will be permanently deleted.')) {
                  removeMutation.mutate();
                }
              }}
              disabled={busy}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-60"
            >
              <Trash2 size={15} /> {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      )}

      {/* ---- or: an image link ---- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) linkMutation.mutate(link.trim());
        }}
        className="space-y-3 border-t border-slate-800 pt-6"
      >
        <label htmlFor="profile-photo-link" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Link2 size={15} className="text-indigo-400" /> Or use an image link
        </label>
        <p className="text-xs leading-relaxed text-slate-400">
          Paste a Google Drive link — in Drive, click <span className="text-slate-300">Share</span> and set
          General access to <span className="text-slate-300">&ldquo;Anyone with the link&rdquo;</span>. Any
          direct https image link works too. It&apos;s checked before it goes live.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="profile-photo-link"
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
            <Link2 size={15} /> {linkMutation.isPending ? 'Checking link…' : 'Use this link'}
          </button>
        </div>
        {current?.source === 'upload' && (
          <p className="text-xs text-amber-200/90">
            Using a link permanently deletes the photo you uploaded.
          </p>
        )}
      </form>
    </div>
  );
}
