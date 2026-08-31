import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { ImageUploadField } from './ImageUploadField';

export interface GalleryImage {
  id?: string;
  url: string;
  caption?: string;
  altText?: string;
  order: number;
}

interface GalleryEditorProps {
  value: GalleryImage[];
  onChange: (next: GalleryImage[]) => void;
}

export function GalleryEditor({ value, onChange }: GalleryEditorProps) {
  const images = value || [];

  const update = (index: number, patch: Partial<GalleryImage>) => {
    const next = images.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i })));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = images.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((img, i) => ({ ...img, order: i })));
  };

  const addImage = () => {
    onChange([...images, { url: '', caption: '', altText: '', order: images.length }]);
  };

  return (
    <div>
      <span className="text-slate-400 text-xs font-semibold block mb-2">Gallery Images</span>
      <div className="space-y-3">
        {images.map((img, index) => (
          <div key={img.id ?? index} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex gap-4">
            {img.url && <img src={img.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-800 shrink-0" />}
            <div className="flex-grow space-y-2">
              <ImageUploadField value={img.url} onChange={(url) => update(index, { url })} label="" showPreview={false} />
              <input type="text" value={img.caption || ''} onChange={(e) => update(index, { caption: e.target.value })} className="input-field" placeholder="Caption (optional)" />
              <input type="text" value={img.altText || ''} onChange={(e) => update(index, { altText: e.target.value })} className="input-field" placeholder="Alt text (optional)" />
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move image up" className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                <ChevronUp size={16} />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label="Move image down" className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                <ChevronDown size={16} />
              </button>
              <button type="button" onClick={() => remove(index)} aria-label="Remove image" className="p-1.5 text-red-500 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addImage}
        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
      >
        <Plus size={12} /> Add gallery image
      </button>
    </div>
  );
}
