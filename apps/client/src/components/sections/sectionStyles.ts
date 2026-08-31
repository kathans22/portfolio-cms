import type { StyleOptions } from '@portfolio/types';

/**
 * Maps StyleOptions to Tailwind classes via static lookup tables.
 *
 * ⚠️ Every class name below MUST appear as a complete, literal string in this file.
 * Tailwind's JIT compiler scans source text for class names — it does not execute code.
 * A dynamically built name like `py-${size}` or `` `max-w-${width}` `` is invisible to
 * the scanner, so the class is never generated and gets purged from the production
 * bundle. It works in dev (where more of Tailwind is present) and silently loses its
 * styling only once deployed. Never interpolate a class name here.
 */

const BACKGROUND: Record<StyleOptions['background'], string> = {
  none: '',
  subtle: 'bg-slate-50 dark:bg-slate-900/40',
  accent: 'bg-indigo-50 dark:bg-indigo-500/5',
  inverted: 'bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900',
};

const PADDING_Y: Record<StyleOptions['paddingY'], string> = {
  none: 'py-0',
  sm: 'py-6',
  md: 'py-12',
  lg: 'py-20',
  xl: 'py-32',
};

const MAX_WIDTH: Record<StyleOptions['maxWidth'], string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

const ALIGNMENT: Record<StyleOptions['alignment'], string> = {
  left: 'text-left',
  center: 'text-center mx-auto',
};

// Written out per value rather than `grid-cols-${n}` — same JIT rule as above.
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

const DEFAULTS: StyleOptions = {
  background: 'none',
  paddingY: 'lg',
  maxWidth: 'default',
  columns: 3,
  alignment: 'left',
  dividerAbove: false,
};

export interface SectionClasses {
  /** Full-bleed wrapper: background and vertical rhythm. */
  section: string;
  /** Inner container: width, horizontal padding, alignment. */
  container: string;
  /** Responsive grid for collection sections. */
  grid: string;
}

export function sectionStyles(options?: Partial<StyleOptions>): SectionClasses {
  const o = { ...DEFAULTS, ...options };

  return {
    section: [
      BACKGROUND[o.background] ?? '',
      PADDING_Y[o.paddingY] ?? PADDING_Y.lg,
      o.dividerAbove ? 'border-t border-slate-200 dark:border-slate-800' : '',
    ]
      .filter(Boolean)
      .join(' '),
    container: [MAX_WIDTH[o.maxWidth] ?? MAX_WIDTH.default, 'mx-auto px-6', ALIGNMENT[o.alignment] ?? ALIGNMENT.left]
      .filter(Boolean)
      .join(' '),
    grid: `grid gap-6 ${COLUMNS[o.columns] ?? COLUMNS[3]}`,
  };
}
