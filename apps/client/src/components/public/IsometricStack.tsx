import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Tower, cellOf, gridDims, towerHeight } from './skillStack';

/**
 * The skills skyline drawn as plain SVG.
 *
 * This is the *baseline*, not a degraded mode: it renders with no WebGL, no three.js
 * chunk and no GPU, so the panel is never an empty box. The WebGL version fades in on
 * top of it only once its context is confirmed alive — see CoreTechnology.
 *
 * Worth having because WebGL is far from guaranteed: hardware acceleration switched off
 * (the cause of a real empty-panel report here), a blocklisted GPU, a locked-down
 * browser profile, or a slow network that never finishes the chunk all land in the same
 * place. It reads the same layout module as the WebGL scene, so both draw one city.
 */

/** 2:1 isometric — the classic projection, and the one that reads cleanest. */
const HALF_W = 26;
const HALF_H = 13;
const UNIT = 34; // scene-unit → px, for tower height

const PALETTE = {
  light: { top: '#b8b0a1', bottom: '#8d8579', edge: '#6b6459', grid: '#d6d1c4' },
  dark: { top: '#5c564c', bottom: '#37312a', edge: '#a39c8d', grid: '#3a3329' },
};
const ACCENT = { top: '#c07e5c', side: '#ae6a47', dark: '#8c4d31', edge: '#debba4' };
const CAP = { light: '#c07e5c', dark: '#debba4' };

function mix(a: string, b: string, t: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to(r1 + (r2 - r1) * t)}${to(g1 + (g2 - g1) * t)}${to(b1 + (b2 - b1) * t)}`;
}

const shade = (hex: string, amount: number) => mix(hex, '#000000', amount);

export function IsometricStack({
  towers,
  activeCategory,
}: {
  towers: Tower[];
  activeCategory: number | null;
}) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? PALETTE.dark : PALETTE.light;
  const capColor = theme === 'dark' ? CAP.dark : CAP.light;
  const { cols, rows } = gridDims(towers.length);

  const tallest = towers.reduce((m, t) => Math.max(m, towerHeight(t.level)), 1) * UNIT;
  const width = (cols + rows) * HALF_W + 70;
  const height = (cols + rows) * HALF_H + tallest + 80;
  const originX = width / 2;
  const originY = height - (cols + rows) * HALF_H * 0.5 - 40;

  const project = (col: number, row: number) => ({
    x: originX + (col - row) * HALF_W,
    y: originY + (col + row) * HALF_H,
  });

  // Painter's algorithm: nearer cells (larger col+row) must paint over farther ones.
  const ordered = towers
    .map((tower, i) => ({ tower, ...cellOf(i, cols) }))
    .sort((a, b) => a.col + a.row - (b.col + b.row));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Skyline of ${towers.length} technologies, tower height showing proficiency`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ground grid, matching the gridHelper in the WebGL scene */}
      <g stroke={colors.grid} strokeWidth="1" opacity="0.55">
        {Array.from({ length: rows + 1 }, (_, r) => {
          const a = project(-0.5, r - 0.5);
          const b = project(cols - 0.5, r - 0.5);
          return <line key={`r${r}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
        {Array.from({ length: cols + 1 }, (_, c) => {
          const a = project(c - 0.5, -0.5);
          const b = project(c - 0.5, rows - 0.5);
          return <line key={`c${c}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      {ordered.map(({ tower, col, row }) => {
        const active = activeCategory === tower.categoryIndex;
        const dimmed = activeCategory !== null && !active;
        const { x: gx } = project(col, row);
        const gy = project(col, row).y - (active ? 8 : 0);
        const t = towerHeight(tower.level) * UNIT;

        const base = mix(colors.bottom, colors.top, (tower.level - 1) / 4);
        const top = active ? ACCENT.top : base;
        const left = active ? ACCENT.side : shade(top, 0.24);
        const right = active ? ACCENT.dark : shade(top, 0.4);

        const w = HALF_W * 0.62;
        const h = HALF_H * 0.62;
        const capT = 7;

        return (
          <g key={tower.id} opacity={dimmed ? 0.45 : 1}>
            {/* left face */}
            <polygon
              points={`${gx - w},${gy - t} ${gx},${gy - t + h} ${gx},${gy + h} ${gx - w},${gy}`}
              fill={left}
            />
            {/* right face */}
            <polygon
              points={`${gx},${gy - t + h} ${gx + w},${gy - t} ${gx + w},${gy} ${gx},${gy + h}`}
              fill={right}
            />
            {/* roof */}
            <polygon
              points={`${gx},${gy - t - h} ${gx + w},${gy - t} ${gx},${gy - t + h} ${gx - w},${gy - t}`}
              fill={top}
              stroke={active ? ACCENT.edge : colors.edge}
              strokeWidth={active ? 1.2 : 0.6}
              strokeOpacity={active ? 0.9 : 0.3}
            />
            {/* lit cap = holds a credential, mirroring the list's "certified" flag */}
            {tower.certified && (
              <polygon
                points={`${gx},${gy - t - h - capT} ${gx + w * 1.16},${gy - t - capT} ${gx},${gy - t + h - capT} ${gx - w * 1.16},${gy - t - capT}`}
                fill={capColor}
                stroke={capColor}
                strokeWidth="2"
                strokeOpacity="0.35"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
