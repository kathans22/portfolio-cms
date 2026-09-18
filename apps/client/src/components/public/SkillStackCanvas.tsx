import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { Tower, cellOf, gridDims, towerHeight } from './skillStack';

/**
 * The stack as a skyline.
 *
 * One tower per skill, height taken from its level, laid out on a block whose ordering
 * keeps each category's towers adjacent — so a district lights up as one when its
 * category is hovered in the list beside it. Certified skills carry a lit cap.
 *
 * Deliberately label-free: drawing text in WebGL means another font-atlas dependency
 * and glyphs that never quite match the page's type. The HTML list carries the words.
 *
 * Pulls in three.js (~220KB gzipped), so it is only ever reached through a React.lazy
 * boundary that mounts once the section scrolls into view — and only after the SVG
 * baseline in IsometricStack has already drawn something.
 */

const PALETTE = {
  light: {
    towerTop: '#b8b0a1',
    towerBottom: '#8d8579',
    accent: '#ae6a47',
    accentGlow: '#c07e5c',
    cap: '#c07e5c',
    grid: '#c9c2b4',
  },
  dark: {
    towerTop: '#5c564c',
    towerBottom: '#37312a',
    accent: '#c07e5c',
    accentGlow: '#debba4',
    cap: '#debba4',
    grid: '#4c463d',
  },
};

const SPACING = 0.92;
const FOOTPRINT = 0.58;
const CAP_H = 0.075;

function TowerMesh({
  tower,
  col,
  row,
  cols,
  rows,
  active,
  dimmed,
  colors,
  still,
  delay,
}: {
  tower: Tower;
  col: number;
  row: number;
  cols: number;
  rows: number;
  active: boolean;
  dimmed: boolean;
  colors: (typeof PALETTE)['light'];
  still: boolean;
  delay: number;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const grown = useRef(still ? 1 : 0);
  const elapsed = useRef(0);

  const h = towerHeight(tower.level);
  const x = (col - (cols - 1) / 2) * SPACING;
  const z = (row - (rows - 1) / 2) * SPACING;

  const bodyColor = useMemo(
    () =>
      new THREE.Color(colors.towerBottom).lerp(
        new THREE.Color(colors.towerTop),
        (tower.level - 1) / 4
      ),
    [colors.towerBottom, colors.towerTop, tower.level]
  );

  useFrame((_, delta) => {
    if (!group.current || !body.current) return;

    // Towers rise out of the ground on first reveal, staggered across the block.
    if (grown.current < 1) {
      elapsed.current += delta;
      const t = Math.max(0, Math.min(1, (elapsed.current - delay) / 0.75));
      grown.current = 1 - Math.pow(1 - t, 3);
    }

    const k = still ? 1 : Math.min(delta * 7, 1);
    const lift = active ? 0.22 : 0;

    // Scale from the base, not the centre: a building grows upward out of the ground.
    group.current.scale.y = Math.max(grown.current, 0.001);
    group.current.position.y = (h / 2) * grown.current + lift;

    body.current.emissiveIntensity = THREE.MathUtils.lerp(
      body.current.emissiveIntensity,
      active ? 0.7 : dimmed ? 0.02 : 0.1,
      k
    );
    body.current.opacity = THREE.MathUtils.lerp(body.current.opacity, dimmed ? 0.5 : 1, k);
  });

  return (
    <group ref={group} position={[x, h / 2, z]}>
      <mesh>
        <boxGeometry args={[FOOTPRINT, h, FOOTPRINT]} />
        <meshStandardMaterial
          ref={body}
          color={active ? colors.accent : bodyColor}
          emissive={colors.accentGlow}
          emissiveIntensity={0.1}
          roughness={0.5}
          metalness={0.18}
          transparent
          opacity={1}
        />
      </mesh>

      {/* A lit cap marks a credential — the same signal the list shows as "certified". */}
      {tower.certified && (
        <mesh position={[0, h / 2 + CAP_H / 2, 0]}>
          <boxGeometry args={[FOOTPRINT * 1.16, CAP_H, FOOTPRINT * 1.16]} />
          <meshStandardMaterial
            color={colors.cap}
            emissive={colors.cap}
            emissiveIntensity={active ? 1.4 : 0.6}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

function Skyline({
  towers,
  activeCategory,
  isDark,
  still,
}: {
  towers: Tower[];
  activeCategory: number | null;
  isDark: boolean;
  still: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const colors = isDark ? PALETTE.dark : PALETTE.light;
  const { cols, rows } = gridDims(towers.length);

  useFrame((_, delta) => {
    if (!group.current || still) return;
    group.current.rotation.y += delta * 0.16;
  });

  return (
    <>
      <ambientLight intensity={isDark ? 0.5 : 0.8} />
      <directionalLight position={[5, 8, 4]} intensity={isDark ? 1.0 : 1.35} />
      {/* Warm rim so the tower edges catch the palette's clay rather than white. */}
      <pointLight
        position={[-4, 2.5, -3]}
        intensity={isDark ? 18 : 10}
        color={colors.accentGlow}
        distance={16}
      />

      <group ref={group} rotation={[0, 0.6, 0]} position={[0, -1.15, 0]}>
        <gridHelper
          args={[Math.max(cols, rows) * SPACING + 2.4, 14, colors.grid, colors.grid]}
          position={[0, 0, 0]}
          material-transparent
          material-opacity={0.3}
        />

        {towers.map((tower, i) => {
          const { col, row } = cellOf(i, cols);
          return (
            <TowerMesh
              key={tower.id}
              tower={tower}
              col={col}
              row={row}
              cols={cols}
              rows={rows}
              active={activeCategory === tower.categoryIndex}
              dimmed={activeCategory !== null && activeCategory !== tower.categoryIndex}
              colors={colors}
              still={still}
              // Diagonal stagger, so the block builds from one corner outward.
              delay={(col + row) * 0.07}
            />
          );
        })}
      </group>
    </>
  );
}

export interface SkillStackCanvasProps {
  towers: Tower[];
  /** Index of the category being hovered in the list, or null for none. */
  activeCategory: number | null;
  /**
   * Fired once the GL context is actually up. The parent keeps the SVG baseline visible
   * until this lands, so a context that never initialises leaves a drawn panel rather
   * than an empty one.
   */
  onReady?: () => void;
}

export default function SkillStackCanvas({
  towers,
  activeCategory,
  onReady,
}: SkillStackCanvasProps) {
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();

  return (
    <Canvas
      // Capped DPR: a retina canvas at devicePixelRatio 3 quadruples the fragment work
      // for a decorative object nobody is inspecting pixel-close.
      dpr={[1, 2]}
      camera={{ position: [7.4, 5.4, 7.4], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
      onCreated={({ gl }) => {
        if (!gl.getContext().isContextLost()) onReady?.();
      }}
    >
      <Skyline
        towers={towers}
        activeCategory={activeCategory}
        isDark={theme === 'dark'}
        still={!!reduceMotion}
      />
    </Canvas>
  );
}
