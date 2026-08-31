import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { sectionStyles } from '../components/sections/sectionStyles';

const helperSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/sections/sectionStyles.ts'),
  'utf-8'
);

// The file's own comments deliberately quote the anti-pattern they warn about, so scan
// code only — otherwise the guard below fails on the documentation telling you not to
// do the thing.
const helperCode = helperSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('sectionStyles', () => {
  it('applies defaults when given nothing', () => {
    const styles = sectionStyles();
    expect(styles.section).toContain('py-20');
    expect(styles.container).toContain('max-w-5xl');
    expect(styles.grid).toContain('lg:grid-cols-3');
  });

  it('maps each option to its class', () => {
    const styles = sectionStyles({
      background: 'accent',
      paddingY: 'sm',
      maxWidth: 'narrow',
      columns: 2,
      alignment: 'center',
      dividerAbove: true,
    });

    expect(styles.section).toContain('bg-indigo-50');
    expect(styles.section).toContain('py-6');
    expect(styles.section).toContain('border-t');
    expect(styles.container).toContain('max-w-3xl');
    expect(styles.container).toContain('text-center');
    expect(styles.grid).toContain('sm:grid-cols-2');
  });

  it('falls back rather than emitting an undefined class for an unknown value', () => {
    // Stored data can outlive an enum value; a literal "undefined" in the class
    // attribute is worse than a sane default.
    const styles = sectionStyles({ paddingY: 'enormous' as never, columns: 99 });
    expect(styles.section).not.toContain('undefined');
    expect(styles.grid).not.toContain('undefined');
    expect(styles.section).toContain('py-20');
  });

  /**
   * The failure this guards against is deploy-only: Tailwind's JIT scans source text
   * and never executes code, so an interpolated class name is simply never generated
   * and gets purged from the production bundle. It looks fine in dev.
   */
  it('never builds a class name by interpolation', () => {
    const classLikeInterpolation = /['"`][a-z-]*\$\{/;
    expect(helperCode).not.toMatch(classLikeInterpolation);
  });

  it('spells out every grid-cols variant as a complete literal', () => {
    for (const literal of ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4']) {
      expect(helperSource).toContain(literal);
    }
  });
});
