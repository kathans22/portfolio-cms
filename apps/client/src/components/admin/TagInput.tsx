import React, { useId, useState } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  placeholder?: string;
}

export function TagInput({ value, onChange, label = 'Tags', placeholder = 'Type and press Enter' }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputId = useId();

  const addTag = () => {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div>
      <label htmlFor={inputId} className="text-slate-400 text-xs font-semibold block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg min-h-[46px]">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded-md">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="hover:text-red-400">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-grow min-w-[120px] bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
