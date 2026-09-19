import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Highlight, themes } from 'prism-react-renderer';
import type { Project } from '@portfolio/types';
import { apiFetch, assetUrl } from '../../lib/api';
import { ArrowRight, Terminal, GitBranch, Sparkles } from 'lucide-react';

const NAME = 'Kathan Shah';
const HANDLE = '@kathanshah';

// Fallbacks, in order, used only when no photo has been uploaded in the admin (or the
// uploaded one fails to load). The admin upload is always tried first.
const FALLBACK_PHOTOS = [
  '/hero.jpg',
  '/hero.png',
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=640&h=640&q=80&auto=format&fit=crop',
];

// Rotating phrases for the typed line under the name.
const TYPED = [
  'APIs that scale.',
  '3D interfaces.',
  'Delightful DX.',
  'Systems that ship.',
];

// The snippet rendered in the tilting editor window.
// Every claim here is checkable against the résumé PDF — see the reference notes.
// "1.4M+ orders" is the real headline number; an inflated years count was here once
// and contradicted his own CV.
const CODE = `const kathan: Developer = {
  role:   "Full-Stack Engineer",
  city:   "Surat, IN",
  stack:  ["React", "Node", "Py", "FastAPI"],
  focus:  ["APIs", "3D UI/UX"],
  shipped: "SaaS builds",
  openToWork: true,
};

export default kathan;`;

const TERMINAL_LINES: { cmd: string; out: string | null }[] = [
  { cmd: 'whoami', out: 'kathan-shah' },
  { cmd: 'cat pitch.txt', out: 'builds things that ship' },
  { cmd: './hire-me --now', out: null },
];

type PanelKey = 'editor' | 'terminal' | 'photo';

// Each window keeps a fixed spot in the collage (its content stays readable). Click
// one and it flies toward the viewer and in to the centre — bigger, straightened,
// on top; the other two settle back at their resting depth / tilt.
const PANEL_REST: Record<PanelKey, { rotate: number; depth: number; zIndex: number }> = {
  editor: { rotate: -1, depth: 0, zIndex: 20 },
  terminal: { rotate: -4, depth: -38, zIndex: 10 },
  photo: { rotate: 3, depth: 22, zIndex: 15 },
};
const PANEL_ACTIVE = { rotate: 0, depth: 58, scale: 1.06, zIndex: 40 };

// Where a promoted window travels to, in px. The collage is laid out differently on
// narrow screens (editor on top, terminal and photo side by side underneath), so the
// "fly to the middle" vector differs too.
const ACTIVE_OFFSET: Record<'wide' | 'narrow', Record<PanelKey, [number, number]>> = {
  wide: { editor: [8, 0], terminal: [84, -140], photo: [-116, 104] },
  narrow: { editor: [0, 30], terminal: [26, -130], photo: [-96, -130] },
};

/**
 * Types out the current phrase, holds it, erases it, moves to the next — forever.
 *
 * `live` is true only while glyphs are actually moving, so the UI around it can show
 * a streaming state and settle to "ready" during the hold, the way an agent CLI does.
 */
function useTypewriter(words: string[], enabled: boolean) {
  const [text, setText] = useState(enabled ? '' : words[0]);
  const [live, setLive] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = words[wordIndex];
      charIndex += deleting ? -1 : 1;
      setText(word.slice(0, charIndex));

      let delay = deleting ? 40 : 78;
      if (!deleting && charIndex === word.length) {
        // Answer complete — hold it and drop out of the streaming state.
        delay = 1900;
        deleting = true;
        setLive(false);
      } else {
        setLive(true);
        if (deleting && charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          delay = 320;
        }
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [words, enabled]);

  return { text, live };
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const { text: typed, live: streaming } = useTypewriter(TYPED, !reduceMotion);

  // The portrait managed from Admin → Settings. 204 means none has been uploaded.
  const { data: managedPhoto } = useQuery<{ url: string; updatedAt: string } | null>({
    queryKey: ['profilePhoto'],
    queryFn: async () => {
      const res = await apiFetch('/profile-photo');
      return res.status === 200 ? res.json() : null;
    },
    staleTime: 5 * 60_000,
  });
  const photoSources = managedPhoto
    ? [assetUrl(managedPhoto.url), ...FALLBACK_PHOTOS]
    : FALLBACK_PHOTOS;

  const [photoIdx, setPhotoIdx] = useState(0);
  // A newly arrived source list must start again from its first entry, or a stale index
  // from the fallback list would skip straight past the uploaded photo. Adjusted during
  // render, per React's guidance for resetting state when a prop/query result changes,
  // rather than in an effect.
  const [lastPhotoUrl, setLastPhotoUrl] = useState(managedPhoto?.url);
  if (managedPhoto?.url !== lastPhotoUrl) {
    setLastPhotoUrl(managedPhoto?.url);
    setPhotoIdx(0);
  }

  // Same queryKey Home uses, so React Query serves both from one cached fetch rather
  // than issuing a second request for a number in a badge.
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => (await apiFetch('/projects')).json(),
    staleTime: 5 * 60_000,
  });
  const projectCount = projects?.length ?? 0;

  // Which window sits at the front of the deck. Clicking any window promotes it;
  // the other two settle back to their resting depth and tilt.
  const [active, setActive] = useState<PanelKey>('editor');

  // The deck's collage differs below `sm`, so the promote-to-front vector does too.
  // Read from matchMedia rather than a resize handler — it only fires on the boundary.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Shared click / keyboard / motion wiring for a deck window.
  const panelProps = (key: PanelKey) => {
    const isActive = active === key;
    const rest = PANEL_REST[key];
    const [activeX, activeY] = ACTIVE_OFFSET[narrow ? 'narrow' : 'wide'][key];
    return {
      onClick: () => setActive(key),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActive(key);
        }
      },
      role: 'button',
      tabIndex: 0,
      'aria-pressed': isActive,
      'aria-label': `Bring the ${key} window to the front`,
      style: { zIndex: isActive ? PANEL_ACTIVE.zIndex : rest.zIndex },
      animate: {
        x: isActive ? activeX : 0,
        y: isActive ? activeY : 0,
        rotateZ: isActive ? PANEL_ACTIVE.rotate : rest.rotate,
        z: isActive ? PANEL_ACTIVE.depth : rest.depth,
        scale: isActive ? PANEL_ACTIVE.scale : 0.96,
        opacity: isActive ? 1 : 0.86,
      },
      whileHover:
        reduceMotion || isActive ? undefined : { scale: 1, opacity: 1, z: rest.depth + 22 },
      transition: reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 220, damping: 24 },
    };
  };

  // Pointer position, normalised to [-0.5, 0.5] over the stage.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const spring = { stiffness: 120, damping: 18, mass: 0.5 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), spring);

  // Layers translate against the tilt for parallax depth.
  const gridX = useSpring(useTransform(px, [-0.5, 0.5], [18, -18]), spring);
  const gridY = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), spring);

  // Cursor sheen that glides across the editor glass.
  const sheenX = useTransform(px, (v) => `${(v + 0.5) * 100}%`);
  const sheenY = useTransform(py, (v) => `${(v + 0.5) * 100}%`);
  const sheen = useMotionTemplate`radial-gradient(340px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.10), transparent 60%)`;

  const handleMove = (e: React.MouseEvent) => {
    if (reduceMotion || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const resetTilt = () => {
    px.set(0);
    py.set(0);
  };

  const tilt = reduceMotion
    ? undefined
    : { rotateX, rotateY, transformStyle: 'preserve-3d' as const };

  return (
    <section className="relative overflow-hidden">
      {/* ambient depth: warm glow + a parallaxing engineer's dot grid */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-[34rem] w-[34rem] rounded-full bg-indigo-300/25 blur-[130px] dark:bg-indigo-600/[0.10]" />
      <motion.div
        style={reduceMotion ? undefined : { x: gridX, y: gridY }}
        className="dot-grid pointer-events-none absolute inset-0 -m-8 text-slate-300/60 [mask-image:radial-gradient(60%_50%_at_70%_25%,#000,transparent)] dark:text-slate-700/50"
      />

      <div className="container-wide relative grid grid-cols-1 items-center gap-24 pb-28 pt-32 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[0.92fr_1.1fr] lg:gap-10 lg:pt-24">
        {/* ---- statement ---- */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="kicker inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Available for work
          </span>

          <h1 className="mt-6 font-bold leading-[1.02] tracking-tight text-slate-900 dark:text-white text-[3rem] sm:text-6xl lg:text-[4.5rem] xl:text-[5rem]">
            {NAME}
          </h1>

          {/* Agent-CLI answer panel. Deliberately a dark terminal surface in both
              themes so it reads as the same material as the code windows opposite,
              and so the streaming shimmer has something to glow against. */}
          <div
            className={`relative mt-7 w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition-shadow duration-700 dark:bg-slate-900 ${
              streaming
                ? 'shadow-[0_0_0_1px_rgba(174,106,71,0.35),0_20px_44px_-18px_rgba(174,106,71,0.5)]'
                : 'shadow-lift'
            }`}
          >
            {/* accent rail down the left edge */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-indigo-500/0 via-indigo-500 to-emerald-500/0"
            />
            {/* glass rim along the top edge */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />

            {/* session strip */}
            <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] py-1.5 pl-4 pr-2.5">
              <span
                aria-hidden
                className={`text-[12px] leading-none text-indigo-400 ${
                  streaming ? 'motion-safe:animate-agent-spin' : ''
                }`}
              >
                ✳
              </span>
              <span className="font-mono text-[10.5px] tracking-wide text-slate-500">~/dev</span>
              <span
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] transition-colors ${
                  streaming
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'bg-emerald-500/15 text-emerald-300'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    streaming ? 'bg-indigo-400 motion-safe:animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                {streaming ? 'streaming' : 'ready'}
              </span>
            </div>

            {/* the answer */}
            {/* No flex `gap` here: the caret has to sit hard against the last glyph
                the way a real terminal cursor does. */}
            <div className="flex items-center py-3 pl-4 pr-3">
              <span aria-hidden className="mr-2.5 font-mono text-sm font-semibold text-emerald-400">
                ❯
              </span>
              {/* aria-live off: this rewrites itself constantly and would flood a screen reader */}
              <span
                aria-live="off"
                className={`agent-stream font-mono text-[15px] leading-tight sm:text-[17px] ${
                  streaming ? 'is-live' : ''
                }`}
              >
                {typed || ' '}
              </span>
              <span
                aria-hidden
                className="ml-1 inline-block h-[1.05em] w-[7px] shrink-0 rounded-[1px] bg-indigo-400 shadow-[0_0_12px_rgba(192,126,92,0.75)] motion-safe:animate-blink"
              />
            </div>
          </div>

          <p className="mt-7 max-w-md font-heading text-2xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Clean commits. <span className="text-indigo-600 dark:text-indigo-400">Loud results.</span>
          </p>
          {/* Three beats revealed in sequence — dream, build, scale — with the last one
              landing in the accent colour. Static under reduced motion. */}
          <p
            aria-label="You dream it. I build it. It scales."
            className="mt-3 flex flex-wrap gap-x-2 font-heading text-base font-medium text-slate-500 dark:text-slate-400 sm:text-lg"
          >
            {['You dream it.', 'I build it.', 'It scales.'].map((beat, i) => (
              <motion.span
                key={beat}
                aria-hidden
                initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, delay: 0.9 + i * 0.55, ease: [0.22, 1, 0.36, 1] }}
                className={i === 2 ? 'font-semibold text-indigo-600 dark:text-indigo-400' : undefined}
              >
                {beat}
              </motion.span>
            ))}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/projects" className="btn-primary">
              View work <ArrowRight size={16} />
            </Link>
            <Link to="/about" className="btn-ghost">
              Résumé
            </Link>
          </div>
        </motion.div>

        {/* ---- 3D stage: stacked windows + floating photo + badges ---- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[30rem] px-2 motion-safe:animate-float sm:max-w-[35rem] sm:px-6 lg:mx-0 lg:ml-auto lg:mr-4"
        >
          <div
            ref={stageRef}
            onMouseMove={handleMove}
            onMouseLeave={resetTilt}
            className="[perspective:1500px]"
          >
            <motion.div style={tilt} className="relative [transform-style:preserve-3d]">
              {/* deep glow disc, furthest back */}
              <div
                style={{ transform: 'translateZ(-140px)' }}
                className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/20"
              />

              {/* Deck of three windows in a fixed collage — each one's content stays
                  readable. Click any window and it lifts toward you (bigger, straight,
                  on top) while the others sit back; that's the whole 3D interaction. */}
              <div className="relative h-[34rem] [transform-style:preserve-3d] sm:h-[33rem]">

                {/* ---- editor window (top on mobile, centre-left on sm+) ---- */}
                <div className="absolute left-0 top-0 w-[94%] origin-center [transform-style:preserve-3d] sm:top-4 sm:w-[72%]">
                  <motion.div
                    {...panelProps('editor')}
                    className="relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-[#1e1e1e] shadow-float outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2 border-b border-white/10 bg-[#252526] px-4 py-3">
                      <span className="h-3.5 w-3.5 rounded-full bg-[#ff5f56]" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[#ffbd2e]" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[#27c93f]" />
                      <span className="ml-2 font-mono text-xs text-slate-400">developer.ts</span>
                      <span className="ml-auto font-mono text-xs text-slate-500">{HANDLE}</span>
                    </div>
                    <Highlight code={CODE} language="tsx" theme={themes.vsDark}>
                      {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                          className={`${className} overflow-x-auto px-5 py-5 text-[13px] leading-[1.7]`}
                          style={{ ...style, background: 'transparent' }}
                        >
                          {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })} className="table-row">
                              <span className="table-cell select-none pr-5 text-right text-slate-600">
                                {i + 1}
                              </span>
                              <span className="table-cell">
                                {line.map((token, key) => (
                                  <span key={key} {...getTokenProps({ token })} />
                                ))}
                              </span>
                            </div>
                          ))}
                        </pre>
                      )}
                    </Highlight>
                    <div className="flex items-center justify-between border-t border-white/10 bg-[#007acc] px-4 py-1.5 font-mono text-[11px] text-white/90">
                      <span>main*</span>
                      <span>TypeScript · UTF-8 · Prettier</span>
                    </div>
                    {!reduceMotion && (
                      <motion.div
                        style={{ background: sheen }}
                        className="pointer-events-none absolute inset-0"
                      />
                    )}
                  </motion.div>

                  {/* git branch pill — pinned to the editor's top-left corner. Its depth
                      sits below an activated window so a promoted panel passes in front. */}
                  <div
                    style={{ transform: 'translateZ(70px)' }}
                    className="pointer-events-none absolute -left-5 -top-7 hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 font-mono text-xs text-slate-700 shadow-lift backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 sm:flex"
                  >
                    <GitBranch size={14} className="text-emerald-500" />
                    feat/3d-portfolio
                  </div>

                  {/* Project-count disc, pinned to the editor's bottom-right corner.
                      Rendered only once a count is in — a badge reading "0 projects"
                      while the query is in flight is worse than no badge at all. */}
                  {projectCount > 0 && (
                    <div
                      style={{ transform: 'translateZ(70px)' }}
                      className="pointer-events-none absolute -bottom-14 -right-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 shadow-float backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 sm:-right-20"
                    >
                      <span className="flex items-center gap-1.5 font-heading text-xl font-bold leading-none text-slate-900 dark:text-white">
                        <Sparkles size={15} className="text-indigo-500" /> {projectCount}
                      </span>
                      <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        {projectCount === 1 ? 'project' : 'projects'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ---- terminal window (bottom-left, below the editor) ---- */}
                <div className="absolute bottom-0 left-0 w-[58%] origin-bottom-left [transform-style:preserve-3d] sm:w-[54%]">
                  <motion.div
                    {...panelProps('terminal')}
                    className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-950/95 shadow-float outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
                      <Terminal size={13} className="text-emerald-400" />
                      <span className="font-mono text-[11px] text-slate-400">zsh — kathan@portfolio</span>
                    </div>
                    <div className="space-y-1.5 px-3.5 py-4 font-mono text-xs leading-relaxed">
                      {TERMINAL_LINES.map((l, i) => (
                        <div key={i}>
                          <span className="text-emerald-400">~ $</span>{' '}
                          <span className="text-slate-100">{l.cmd}</span>
                          {l.out && <div className="text-slate-500">{l.out}</div>}
                        </div>
                      ))}
                      <div>
                        <span className="text-emerald-400">~ $</span>{' '}
                        <span className="inline-block h-3.5 w-1.5 translate-y-[2px] bg-slate-300 motion-safe:animate-blink" />
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* ---- photo window (beside the terminal on mobile, top-right on sm+) ---- */}
                <div className="absolute bottom-0 right-0 w-[38%] origin-bottom-right [transform-style:preserve-3d] sm:bottom-auto sm:top-10 sm:w-[42%] sm:origin-top-right sm:-right-2">
                  <motion.div
                    {...panelProps('photo')}
                    className="relative cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    <div className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded-2xl border border-dashed border-indigo-400/60 dark:border-indigo-500/50 sm:translate-x-2.5 sm:translate-y-2.5" />
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-float dark:border-slate-700 dark:bg-slate-900">
                      <span className="absolute left-3 top-3 z-10 rounded bg-slate-950/60 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">
                        {'// the human'}
                      </span>
                      <img
                        src={photoSources[photoIdx]}
                        onError={() =>
                          setPhotoIdx((i) => Math.min(i + 1, photoSources.length - 1))
                        }
                        alt="Kathan Shah"
                        className="aspect-[4/5] w-full object-cover"
                        loading="eager"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/75 to-transparent" />
                      <span className="absolute bottom-3 left-3.5 whitespace-nowrap font-mono text-[11px] text-white">
                        Kathan · Surat
                      </span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
