import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical } from 'lucide-react';
import type { ContentBlock, CalloutBlock } from '@portfolio/shared';
import { CONTENT_BLOCK_TYPES } from '@portfolio/shared';
import { ImageUploadField } from './ImageUploadField';

function defaultBlockFor(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'paragraph':
      return { type: 'paragraph', markdown: '' };
    case 'image':
      return { type: 'image', url: '', caption: '', altText: '' };
    case 'code':
      return { type: 'code', language: 'typescript', code: '' };
    case 'callout':
      return { type: 'callout', variant: 'info', title: '', body: '' };
    case 'video':
      return { type: 'video', url: '', caption: '' };
    case 'diagram':
      return { type: 'diagram', url: '', caption: '' };
  }
}

interface ContentBlockEditorProps {
  value: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
}

export function ContentBlockEditor({ value, onChange }: ContentBlockEditorProps) {
  const blocks = value || [];

  const updateBlock = (index: number, patch: Partial<ContentBlock>) => {
    const next = blocks.slice();
    next[index] = { ...next[index], ...patch } as ContentBlock;
    onChange(next);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addBlock = (type: ContentBlock['type']) => {
    onChange([...blocks, defaultBlockFor(type)]);
  };

  return (
    <div className="space-y-4">
      <span className="text-slate-400 text-xs font-semibold block">Content Blocks</span>

      {blocks.length === 0 && (
        <p className="text-slate-500 text-xs italic py-4 text-center border border-dashed border-slate-800 rounded-lg">
          No blocks yet — falls back to the plain markdown field below. Add a block to build structured content.
        </p>
      )}

      {blocks.map((block, index) => (
        <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-400">
              <GripVertical size={14} className="text-slate-600" /> {block.type}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="Move block up" className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronUp size={16} />
              </button>
              <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label="Move block down" className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronDown size={16} />
              </button>
              <button type="button" onClick={() => removeBlock(index)} aria-label="Remove block" className="p-1.5 text-red-500 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {block.type === 'paragraph' && (
            <textarea
              rows={4}
              value={block.markdown}
              onChange={(e) => updateBlock(index, { markdown: e.target.value })}
              className="input-field"
              placeholder="Markdown text..."
            />
          )}

          {block.type === 'image' && (
            <div className="space-y-3">
              <ImageUploadField value={block.url} onChange={(url) => updateBlock(index, { url })} label="Image" />
              <input type="text" value={block.caption || ''} onChange={(e) => updateBlock(index, { caption: e.target.value })} className="input-field" placeholder="Caption (optional)" />
              <input type="text" value={block.altText || ''} onChange={(e) => updateBlock(index, { altText: e.target.value })} className="input-field" placeholder="Alt text (optional)" />
            </div>
          )}

          {block.type === 'code' && (
            <div className="space-y-3">
              <input type="text" value={block.language} onChange={(e) => updateBlock(index, { language: e.target.value })} className="input-field" placeholder="Language (e.g. typescript)" />
              <textarea
                rows={6}
                value={block.code}
                onChange={(e) => updateBlock(index, { code: e.target.value })}
                className="input-field font-mono text-xs"
                placeholder="Code..."
              />
            </div>
          )}

          {block.type === 'callout' && (
            <div className="space-y-3">
              <select value={block.variant} onChange={(e) => updateBlock(index, { variant: e.target.value as CalloutBlock['variant'] })} className="input-field">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="metric">Metric</option>
              </select>
              <input type="text" value={block.title || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="input-field" placeholder="Title (optional)" />
              <textarea rows={3} value={block.body} onChange={(e) => updateBlock(index, { body: e.target.value })} className="input-field" placeholder="Body" />
            </div>
          )}

          {block.type === 'video' && (
            <div className="space-y-3">
              <input type="text" value={block.url} onChange={(e) => updateBlock(index, { url: e.target.value })} className="input-field" placeholder="Video URL (YouTube, Vimeo, or direct file)" />
              <input type="text" value={block.caption || ''} onChange={(e) => updateBlock(index, { caption: e.target.value })} className="input-field" placeholder="Caption (optional)" />
            </div>
          )}

          {block.type === 'diagram' && (
            <div className="space-y-3">
              <ImageUploadField value={block.url} onChange={(url) => updateBlock(index, { url })} label="Diagram image" />
              <input type="text" value={block.caption || ''} onChange={(e) => updateBlock(index, { caption: e.target.value })} className="input-field" placeholder="Caption (optional)" />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {CONTENT_BLOCK_TYPES.map(({ value: type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            <Plus size={12} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
