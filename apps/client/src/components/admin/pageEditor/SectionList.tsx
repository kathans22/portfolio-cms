import React, { useState } from 'react';
import { SECTION_TYPES, SectionType, SECTION_TYPE_KEYS } from '@portfolio/shared';
import type { PageSection } from '@portfolio/types';
import { useDragReorder } from '../../../hooks/useDragReorder';
import {
  Plus, Eye, EyeOff, Copy, Trash2, GripVertical, X,
  LayoutTemplate, FileText, BarChart3, Megaphone, CircleCheck,
  FolderKanban, BadgeCheck, Award, Briefcase, GraduationCap,
  MessageSquare, Newspaper, Mail, FileDown, ListTree,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICONS: Record<SectionType, LucideIcon> = {
  HERO: LayoutTemplate,
  RICH_CONTENT: FileText,
  STATS_STRIP: BarChart3,
  CTA_BANNER: Megaphone,
  AVAILABILITY_BANNER: CircleCheck,
  PROJECT_LIST: FolderKanban,
  CERTIFICATION_LIST: BadgeCheck,
  SKILL_LIST: Award,
  EXPERIENCE_TIMELINE: Briefcase,
  EDUCATION_TIMELINE: GraduationCap,
  TESTIMONIAL_LIST: MessageSquare,
  BLOG_LIST: Newspaper,
  CONTACT_FORM: Mail,
  RESUME_DOWNLOAD: FileDown,
  CHILD_PAGE_LIST: ListTree,
};

const KIND_LABELS: Record<string, string> = {
  content: 'Content',
  collection: 'Collections',
  widget: 'Widgets',
  system: 'System',
};

interface SectionListProps {
  sections: PageSection[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onChange: (sections: PageSection[]) => void;
}

export function SectionList({ sections, selectedIndex, onSelect, onChange }: SectionListProps) {
  const [picking, setPicking] = useState(false);

  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useDragReorder(sections, (reordered) => onChange(reordered));

  const addSection = (type: SectionType) => {
    const next: PageSection = {
      type,
      heading: '',
      subheading: '',
      isVisible: true,
      order: sections.length,
      // The registry's first variant is the type's canonical look.
      layoutVariant: SECTION_TYPES[type].variants[0],
      styleOptions: {
        background: 'none', paddingY: 'lg', maxWidth: 'default',
        columns: 3, alignment: 'left', dividerAbove: false,
      },
      contentBlocks: [],
      items: [],
    };
    onChange([...sections, next]);
    onSelect(sections.length);
    setPicking(false);
  };

  const duplicate = (index: number) => {
    // Dropping _id makes this a new subdocument rather than a second reference to one.
    const copy = { ...sections[index], _id: undefined };
    const next = [...sections];
    next.splice(index + 1, 0, copy);
    onChange(next);
    onSelect(index + 1);
  };

  const remove = (index: number) => {
    if (!confirm('Remove this section? Nothing is saved until you save the page.')) return;
    onChange(sections.filter((_, i) => i !== index));
    onSelect(Math.max(0, index - 1));
  };

  const toggleVisible = (index: number) => {
    onChange(sections.map((s, i) => (i === index ? { ...s, isVisible: s.isVisible === false } : s)));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Sections</h2>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <ul className="flex-grow overflow-y-auto p-2 space-y-1 min-h-0">
        {sections.map((section, index) => {
          const Icon = TYPE_ICONS[section.type as SectionType] ?? FileText;
          return (
            <li key={section._id ?? index}>
              {/* The row is a div rather than the li itself: a list item can't carry the
                  button role, and the drag surface has to be the clickable element. */}
              <div
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelect(index)}
                onKeyDown={(e) => {
                  // Keyboard users still need to reach a section's config pane.
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(index);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedIndex === index}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-grab active:cursor-grabbing transition-colors ${
                  selectedIndex === index ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40' : 'hover:bg-slate-800/60'
                } ${dragIndex === index ? 'opacity-40' : ''} ${
                  overIndex === index && dragIndex !== index ? 'border-t-2 border-t-indigo-500' : ''
                }`}
              >
                <GripVertical size={12} className="text-slate-600 shrink-0" aria-hidden="true" />
                <Icon size={14} className="text-indigo-400 shrink-0" aria-hidden="true" />

                <span className="min-w-0 flex-grow">
                  <span className={`block text-xs font-semibold truncate ${section.isVisible === false ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {section.heading || SECTION_TYPES[section.type as SectionType]?.label || section.type}
                  </span>
                  <span className="block text-[10px] text-slate-500 truncate">{section.layoutVariant}</span>
                </span>

                <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleVisible(index); }}
                    aria-label={section.isVisible === false ? 'Show section' : 'Hide section'}
                    className="p-1 text-slate-400 hover:text-white rounded"
                  >
                    {section.isVisible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); duplicate(index); }}
                    aria-label="Duplicate section"
                    className="p-1 text-slate-400 hover:text-white rounded"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(index); }}
                    aria-label="Remove section"
                    className="p-1 text-red-500 hover:text-red-400 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            </li>
          );
        })}

        {sections.length === 0 && (
          <li className="text-center text-xs text-slate-500 py-10">No sections yet.</li>
        )}
      </ul>

      {picking && <SectionPicker onPick={addSection} onClose={() => setPicking(false)} />}
    </div>
  );
}

/** Grouped by kind, generated from SECTION_TYPES so a new type appears here for free. */
function SectionPicker({ onPick, onClose }: { onPick: (type: SectionType) => void; onClose: () => void }) {
  const grouped = SECTION_TYPE_KEYS.reduce((acc: Record<string, SectionType[]>, type) => {
    (acc[SECTION_TYPES[type].kind] ??= []).push(type);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>
        <h3 className="text-xl font-bold text-white mb-6">Add a section</h3>

        <div className="space-y-6">
          {Object.entries(grouped).map(([kind, types]) => (
            <div key={kind}>
              <h4 className="text-[10px] uppercase tracking-wide text-indigo-400 font-bold mb-3">
                {KIND_LABELS[kind] ?? kind}
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {types.map((type) => {
                  const Icon = TYPE_ICONS[type] ?? FileText;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onPick(type)}
                      className="flex items-center gap-3 text-left rounded-lg border border-slate-800 bg-slate-950 hover:border-indigo-500/50 px-3 py-2.5 transition-colors"
                    >
                      <Icon size={16} className="text-indigo-400 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-200">{SECTION_TYPES[type].label}</span>
                        <span className="block text-[10px] text-slate-500 truncate">
                          {SECTION_TYPES[type].variants.join(' · ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
