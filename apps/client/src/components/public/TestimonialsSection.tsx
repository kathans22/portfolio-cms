import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Testimonial } from '@portfolio/types';
import { TestimonialForm } from './TestimonialForm';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

/**
 * Testimonials on a rotating 3D carousel.
 *
 * Cards sit on the face of a cylinder — each one rotated by its share of 360° and
 * pushed out along Z by the ring's radius — and the whole ring turns to bring the
 * chosen card to the front. Real CSS 3D, so the side cards are genuinely angled away
 * rather than scaled to fake it.
 *
 * A ring needs bodies to read as a ring: below three testimonials it degrades to a
 * plain centred card, which is the honest presentation of one or two quotes.
 */

const AUTOPLAY_MS = 6500;

/** How far out the cards sit. Derived so neighbours clear each other at any count. */
function ringRadius(cardWidth: number, count: number) {
  if (count < 2) return 0;
  // Half-width over tan(π/n) is the edge-to-edge radius; the multiplier adds air.
  const snug = cardWidth / 2 / Math.tan(Math.PI / count);
  return Math.min(Math.max(snug * 1.35, 340), 900);
}

function Card({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-lift dark:border-slate-800/80 dark:bg-slate-900/80 sm:p-9">
      <Quote size={28} className="mb-4 shrink-0 text-indigo-500/70" aria-hidden />
      <blockquote className="flex-grow text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[17px] sm:leading-[1.65]">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3.5 border-t border-slate-100 pt-5 dark:border-slate-800/70">
        {testimonial.avatarUrl ? (
          <img
            src={testimonial.avatarUrl}
            alt=""
            loading="lazy"
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 font-heading text-lg font-bold text-indigo-600 dark:text-indigo-400">
            {testimonial.name[0]}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
            {testimonial.name}
          </span>
          <span className="block truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {testimonial.role}
            {testimonial.company ? ` · ${testimonial.company}` : ''}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function Carousel({ items }: { items: Testimonial[] }) {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardWidth, setCardWidth] = useState(340);

  const count = items.length;
  const step = 360 / count;
  const radius = ringRadius(cardWidth, count);

  // The ring's geometry is in pixels, so the card width has to be measured rather
  // than assumed — otherwise the radius is wrong at every breakpoint but one.
  useLayoutEffect(() => {
    const measure = () => {
      const w = viewportRef.current?.clientWidth ?? 800;
      setCardWidth(Math.min(600, Math.max(280, w - 80)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const go = useCallback((delta: number) => setIndex((i) => i + delta), []);

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const id = setInterval(() => setIndex((i) => i + 1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion, count]);

  // index is unbounded so the ring always turns the short way in the direction asked;
  // this maps it back for "which card is facing front".
  const activeSlot = ((index % count) + count) % count;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        className="relative mx-auto h-[20rem] w-full [perspective:1600px] sm:h-[17rem]"
      >
        <motion.div
          // `z: -radius` pushes the whole ring back so the front card lands on the
          // perspective plane at z=0. Without it that card sits `radius` closer to the
          // viewer and renders ~30% larger than its layout box — it overflowed the
          // container and collided with the controls below.
          animate={{ rotateY: -index * step, z: -radius }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 60, damping: 16, mass: 0.9 }
          }
          className="absolute inset-0 [transform-style:preserve-3d]"
        >
          {items.map((testimonial, i) => {
            // Shortest angular distance from the front, 0 … count/2.
            const raw = Math.abs(((i - activeSlot + count) % count));
            const distance = Math.min(raw, count - raw);
            const isFront = distance === 0;

            return (
              <div
                key={testimonial.id}
                aria-hidden={!isFront}
                style={{
                  width: cardWidth,
                  transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                  // Only the front card and its immediate neighbours are worth drawing;
                  // the rest are edge-on or behind the viewer.
                  opacity: distance > 1.5 ? 0 : isFront ? 1 : 0.35,
                  pointerEvents: isFront ? 'auto' : 'none',
                }}
                // Centred with left/right/margin, NOT -translate-x-1/2: the inline
                // transform below owns the `transform` property outright, so a Tailwind
                // translate utility on the same element is silently discarded.
                className="absolute inset-x-0 top-0 mx-auto h-full transition-opacity duration-500"
              >
                <Card testimonial={testimonial} />
              </div>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-7 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous testimonial"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-indigo-400"
        >
          <ChevronLeft size={17} />
        </button>

        <ul className="flex items-center gap-2">
          {items.map((testimonial, i) => (
            <li key={testimonial.id}>
              <button
                type="button"
                // Move by the shortest signed distance, so clicking a dot never spins
                // the ring the long way round.
                onClick={() => {
                  const diff = ((i - activeSlot + count) % count);
                  go(diff > count / 2 ? diff - count : diff);
                }}
                aria-label={`Show testimonial from ${testimonial.name}`}
                aria-current={i === activeSlot}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeSlot
                    ? 'w-6 bg-indigo-500'
                    : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600'
                }`}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next testimonial"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-indigo-400"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

export function TestimonialsSection({ testimonials }: { testimonials?: Testimonial[] }) {
  const items = testimonials ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      id="testimonials"
      className="container-wide border-t border-slate-200 py-24 dark:border-slate-900"
    >
      <div className="mb-12">
        <span className="kicker flex items-center gap-2.5">
          <span className="h-px w-8 bg-indigo-400/60 dark:bg-indigo-500/50" />
          Words
        </span>
        <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
          What people say
        </h2>
      </div>

      {items.length >= 3 ? (
        <Carousel items={items} />
      ) : (
        // One or two quotes on a carousel is a ring with nothing to turn — show them
        // plainly instead.
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((testimonial) => (
            <Card key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      )}

      <TestimonialForm />
    </motion.section>
  );
}
