import React, { useEffect, useRef, useState } from 'react';
import { Location, useLocation, useNavigationType } from 'react-router-dom';

/**
 * Site-wide route transition: a runner crosses to a labelled door, the door swings
 * shut, the page swaps behind it, and it swings open in 3D onto the new route.
 *
 * The navigation itself is never delayed — React Router changes `location` the moment
 * a link is clicked. What's deferred is *what the router renders*: `<Routes>` is fed
 * `displayLocation`, which only catches up once the door is closed. So the old page
 * stays on screen while the door shuts, and the new one is already mounted when it
 * opens. Intercepting clicks to delay navigation instead would break middle-click,
 * cmd-click and the back button.
 *
 * Pure CSS/SVG — no WebGL, so it also runs on machines with hardware acceleration off.
 */

export type DoorPhase = 'idle' | 'closing' | 'running' | 'opening';

/** ~800ms end to end. Long enough to read, short enough to sit through repeatedly. */
export const DOOR_TIMING = { closing: 260, running: 220, opening: 320 } as const;
export const DOOR_TOTAL =
  DOOR_TIMING.closing + DOOR_TIMING.running + DOOR_TIMING.opening;

/**
 * What the door is labelled. Most specific first — `/projects/slug` is a PROJECT, and
 * only a bare `/projects` is the index.
 */
const DOOR_LABELS: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/projects\/.+/, 'Project'],
  [/^\/projects\/?$/, 'Projects'],
  [/^\/blog\/.+/, 'Article'],
  [/^\/blog\/?$/, 'Blog'],
  [/^\/certifications/, 'Credentials'],
  [/^\/about/, 'Résumé'],
  [/^\/contact/, 'Contact'],
  [/^\/admin/, 'Studio'],
];

export function doorLabelFor(pathname: string): string {
  for (const [pattern, label] of DOOR_LABELS) {
    if (pattern.test(pathname)) return label;
  }
  // CMS-authored routes aren't known here, so fall back to the last path segment.
  const segment = pathname.split('/').filter(Boolean).pop() ?? 'Page';
  return segment.replace(/[-_]/g, ' ');
}

/**
 * Read live rather than through framer's `useReducedMotion`.
 *
 * That hook resolves once and its value was observed going stale when the preference
 * changed after mount, which let the whole sequence play for someone who had asked for
 * reduced motion. This is only consulted at the instant a navigation starts, so a
 * point-in-time read is both correct and always current.
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useDoorTransition() {
  const location = useLocation();
  const navigationType = useNavigationType();

  const [displayLocation, setDisplayLocation] = useState<Location>(location);
  const [phase, setPhase] = useState<DoorPhase>('idle');
  const [label, setLabel] = useState('');

  // Compared against a ref, not the state: this effect must depend on `location`
  // alone, or swapping `displayLocation` mid-sequence would re-run it and its cleanup
  // would cancel the timers still driving the animation.
  const displayRef = useRef(location);

  useEffect(() => {
    if (location.key === displayRef.current.key) return;

    const swap = () => {
      displayRef.current = location;
      setDisplayLocation(location);
    };

    // Back/forward should feel instant — the page is already in the user's history,
    // and an animation there reads as lag rather than polish.
    if (navigationType === 'POP' || prefersReducedMotion()) {
      swap();
      // Synchronizing to browser history navigation (an external system), not deriving
      // state from props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('idle');
      return;
    }

    setLabel(doorLabelFor(location.pathname));
    setPhase('closing');

    const timers = [
      window.setTimeout(() => {
        swap();
        setPhase('running');
      }, DOOR_TIMING.closing),
      window.setTimeout(
        () => setPhase('opening'),
        DOOR_TIMING.closing + DOOR_TIMING.running
      ),
      window.setTimeout(() => setPhase('idle'), DOOR_TOTAL),
    ];

    // A new navigation mid-sequence cancels this one and starts over.
    return () => timers.forEach(clearTimeout);
  }, [location, navigationType]);

  return { displayLocation, phase, label };
}

/** Minimal two-frame run cycle. A stick figure at speed reads as a runner. */
function Runner() {
  return (
    <svg viewBox="0 0 60 76" className="door-runner-svg" aria-hidden focusable="false">
      {/* speed trails */}
      <g className="door-trail" stroke="currentColor" strokeLinecap="round">
        <line x1="2" y1="30" x2="18" y2="30" strokeWidth="2" opacity="0.55" />
        <line x1="0" y1="40" x2="14" y2="40" strokeWidth="1.5" opacity="0.35" />
        <line x1="4" y1="50" x2="16" y2="50" strokeWidth="1.5" opacity="0.25" />
      </g>

      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none">
        {/* pose A */}
        <g className="door-pose-a">
          <circle cx="38" cy="12" r="6" fill="currentColor" stroke="none" />
          <path d="M36 20 L33 42" />
          <path d="M33 42 L24 60 L20 72" />
          <path d="M33 42 L44 56 L52 62" />
          <path d="M36 26 L46 32" />
          <path d="M36 27 L25 34" />
        </g>
        {/* pose B — opposite stride */}
        <g className="door-pose-b">
          <circle cx="38" cy="12" r="6" fill="currentColor" stroke="none" />
          <path d="M36 20 L34 42" />
          <path d="M34 42 L44 58 L50 70" />
          <path d="M34 42 L25 55 L18 58" />
          <path d="M36 26 L27 33" />
          <path d="M36 27 L47 33" />
        </g>
      </g>
    </svg>
  );
}

export function DoorOverlay({ phase, label }: { phase: DoorPhase; label: string }) {
  if (phase === 'idle') return null;

  const opening = phase === 'opening';

  return (
    <div
      // Decorative: the route change itself is what matters to assistive tech, and
      // announcing a door would be noise.
      aria-hidden="true"
      className="door-overlay"
      // Blocks stray clicks on a page that is mid-swap, but only while it is up.
      style={{ pointerEvents: opening ? 'none' : 'auto' }}
    >
      <div className="door-stage">
        <div className={`door-panel door-panel--left ${opening ? 'is-opening' : ''}`}>
          <span className="door-handle" />
        </div>
        <div className={`door-panel door-panel--right ${opening ? 'is-opening' : ''}`}>
          <span className="door-handle" />
        </div>

        <div className={`door-seam ${opening ? 'is-opening' : ''}`} />

        <div className={`door-label ${opening ? 'is-opening' : ''}`}>
          <span className="door-label-rule" />
          {label}
          <span className="door-label-rule" />
        </div>

        <div className={`door-runner-track ${opening ? 'is-opening' : ''}`}>
          <div className="door-runner">
            <Runner />
          </div>
        </div>
      </div>
    </div>
  );
}
