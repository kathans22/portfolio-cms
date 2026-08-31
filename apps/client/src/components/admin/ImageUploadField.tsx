import React, { useId, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  showPreview?: boolean;
}

export function ImageUploadField({ value, onChange, label = 'Image URL', showPreview = true }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/media/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        onChange(data.url);
      } else {
        alert(data.error?.message || 'Upload failed');
      }
    } catch {
      alert('Upload network request failure.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      {label && <label htmlFor={inputId} className="text-slate-400 text-xs font-semibold block mb-2">{label}</label>}
      <div className="flex gap-2">
        <input id={inputId} type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-grow input-field" placeholder="https://..." />
        <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center cursor-pointer border border-slate-700">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {showPreview && value && (
        <img src={value} alt="" className="mt-3 h-24 rounded-lg border border-slate-800 object-cover" />
      )}
    </div>
  );
}
