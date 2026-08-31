import React, { useEffect, useRef, useState } from 'react';
import { isSectionType, SectionType } from '@portfolio/shared';
import type { PageSection } from '@portfolio/types';
import { sectionRegistry } from '../../sections/registry';
import { Monitor, Tablet, Smartphone, EyeOff } from 'lucide-react';

const VIEWPORTS = {
  desktop: { width: 1280, label: 'Desktop', icon: Monitor, scale: 0.6 },
  tablet: { width: 834, label: 'Tablet', icon: Tablet, scale: 0.75 },
  mobile: { width: 390, label: 'Mobile', icon: Smartphone, scale: 1 },
} as const;

type ViewportKey = keyof typeof VIEWPORTS;

interface LivePreviewProps {
  sections: PageSection[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

/**
 * Renders the *actual* public section components, not a mock. Without this every
 * content change is a guess followed by a tab switch — and a preview that drifts from
 * production is worse than none, so it shares the registry rather than reimplementing it.
 */
export function LivePreview({ sections, selectedIndex, onSelect }: LivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportKey>('desktop');
  const [showHidden, setShowHidden] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(0);

  const { width, scale } = VIEWPORTS[viewport];

  // A CSS transform scales what you see but not the space the element claims, so the
  // 1280px frame would keep reserving 1280px of layout and shove the config pane off
  // screen. Measuring the frame lets its wrapper reserve the *scaled* box instead.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFrameHeight(frame.offsetHeight));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const visible = showHidden ? sections : sections.filter((s) => s.isVisible !== false);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-1" role="group" aria-label="Preview viewport">
          {(Object.keys(VIEWPORTS) as ViewportKey[]).map((key) => {
            const Icon = VIEWPORTS[key].icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setViewport(key)}
                aria-pressed={viewport === key}
                title={`${VIEWPORTS[key].label} (${VIEWPORTS[key].width}px)`}
                className={`p-2 rounded-lg transition-colors ${
                  viewport === key ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-500 hover:text-white'
                }`}
              >
                <Icon size={15} />
              </button>
            );
          })}
          <span className="ml-2 text-[11px] text-slate-500">{width}px</span>
        </div>

        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${
            showHidden ? 'text-slate-400 bg-slate-800' : 'text-indigo-400 bg-indigo-500/10'
          }`}
        >
          <EyeOff size={12} /> {showHidden ? 'Showing hidden' : 'Hiding hidden'}
        </button>
      </div>

      <div className="flex-grow overflow-auto bg-slate-950/60 p-6 min-h-0">
        {/* Reserves the post-scale footprint so the surrounding grid stays intact.
            `dark` sits here rather than on the frame because Tailwind's class strategy
            compiles `dark:` to a *descendant* selector — an element carrying both `dark`
            and `dark:bg-*` never matches, which renders the frame white and makes the
            sections' light-on-dark text invisible rather than merely off-theme. */}
        <div
          className="dark mx-auto rounded-lg shadow-2xl overflow-hidden"
          style={{ width: width * scale, height: frameHeight ? frameHeight * scale : undefined }}
        >
          <div
            ref={frameRef}
            className="bg-white dark:bg-slate-950"
            style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {visible.length === 0 ? (
              <p className="text-center text-slate-500 py-24 text-sm">
                No sections yet. Add one from the left.
              </p>
            ) : (
              visible.map((section) => {
                const index = sections.indexOf(section);
                return (
                  <div
                    key={section._id ?? index}
                    onClick={() => onSelect(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(index);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Configure ${section.heading || section.type}`}
                    className={`relative cursor-pointer transition-shadow ${
                      selectedIndex === index
                        ? 'ring-2 ring-inset ring-indigo-500'
                        : 'hover:ring-1 hover:ring-inset hover:ring-slate-600'
                    } ${section.isVisible === false ? 'opacity-40' : ''}`}
                  >
                    {section.isVisible === false && (
                      <span className="absolute top-2 right-2 z-10 bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                        Hidden
                      </span>
                    )}
                    <PreviewSection section={section} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({ section }: { section: PageSection }) {
  if (!isSectionType(section.type)) {
    return <div className="py-8 text-center text-xs text-amber-500">Unknown section type: {section.type}</div>;
  }
  const Component = sectionRegistry[section.type as SectionType];

  // Collection sections have no resolved `items` until the page is saved and re-fetched,
  // so say so rather than rendering an empty section that looks like a mistake.
  const items = section.items ?? [];

  return (
    <>
      <Component
        heading={section.heading}
        subheading={section.subheading}
        anchorId={section.anchorId}
        layoutVariant={section.layoutVariant}
        styleOptions={section.styleOptions}
        items={items}
        contentBlocks={section.contentBlocks ?? []}
        cta={section.cta}
      />
      {items.length === 0 && section.type.endsWith('_LIST') && (
        <p className="text-center text-xs text-slate-500 pb-6">
          Content appears here once you save — the server resolves this query.
        </p>
      )}
    </>
  );
}
