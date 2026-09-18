import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Resume } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { Upload, CheckCircle2, Circle, Trash2, ExternalLink, Pencil, AlertCircle, FileText } from 'lucide-react';

function formatSize(bytes?: number) {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ResumeManager() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const { data: resumes } = useQuery<Resume[]>({
    queryKey: ['adminResumes'],
    queryFn: async () => (await apiFetch('/admin/resume')).json(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adminResumes'] });
    queryClient.invalidateQueries({ queryKey: ['publicResume'] });
  };

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/admin/resume/${id}/activate`, { method: 'PATCH' });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Failed to activate');
    },
    onSuccess: invalidate,
    onError: (err: Error) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/admin/resume/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error((await res.json()).error?.message || 'Failed to delete');
    },
    onSuccess: invalidate,
    onError: (err: Error) => alert(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const res = await apiFetch(`/admin/resume/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) });
      if (!res.ok) throw new Error((await res.json()).error?.message || 'Failed to rename');
    },
    onSuccess: invalidate,
    onError: (err: Error) => alert(err.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/admin/resume/upload', { method: 'POST', body: formData });
      if (res.ok) {
        invalidate();
      } else {
        setError((await res.json()).error?.message || 'Upload failed');
      }
    } catch {
      setError('Connection failure uploading the file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRename = (resume: Resume) => {
    const label = prompt('Label for this resume (helps you tell versions apart):', resume.label ?? '');
    if (label === null) return;
    renameMutation.mutate({ id: resume.id, label: label.trim() });
  };

  const handleDelete = (resume: Resume) => {
    if (resume.isActive) {
      alert('This resume is live on the site. Activate a different one before deleting it.');
      return;
    }
    if (confirm('Delete this resume version? The file is removed from storage and cannot be recovered.')) {
      deleteMutation.mutate(resume.id);
    }
  };

  const rows = resumes ?? [];
  const hasActive = rows.some((r) => r.isActive);

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Resume</h1>
          <p className="text-slate-400 text-sm">
            Upload PDF versions of your CV. The one marked <span className="text-emerald-400 font-semibold">Active</span> is
            what visitors download from your portfolio.
          </p>
        </div>
        <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors">
          <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload PDF'}
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {rows.length > 0 && !hasActive && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> No resume is active — your portfolio currently has no CV to download. Activate one below.
        </div>
      )}

      {rows.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Label / File</th>
                <th className="p-4">Size</th>
                <th className="p-4">Uploaded</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((resume) => (
                <tr key={resume.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-950/20">
                  <td className="p-4">
                    {resume.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <CheckCircle2 size={14} /> Active
                      </span>
                    ) : (
                      <button
                        onClick={() => activateMutation.mutate(resume.id)}
                        disabled={activateMutation.isPending}
                        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold disabled:opacity-50"
                      >
                        <Circle size={14} /> Activate
                      </button>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-white">{resume.label || <span className="text-slate-500 font-normal italic">No label</span>}</div>
                    <div className="text-xs text-slate-500">{resume.originalName}</div>
                  </td>
                  <td className="p-4 text-slate-400">{formatSize(resume.fileSize)}</td>
                  <td className="p-4 text-slate-400">{formatDate(resume.createdAt)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={resume.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open this PDF"
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button onClick={() => handleRename(resume)} aria-label="Rename" className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(resume)}
                        disabled={resume.isActive}
                        aria-label="Delete"
                        className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-800 rounded-xl p-16 flex flex-col items-center justify-center text-slate-500">
          <FileText size={40} className="mb-4 opacity-40" />
          <p className="text-sm">No resume uploaded yet. Upload a PDF — the first one goes live automatically.</p>
        </div>
      )}
    </div>
  );
}
