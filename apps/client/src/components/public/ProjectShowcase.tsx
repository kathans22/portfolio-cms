import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import type { Project } from '@portfolio/types';
import { ArrowUpRight, Github, ExternalLink } from 'lucide-react';

/**
 * Project cards with real perspective depth.
 *
 * The card tilts toward the pointer and its contents sit at different translateZ, so
 * the title, tags and badge genuinely float above the artwork rather than tilting flat
 * with it. A specular sheen tracks the cursor across the surface.
 *
 * All CSS transforms driven by motion values — no re-render per pointer move, and no
 * third renderer on the page beyond the one WebGL scene in the skills section.
 */

const SPRING = { stiffness: 150, damping: 18, mass: 0.4 };

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Normalised pointer position over the card, -0.5 … 0.5.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), SPRING);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), SPRING);

  // Artwork drifts against the tilt — the parallax that sells the depth. It lives
  // inside an overflow-hidden window, which flattens 3D, so this has to be a 2D nudge.
  const imgX = useSpring(useTransform(px, [-0.5, 0.5], [14, -14]), SPRING);
  const imgY = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), SPRING);

  const sheenX = useTransform(px, (v) => `${(v + 0.5) * 100}%`);
  const sheenY = useTransform(py, (v) => `${(v + 0.5) * 100}%`);
  const sheen = useMotionTemplate`radial-gradient(340px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.22), transparent 55%)`;
  const edge = useMotionTemplate`radial-gradient(420px circle at ${sheenX} ${sheenY}, rgba(174,106,71,0.35), transparent 60%)`;

  const handleMove = (e: React.MouseEvent) => {
    if (reduceMotion || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  const tilt = reduceMotion
    ? undefined
    : { rotateX, rotateY, transformStyle: 'preserve-3d' as const };

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      className="[perspective:1200px]"
    >
      <div ref={ref} onMouseMove={handleMove} onMouseLeave={reset}>
        <motion.div
          style={tilt}
          whileHover={reduceMotion ? undefined : { y: -6 }}
          transition={SPRING}
          className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft transition-shadow duration-300 hover:shadow-float dark:border-slate-800/80 dark:bg-slate-900/60"
        >
          {/* cursor-tracked edge glow, behind the card */}
          {!reduceMotion && (
            <motion.div
              aria-hidden
              style={{ background: edge, transform: 'translateZ(-1px)' }}
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 blur-[2px] transition-opacity duration-300 group-hover:opacity-100"
            />
          )}

          {/* ---- artwork window ---- */}
          <div className="relative h-52 overflow-hidden rounded-t-2xl bg-slate-100 dark:bg-slate-950">
            <motion.img
              src={project.coverImageUrl}
              alt=""
              loading="lazy"
              style={reduceMotion ? undefined : { x: imgX, y: imgY }}
              // Oversized so the parallax drift never exposes an edge.
              className="absolute inset-0 h-[112%] w-[112%] -translate-x-[6%] -translate-y-[6%] object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
          </div>

          {/* ---- floating overlays: these are what the depth is actually for ---- */}
          <span
            aria-hidden
            style={{ transform: 'translateZ(64px)' }}
            className="pointer-events-none absolute left-5 top-[11.5rem] font-mono text-[11px] uppercase tracking-[0.2em] text-white/70"
          >
            {String(index + 1).padStart(2, '0')}
          </span>

          {project.featured && (
            <span
              style={{ transform: 'translateZ(72px)' }}
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-slate-950/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur-md"
            >
              Featured
            </span>
          )}

          {/* ---- body ---- */}
          <div className="flex flex-grow flex-col p-6">
            <h3
              style={{ transform: 'translateZ(42px)' }}
              className="text-xl font-bold leading-snug tracking-tight text-slate-900 dark:text-white"
            >
              {project.title}
            </h3>

            <p
              style={{ transform: 'translateZ(26px)' }}
              className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400"
            >
              {project.summary}
            </p>

            <ul
              style={{ transform: 'translateZ(16px)' }}
              className="mt-5 flex flex-wrap gap-1.5"
            >
              {project.techStack.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10.5px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                >
                  {tag}
                </li>
              ))}
            </ul>

            <div className="flex-grow" />

            <div
              style={{ transform: 'translateZ(38px)' }}
              className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800/70"
            >
              <Link
                to={`/projects/${project.slug}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400"
              >
                Read details
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>

              <span className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                {project.repoUrl && (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.title} repository`}
                    className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <Github size={16} />
                  </a>
                )}
                {project.liveUrl && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.title} live demo`}
                    className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </span>
            </div>
          </div>

          {/* specular sheen gliding over the whole surface */}
          {!reduceMotion && (
            <motion.div
              aria-hidden
              style={{ background: sheen }}
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
        </motion.div>
      </div>
    </motion.article>
  );
}

export function ProjectShowcase({ projects }: { projects?: Project[] }) {
  const shown = projects?.slice(0, 3) ?? [];
  if (shown.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      id="projects"
      className="container-wide border-t border-slate-200 py-24 dark:border-slate-900"
    >
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="kicker flex items-center gap-2.5">
            <span className="h-px w-8 bg-indigo-400/60 dark:bg-indigo-500/50" />
            Selected work
          </span>
          <h2 className="mb-2 mt-3 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
            Things I&apos;ve shipped
          </h2>
          <p className="max-w-md text-slate-500 dark:text-slate-400">
            Projects demonstrating API scalability and considered interface design.
          </p>
        </div>
        <Link
          to="/projects"
          className="group inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-slate-500 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          All projects <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((project, i) => (
          <ProjectCard key={project.id} project={project} index={i} />
        ))}
      </div>
    </motion.section>
  );
}
