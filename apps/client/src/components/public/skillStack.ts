/**
 * Shared geometry for the skills skyline.
 *
 * Both renderers — the WebGL scene and the SVG baseline — read their layout from here,
 * so the two can never drift into showing a different city.
 */

export interface Tower {
  id: string;
  name: string;
  /** 1–5 self-rating; drives tower height. */
  level: number;
  certified: boolean;
  /** Index into the category list, so a whole district can be lit at once. */
  categoryIndex: number;
}

/** Roughly square block. Skills arrive ordered by category, so districts stay adjacent. */
export function gridDims(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  return { cols, rows: Math.ceil(count / cols) };
}

export function cellOf(index: number, cols: number) {
  return { col: index % cols, row: Math.floor(index / cols) };
}

/**
 * Height in scene units. The floor matters: a level-1 tower still has to read as a
 * building rather than a paving slab, so the scale starts well above zero.
 */
export function towerHeight(level: number) {
  return 0.45 + Math.max(1, Math.min(5, level)) * 0.42;
}
