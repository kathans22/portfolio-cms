import React, { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import type { Skill } from '@portfolio/types';
import { SkillCertificationBadge } from './SkillCertificationBadge';
import { IsometricStack } from './IsometricStack';
import type { Tower } from './skillStack';

// three.js is ~150KB gzipped. Behind React.lazy it stays out of the initial bundle and
// is only fetched once this section actually scrolls into view — a visitor who never
// reaches it pays nothing.
const SkillStackCanvas = lazy(() => import('./SkillStackCanvas'));

/**
 * A lazy chunk that 404s, or a GL context that throws on init, would otherwise unmount
 * the whole section. Catching here keeps the SVG baseline on screen.
 */
class CanvasBoundary extends React.Component<
  { onFail: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * One WebGL capability check, cached. Creating a throwaway context per render would
 * leak contexts, and browsers cap how many a single page may hold.
 */
let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** Five discrete blocks read as a terminal gauge; a smooth bar reads as a loading bar. */
function LevelMeter({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <motion.span
          key={step}
          initial={{ opacity: 0, scaleY: 0.3 }}
          whileInView={{ opacity: 1, scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: step * 0.05, ease: 'easeOut' }}
          className={`h-2.5 w-[7px] rounded-[1px] ${
            step <= level
              ? 'bg-gradient-to-b from-indigo-400 to-indigo-600 dark:from-indigo-300 dark:to-indigo-500'
              : 'bg-slate-200 dark:bg-slate-800'
          }`}
        />
      ))}
    </span>
  );
}

export function CoreTechnology({ skills }: { skills?: Skill[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  // `once` keeps the canvas mounted after the first reveal — tearing down and rebuilding
  // a WebGL context each time the section scrolls past costs far more than holding it.
  const inView = useInView(sectionRef, { once: true, margin: '200px' });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Only true once the GL context reports itself alive; until then the SVG shows.
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const skill of [...(skills ?? [])].sort((a, b) => a.order - b.order)) {
      const bucket = map.get(skill.category);
      if (bucket) bucket.push(skill);
      else map.set(skill.category, [skill]);
    }
    return [...map.entries()];
  }, [skills]);

  // Flattened in category order, which is what keeps each district's towers adjacent
  // on the block — the layout module just walks this array.
  const towers = useMemo<Tower[]>(
    () =>
      grouped.flatMap(([, list], categoryIndex) =>
        list.map((skill) => ({
          id: skill.id,
          name: skill.name,
          level: skill.level,
          certified: (skill.certifications?.length ?? 0) > 0 || skill.hideLevel,
          categoryIndex,
        }))
      ),
    [grouped]
  );

  const totalSkills = skills?.length ?? 0;
  if (grouped.length === 0) return null;

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      id="skills"
      className="container-wide border-t border-slate-200 py-24 dark:border-slate-900"
    >
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="kicker flex items-center gap-2.5">
            <span className="h-px w-8 bg-indigo-400/60 dark:bg-indigo-500/50" />
            Toolkit
          </span>
          <h2 className="mb-2 mt-3 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
            Core technology
          </h2>
          <p className="max-w-md text-slate-500 dark:text-slate-400">
            Frameworks and tools used in production pipelines.
          </p>
        </div>
        <Link
          to="/about"
          className="group inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-slate-500 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          Full skill set <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
        </Link>
      </div>

      <div className="grid items-stretch gap-8 lg:grid-cols-[0.85fr_1fr]">
        {/* ---- left: the stack, as an actual object ---- */}
        <div className="relative min-h-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white dark:border-slate-800/80 dark:from-slate-900/50 dark:to-slate-950/40">
          <div className="dot-grid pointer-events-none absolute inset-0 text-slate-300/50 [mask-image:radial-gradient(70%_60%_at_50%_45%,#000,transparent)] dark:text-slate-700/40" />

          {/* Baseline: always drawn, always correct. Fades out only once WebGL has
              proven it can actually paint. */}
          <div
            className={`absolute inset-0 p-6 pb-14 transition-opacity duration-500 ${
              canvasReady ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <IsometricStack towers={towers} activeCategory={activeIndex} />
          </div>

          <div
            className={`absolute inset-0 transition-opacity duration-700 ${
              canvasReady ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {inView && hasWebGL() && !canvasFailed && (
              <CanvasBoundary onFail={() => setCanvasFailed(true)}>
                <Suspense fallback={null}>
                  <SkillStackCanvas
                    towers={towers}
                    activeCategory={activeIndex}
                    onReady={() => setCanvasReady(true)}
                  />
                </Suspense>
              </CanvasBoundary>
            )}
          </div>

          {/* Reads out whichever slab is lit, so the link between list and object is
              stated rather than something the visitor has to infer. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-slate-200/70 bg-white/60 px-4 py-2.5 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/50">
            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
              {totalSkills} towers · {grouped.length} districts
            </span>
            <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
              {activeIndex === null ? 'the stack' : grouped[activeIndex][0].toLowerCase()}
            </span>
          </div>
        </div>

        {/* ---- right: the readout ---- */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800/80">
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">~/stack</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {grouped.length} dirs · {totalSkills} files
            </span>
          </div>

          <ul className="p-4 sm:p-5">
            {grouped.map(([category, list], catIndex) => (
              <li
                key={category}
                onMouseEnter={() => setActiveIndex(catIndex)}
                onMouseLeave={() => setActiveIndex(null)}
                className="group/cat -mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-slate-900/60"
              >
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: catIndex * 0.06 }}
                  className="flex items-center gap-1.5 font-mono text-[13px] font-medium text-indigo-600 dark:text-indigo-400"
                >
                  <span className="text-slate-400 transition-transform duration-200 group-hover/cat:translate-x-0.5 dark:text-slate-600">
                    &#9656;
                  </span>
                  {category.toLowerCase()}/
                </motion.p>

                <ul className="mt-1">
                  {list.map((skill, i) => (
                    <motion.li
                      key={skill.id}
                      id={`skill-${skill.id}`}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: catIndex * 0.06 + i * 0.04 }}
                      className="flex scroll-mt-28 items-center gap-2 py-[3px] pl-3 font-mono text-[13px]"
                    >
                      <span className="select-none text-slate-300 dark:text-slate-700">
                        {i === list.length - 1 ? '└' : '├'}
                      </span>
                      <span className="truncate text-slate-700 dark:text-slate-200">{skill.name}</span>
                      <SkillCertificationBadge
                        skillName={skill.name}
                        certifications={skill.certifications ?? []}
                      />
                      {/* Dotted leader takes the leftover width, which is what lets a
                          ragged name column still hand off to flush-right meters. */}
                      <span
                        aria-hidden
                        className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-slate-300 dark:border-slate-700"
                      />
                      {skill.hideLevel ? (
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          certified
                        </span>
                      ) : (
                        <>
                          <LevelMeter level={skill.level} />
                          <span className="w-7 shrink-0 text-right text-[11px] text-slate-400 dark:text-slate-500">
                            {skill.level}/5
                          </span>
                        </>
                      )}
                    </motion.li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
